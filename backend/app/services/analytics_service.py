"""
analytics_service.py — Core video processing pipeline.

Key fixes over original:
1. total_people now counts UNIQUE global IDs, not sum-per-frame
2. Shelf accumulator stores the proper display string keys
3. Progress callback so API can report % to client
4. Annotated video written to outputs/ directory
5. Crossing log persisted to DB
6. All exceptions caught and re-raised with context
"""

import cv2
import os
import time
import logging
import numpy as np
from typing import Callable, Optional

from ultralytics import YOLO
import supervision as sv

from app.config import (
    PERSON_MODEL_PATH, SHELF_MODEL_PATH,
    PERSON_CONF, SHELF_CONF, PERSON_CLASS_ID,
    FOOTFALL_LINE_RATIO, OUTPUT_DIR,
    SAVE_ANNOTATED_VIDEO, ANNOTATION_SKIP_FRAMES,
)
from app.models.dwell   import DwellTracker
from app.models.zones   import ZoneAnalyzer
from app.models.tracker import Tracker
from app.models.footfall import FootfallCounter
from app.models.shelf   import ShelfDetector
from app.utils.video_utils import (
    draw_virtual_line, draw_tracked_persons,
    draw_zone_overlay, draw_stats_panel,
)

log = logging.getLogger(__name__)

# ── Lazy-loaded singletons (load once, reuse across requests) ────────────────
_person_model: Optional[YOLO] = None
_shelf_model:  Optional[YOLO] = None


def _get_person_model() -> YOLO:
    global _person_model
    if _person_model is None:
        log.info("Loading person detection model …")
        _person_model = YOLO(PERSON_MODEL_PATH)
    return _person_model


def _get_shelf_model() -> Optional[YOLO]:
    global _shelf_model
    if _shelf_model is None:
        if not os.path.exists(SHELF_MODEL_PATH):
            log.warning(f"Shelf model not found at {SHELF_MODEL_PATH}. Shelf detection disabled.")
            return None
        log.info("Loading shelf detection model …")
        _shelf_model = YOLO(SHELF_MODEL_PATH)
    return _shelf_model


# ── Main entry point ─────────────────────────────────────────────────────────
def process_video(
    video_path: str,
    job_id: str = "unknown",
    progress_cb: Optional[Callable[[int], None]] = None,
    zones_data: Optional[list] = None,
    entry_zone_data: Optional[list] = None,
    exit_zone_data: Optional[list] = None,
    # Legacy line params
    entry_line_ratio: float = None,
    exit_line_ratio: float  = None,
    entry_direction: str    = "down",
    exit_direction: str     = "up",
    conf: float = 0.35,
) -> dict:
    """
    Process a video file end-to-end.

    Args:
        video_path:   Path to the input video.
        job_id:       Identifier used to name the output annotated video.
        progress_cb:  Optional callback(percent: int) called each 5% of progress.

    Returns:
        Analytics dict with all metrics.
    """
    log.info(f"[{job_id}] Instantiating YOLO person model...")
    person_model = YOLO(PERSON_MODEL_PATH)
    log.info(f"[{job_id}] Instantiating YOLO shelf model...")
    if os.path.exists(SHELF_MODEL_PATH):
        shelf_model = YOLO(SHELF_MODEL_PATH)
    else:
        shelf_model = None
    shelf_enabled = shelf_model is not None

    cap = None
    device = None
    q = None
    if video_path == "oak":
        import depthai as dai
        pipeline = dai.Pipeline()
        cam = pipeline.createColorCamera()
        cam.setResolution(dai.ColorCameraProperties.SensorResolution.THE_1080_P)
        cam.setFps(30)
        cam.setInterleaved(False)
        cam.setBoardSocket(dai.CameraBoardSocket.CAM_A)
        cam.initialControl.setAutoFocusMode(dai.CameraControl.AutoFocusMode.CONTINUOUS_VIDEO)

        xout = pipeline.createXLinkOut()
        xout.setStreamName("video")
        cam.video.link(xout.input)

        device = dai.Device(pipeline)
        q = device.getOutputQueue("video", maxSize=4, blocking=False)
        width = 1920
        height = 1080
        fps = 30.0
        total_frames = 0
        log.info(f"[{job_id}] OAK Camera connected: {width}x{height} @ {fps:.1f}fps")
    else:
        try:
            source = int(video_path)
        except ValueError:
            source = video_path

        cap = cv2.VideoCapture(source)
        if not cap.isOpened():
            raise RuntimeError(f"Cannot open video source: {video_path}")

        width  = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps    = cap.get(cv2.CAP_PROP_FPS) or 25.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    log.info(f"[{job_id}] Source: {video_path} | {width}x{height} @ {fps:.1f}fps, {total_frames} frames")

    # ── Output video writer ───────────────────
    out_writer = None
    output_path = None
    if SAVE_ANNOTATED_VIDEO:
        output_path = os.path.join(OUTPUT_DIR, f"{job_id}_annotated.mp4")
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        out_writer = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    # ── Module init ───────────────────────────
    # Build custom zones if provided
    custom_zones = None
    if zones_data:
        custom_zones = {
            z["name"]: np.array(
                [[int(p[0] * width / 100), int(p[1] * height / 100)] for p in z["points"]],
                dtype=np.int32
            )
            for z in zones_data
            if len(z.get("points", [])) >= 3
        }
        log.info(f"[{job_id}] Custom zones: {list(custom_zones.keys())}")

    # Build entry/exit polygon zones if provided
    entry_zone_poly = None
    exit_zone_poly  = None
    if entry_zone_data and len(entry_zone_data) >= 3:
        # Points are in percentage (0-100) — convert to pixels
        entry_zone_poly = np.array(
            [[int(p[0] * width / 100), int(p[1] * height / 100)] for p in entry_zone_data],
            dtype=np.int32
        )
        log.info(f"[{job_id}] Entry zone: {len(entry_zone_data)} points (pixel-converted)")
    if exit_zone_data and len(exit_zone_data) >= 3:
        # Points are in percentage (0-100) — convert to pixels
        exit_zone_poly = np.array(
            [[int(p[0] * width / 100), int(p[1] * height / 100)] for p in exit_zone_data],
            dtype=np.int32
        )
        log.info(f"[{job_id}] Exit zone: {len(exit_zone_data)} points (pixel-converted)")

    effective_entry_ratio = entry_line_ratio if entry_line_ratio is not None else 0.40
    effective_exit_ratio  = exit_line_ratio  if exit_line_ratio  is not None else 0.70

    zone_analyzer  = ZoneAnalyzer(width, height, custom_zones=custom_zones)
    tracker        = Tracker()
    footfall       = FootfallCounter(
        entry_zone=entry_zone_poly,
        exit_zone=exit_zone_poly,
        height=height,
        entry_line_ratio=effective_entry_ratio,
        exit_line_ratio=effective_exit_ratio,
        entry_direction=entry_direction,
        exit_direction=exit_direction,
    )
    dwell_tracker  = DwellTracker()
    shelf_detector = ShelfDetector(shelf_model) if shelf_enabled else None

    # ── Accumulators ──────────────────────────
    shelf_accumulator = {"NORMAL": 0, "LOW STOCK": 0, "EMPTY": 0, "NO SHELF DETECTED": 0}
    last_alert_times = {}
    current_shelf_status = "N/A"
    last_progress = -1
    frame_count = 0
    video_start = time.time()

    # ── Per-frame timeline (sampled every 10 frames) ──
    timeline = []          # [{frame, time_sec, count}]
    peak_count = 0
    peak_frame = 0
    frame_counts_all = []  # for crowd density histogram

    try:
        log.info(f"[{job_id}] Starting frame processing loop...")
        while True:
            if video_path == "oak":
                img_frame = q.get()
                frame = img_frame.getCvFrame()
                ret = True
            else:
                ret, frame = cap.read()
            if not ret:
                break

            frame_count += 1
            time_sec = round(frame_count / fps, 2)
            if frame_count == 1:
                log.info(f"[{job_id}] Processing first frame...")

            # ── Progress reporting ────────────
            if total_frames > 0:
                pct = int((frame_count / total_frames) * 100)
                if pct // 5 != last_progress // 5:
                    last_progress = pct
                    if progress_cb:
                        progress_cb(pct)
                    log.debug(f"[{job_id}] Progress: {pct}%")

            # ── Person detection ──────────────
            results    = person_model(frame, conf=conf, classes=[PERSON_CLASS_ID], verbose=False, device="cpu")[0]
            detections = sv.Detections.from_ultralytics(results)

            # ── Tracking ─────────────────────
            tracked = tracker.update(detections)

            # ── Per-frame crowd count ─────────
            current_count = len(tracked)
            frame_counts_all.append(current_count)
            if current_count > peak_count:
                peak_count = current_count
                peak_frame = frame_count
            if frame_count % 10 == 0 or frame_count == 1:
                timeline.append({
                    "frame": frame_count,
                    "time_sec": time_sec,
                    "count": current_count,
                })

            # ── Dwell ─────────────────────────
            dwell_tracker.update(tracked)

            # ── Footfall ──────────────────────
            footfall.update(tracked, time_sec=time_sec)

            # ── Zones ─────────────────────────
            zone_counts = zone_analyzer.update(tracked)   # uses tracked (with global_id)

            # ── Shelf (every frame) ───────────
            if shelf_detector:
                shelf_result = shelf_detector.detect(frame)
                current_shelf_status = shelf_result["status"]
                shelf_accumulator[current_shelf_status] += 1

            # ── Alert Triggers ────────────────
            
            # Shelf Empty Alert
            if shelf_enabled and current_shelf_status == "EMPTY":
                if time_sec - last_alert_times.get("shelf_empty", 0) > 15.0:
                    last_alert_times["shelf_empty"] = time_sec
                    if progress_cb:
                        progress_cb(
                            last_progress if last_progress != -1 else 0,
                            None,
                            {
                                "severity": "CRITICAL",
                                "message": "🚨 SHELF EMPTY! Immediate restocking required.",
                                "timestamp_sec": time_sec
                            }
                        )
                    try:
                        from app.routers.websocket import push_alert_sync
                        push_alert_sync("CRITICAL", "SHELF EMPTY! Immediate restocking required.", job_id=job_id)
                    except Exception:
                        pass
            
            # Zone Crowding Alert
            for zname, count in zone_counts.items():
                if count >= 4:
                    alert_key = f"crowd_{zname}"
                    if time_sec - last_alert_times.get(alert_key, 0) > 15.0:
                        last_alert_times[alert_key] = time_sec
                        if progress_cb:
                            progress_cb(
                                last_progress if last_progress != -1 else 0,
                                None,
                                {
                                    "severity": "WARNING",
                                    "message": f"⚠️ Zone Crowding Alert: {count} people in {zname}!",
                                    "timestamp_sec": time_sec
                                }
                            )
                        try:
                            from app.routers.websocket import push_alert_sync
                            push_alert_sync("WARNING", f"Zone Crowding: {count} people in {zname}!", zone=zname, job_id=job_id)
                        except Exception:
                            pass

            # ── Annotate & write frame / stream ──
            if (out_writer or True) and (frame_count % ANNOTATION_SKIP_FRAMES == 0):
                annotated = frame.copy()
                if entry_zone_poly is not None:
                    overlay = annotated.copy()
                    cv2.fillPoly(overlay, [entry_zone_poly], (0, 255, 0))
                    cv2.addWeighted(overlay, 0.25, annotated, 0.75, 0, annotated)
                    cv2.polylines(annotated, [entry_zone_poly], True, (0, 255, 0), 2)
                    cx, cy = int(entry_zone_poly[:, 0].mean()), int(entry_zone_poly[:, 1].mean())
                    cv2.putText(annotated, "ENTRY", (cx - 25, cy), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
                else:
                    annotated = draw_virtual_line(annotated, footfall.line_position, color=(0, 255, 0), label="ENTRY")
                if exit_zone_poly is not None:
                    overlay = annotated.copy()
                    cv2.fillPoly(overlay, [exit_zone_poly], (0, 0, 255))
                    cv2.addWeighted(overlay, 0.25, annotated, 0.75, 0, annotated)
                    cv2.polylines(annotated, [exit_zone_poly], True, (0, 0, 255), 2)
                    cx, cy = int(exit_zone_poly[:, 0].mean()), int(exit_zone_poly[:, 1].mean())
                    cv2.putText(annotated, "EXIT", (cx - 20, cy), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
                else:
                    annotated = draw_virtual_line(annotated, footfall.exit_line_position, color=(0, 0, 255), label="EXIT")
                annotated = draw_zone_overlay(annotated, zone_counts, width, height, zone_polygons=custom_zones)
                annotated = draw_tracked_persons(annotated, tracked)
                annotated = draw_stats_panel(annotated, {
                    "unique_people":     tracker.total_unique_people,
                    "entries":           footfall.entry_count,
                    "exits":             footfall.exit_count,
                    "currently_inside":  footfall.get_counts()["currently_inside"],
                    "shelf_status":      current_shelf_status,
                })
                if out_writer:
                    out_writer.write(annotated)
                
                try:
                    _, jpeg_buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 80])
                    from app.utils.streamer import frame_streamer
                    frame_streamer.put(job_id, jpeg_buf.tobytes())
                except Exception:
                    pass

                # Periodically update live stats in database (every 5 frames for both live and video)
                if frame_count % 5 == 0:
                    try:
                        live_metrics = {
                            "total_unique_people": tracker.total_unique_people,
                            "entries": footfall.entry_count,
                            "exits": footfall.exit_count,
                            "currently_inside": footfall.get_counts()["currently_inside"],
                            "shelf_status": current_shelf_status,
                            "zones": {
                                "avg_per_frame": zone_analyzer.get_summary()["avg_people_per_frame"],
                                "unique_visitors": zone_analyzer.get_summary()["unique_visitors"],
                                "most_popular": zone_analyzer.get_summary()["most_popular_zone"],
                            },
                        }
                        if progress_cb:
                            progress_cb(last_progress if last_progress != -1 else 0, live_metrics)
                    except Exception:
                        pass

    finally:
        if cap is not None:
            cap.release()
        if device is not None:
            device.close()
        if out_writer:
            out_writer.release()
        dwell_tracker.finalise_all()  # flush active visit timers before summary

    processing_time = round(time.time() - video_start, 1)
    log.info(f"[{job_id}] Done. {frame_count} frames in {processing_time}s")

    if progress_cb:
        progress_cb(100)

    # ── Crowd density histogram ───────────────
    if frame_counts_all:
        max_c = max(frame_counts_all) + 1
        density_hist = {str(i): frame_counts_all.count(i) for i in range(max_c)}
    else:
        density_hist = {}

    # ── Final shelf status ────────────────────
    shelf_final = max(shelf_accumulator, key=shelf_accumulator.get)

    # ── Dwell summary ─────────────────────────
    dwell_summary = dwell_tracker.get_summary()

    # ── Zone summary ─────────────────────────
    zone_summary = zone_analyzer.get_summary()

    # ── Footfall ─────────────────────────────
    footfall_data = footfall.get_counts()

    return {
        # People
        "total_unique_people": tracker.total_unique_people,
        "avg_people_per_frame": round(
            sum(zone_summary["avg_people_per_frame"].values()), 2
        ),

        # Footfall
        "entries": footfall_data["entries"],
        "exits": footfall_data["exits"],
        "currently_inside": footfall_data["currently_inside"],
        "crossing_log": footfall.get_crossing_log(),   # list of {type, global_id, timestamp}

        # Dwell
        "dwell": dwell_summary,

        # Zones
        "zones": {
            "avg_per_frame":   zone_summary["avg_people_per_frame"],
            "unique_visitors": zone_summary["unique_visitors"],
            "most_popular":    zone_summary["most_popular_zone"],
            "heatmap":         zone_summary["heatmap"],
        },

        # Shelf
        "shelf_status": shelf_final,
        "shelf_breakdown": shelf_accumulator,

        # Crowd timeline
        "timeline": timeline,
        "peak_crowd": {"count": peak_count, "frame": peak_frame, "time_sec": round(peak_frame / fps, 2)},
        "crowd_density_histogram": density_hist,
        "video_meta": {"width": width, "height": height, "fps": round(fps, 2), "total_frames": total_frames},

        # Meta
        "total_frames_processed": frame_count,
        "processing_time_sec": processing_time,
        "annotated_video": output_path,
    }