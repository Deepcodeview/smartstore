"""
routers/camera.py — Live Camera Endpoints for Retail AI System
==============================================================
POST /camera/start          — Start OAK-D camera
POST /camera/stop           — Stop OAK-D camera
GET  /camera/status         — Camera connection status
GET  /camera/stream         — MJPEG live stream (use in <img> tag)
GET  /camera/frame          — Single JPEG frame
POST /camera/inspect-live   — Capture frame + run YOLO person detection
POST /camera/inspect-image  — Upload image → YOLO person detection
"""

import asyncio
import uuid
import cv2
import numpy as np
from datetime import datetime
from fastapi import APIRouter, File, UploadFile, Query
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel
from typing import Optional

from app.services.oakd_camera import start_camera, stop_camera, get_frame, get_status

router = APIRouter(prefix="/camera", tags=["camera"])


class CameraStartRequest(BaseModel):
    resolution: str = "1080p"
    fps: int = 30


@router.post("/start")
async def camera_start(req: CameraStartRequest):
    """Start OAK-D camera."""
    result = start_camera(resolution=req.resolution, fps=req.fps)
    return result


@router.post("/stop")
async def camera_stop():
    """Stop OAK-D camera."""
    return stop_camera()


@router.get("/status")
async def camera_status():
    """Get camera connection status."""
    cam = get_status()
    return {**cam, "source": "oak-d"}


@router.get("/frame")
async def camera_frame():
    """Get single JPEG frame from OAK-D."""
    frame = get_frame()
    if frame is None:
        return Response(content=b"", status_code=503, headers={"X-Error": "No camera frame"})
    _, jpeg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return Response(content=jpeg.tobytes(), media_type="image/jpeg")


@router.get("/stream")
async def camera_stream():
    """MJPEG live stream — use as <img src='/camera/stream'>."""
    return StreamingResponse(
        _mjpeg_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )


async def _mjpeg_generator():
    """Yield JPEG frames as MJPEG stream at ~30fps."""
    while True:
        frame = get_frame()
        if frame is not None:
            _, jpeg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
            yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + jpeg.tobytes() + b"\r\n")
        await asyncio.sleep(0.033)


@router.post("/inspect-live")
async def inspect_live():
    """
    Capture current OAK-D frame → run YOLO person detection → return crowd analytics.
    """
    frame = get_frame()
    if frame is None:
        return {"error": "no_frame", "message": "OAK-D camera not connected or no frame available"}

    result = _run_yolo_on_frame(frame)
    return result


@router.post("/inspect-image")
async def inspect_image(
    file: UploadFile = File(...),
    conf: float = Query(0.40),
):
    """
    Upload image → YOLO person detection → return crowd analytics.
    Works with webcam snapshots, IP camera frames, or uploaded images.
    """
    raw = await file.read()
    if not raw:
        return {"error": "empty_file"}

    nparr = np.frombuffer(raw, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if frame is None:
        return {"error": "invalid_image"}

    result = _run_yolo_on_frame(frame, conf=conf)
    return result


def _run_yolo_on_frame(frame: np.ndarray, conf: float = 0.40) -> dict:
    """
    Run YOLO person detection on a frame.
    Returns crowd analytics: person count, zones, density.
    """
    import time
    t0 = time.perf_counter()

    frame_id = f"FRAME-{uuid.uuid4().hex[:6].upper()}"
    h, w = frame.shape[:2]

    try:
        from ultralytics import YOLO
        import os

        # Load YOLOv8n (person detection) — cached after first load
        model_path = os.path.join(os.path.dirname(__file__), "..", "..", "yolov8n.pt")
        if not hasattr(_run_yolo_on_frame, "_model"):
            if os.path.exists(model_path):
                _run_yolo_on_frame._model = YOLO(model_path)
            else:
                _run_yolo_on_frame._model = YOLO("yolov8n.pt")  # auto-download

        model = _run_yolo_on_frame._model
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = model(rgb, conf=conf, classes=[0], verbose=False, device="cpu")  # class 0 = person

        persons = []
        for r in results:
            for box in r.boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                persons.append({
                    "bbox_pct": [
                        round(x1 / w * 100, 1), round(y1 / h * 100, 1),
                        round(x2 / w * 100, 1), round(y2 / h * 100, 1),
                    ],
                    "confidence": round(float(box.conf[0]), 3),
                    "zone": _get_zone(x1, y1, x2, y2, w, h),
                })

        infer_ms = round((time.perf_counter() - t0) * 1000)
        person_count = len(persons)

        # Zone counts
        zone_counts = {}
        for p in persons:
            z = p["zone"]
            zone_counts[z] = zone_counts.get(z, 0) + 1

        # Crowd density
        density = "LOW"
        if person_count >= 20:
            density = "CRITICAL"
        elif person_count >= 12:
            density = "HIGH"
        elif person_count >= 6:
            density = "MEDIUM"

        return {
            "frame_id":     frame_id,
            "person_count": person_count,
            "density":      density,
            "persons":      persons,
            "zone_counts":  zone_counts,
            "infer_ms":     infer_ms,
            "frame_size":   f"{w}x{h}",
            "timestamp":    datetime.utcnow().isoformat(),
            "model":        "yolov8n",
        }

    except Exception as e:
        infer_ms = round((time.perf_counter() - t0) * 1000)
        return {
            "frame_id":     frame_id,
            "person_count": 0,
            "density":      "UNKNOWN",
            "persons":      [],
            "zone_counts":  {},
            "infer_ms":     infer_ms,
            "error":        str(e),
            "timestamp":    datetime.utcnow().isoformat(),
        }


def _get_zone(x1: float, y1: float, x2: float, y2: float, w: int, h: int) -> str:
    """Map bounding box center to store zone name."""
    cx = (x1 + x2) / 2 / w
    cy = (y1 + y2) / 2 / h

    if cy < 0.33:
        row = "Entrance"
    elif cy < 0.66:
        row = "Mid"
    else:
        row = "Checkout"

    if cx < 0.33:
        col = "Left"
    elif cx < 0.66:
        col = "Center"
    else:
        col = "Right"

    zone_map = {
        ("Entrance", "Left"):   "Entrance",
        ("Entrance", "Center"): "Entrance",
        ("Entrance", "Right"):  "Electronics",
        ("Mid", "Left"):        "Apparel",
        ("Mid", "Center"):      "Grocery",
        ("Mid", "Right"):       "Electronics",
        ("Checkout", "Left"):   "Checkout",
        ("Checkout", "Center"): "Checkout",
        ("Checkout", "Right"):  "Checkout",
    }
    return zone_map.get((row, col), "Grocery")
