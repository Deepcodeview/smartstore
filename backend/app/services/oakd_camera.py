"""
oakd_camera.py — OAK-D Camera Integration for PCB-GUARDIAN
===========================================================
Connects to Luxonis OAK-D camera via DepthAI library.
Provides live frame capture for real-time PCB inspection.

Install: pip install depthai opencv-python-headless
"""

import logging
import time
import threading
import numpy as np
from typing import Optional, Tuple

log = logging.getLogger("pcb-guardian.oakd")

_pipeline = None
_device = None
_queue = None
_running = False
_lock = threading.Lock()
_last_frame: Optional[np.ndarray] = None
_fps = 0.0


def start_camera(resolution: str = "1080p", fps: int = 30) -> dict:
    """Start OAK-D camera pipeline. Returns status dict."""
    global _pipeline, _device, _queue, _running, _last_frame

    try:
        import depthai as dai
    except ImportError:
        return {"ok": False, "error": "depthai not installed. Run: pip install depthai"}

    if _running and _device is not None:
        return {"ok": True, "message": "Camera already running", "fps": fps}

    try:
        _pipeline = dai.Pipeline()

        # RGB camera node
        cam = _pipeline.create(dai.node.ColorCamera)
        cam.setInterleaved(False)
        cam.setColorOrder(dai.ColorCameraProperties.ColorOrder.BGR)
        cam.setFps(fps)

        # Resolution
        res_map = {
            "4k": dai.ColorCameraProperties.SensorResolution.THE_4_K,
            "1080p": dai.ColorCameraProperties.SensorResolution.THE_1080_P,
            "720p": dai.ColorCameraProperties.SensorResolution.THE_720_P,
        }
        cam.setResolution(res_map.get(resolution, res_map["1080p"]))
        cam.setPreviewSize(1280, 720)

        # Output
        xout = _pipeline.create(dai.node.XLinkOut)
        xout.setStreamName("rgb")
        cam.preview.link(xout.input)

        # Connect to device
        _device = dai.Device(_pipeline)
        _queue = _device.getOutputQueue(name="rgb", maxSize=4, blocking=False)
        _running = True

        # Start background frame grabber
        t = threading.Thread(target=_frame_grabber, daemon=True)
        t.start()

        log.info(f"✅ OAK-D camera started: {resolution} @ {fps}fps")
        return {"ok": True, "message": f"OAK-D started: {resolution}@{fps}fps", "fps": fps}

    except Exception as e:
        _running = False
        log.error(f"OAK-D start failed: {e}")
        return {"ok": False, "error": str(e)}


def stop_camera() -> dict:
    """Stop OAK-D camera and release resources."""
    global _device, _running, _pipeline, _queue, _last_frame

    _running = False
    time.sleep(0.3)

    if _device:
        try:
            _device.close()
        except Exception:
            pass
        _device = None

    _pipeline = None
    _queue = None
    _last_frame = None
    log.info("OAK-D camera stopped")
    return {"ok": True, "message": "Camera stopped"}


def get_frame() -> Optional[np.ndarray]:
    """Get latest frame as numpy array (BGR). Returns None if no camera."""
    return _last_frame


def get_status() -> dict:
    """Camera status."""
    return {
        "connected": _running and _device is not None,
        "fps": round(_fps, 1),
        "has_frame": _last_frame is not None,
        "resolution": f"{_last_frame.shape[1]}x{_last_frame.shape[0]}" if _last_frame is not None else None,
    }


def _frame_grabber():
    """Background thread: continuously grab frames from OAK-D."""
    global _last_frame, _running, _fps

    frame_count = 0
    t0 = time.time()

    while _running and _queue:
        try:
            in_frame = _queue.tryGet()
            if in_frame is not None:
                with _lock:
                    _last_frame = in_frame.getCvFrame()

                frame_count += 1
                elapsed = time.time() - t0
                if elapsed >= 1.0:
                    _fps = frame_count / elapsed
                    frame_count = 0
                    t0 = time.time()
            else:
                time.sleep(0.001)
        except Exception as e:
            log.error(f"Frame grab error: {e}")
            time.sleep(0.1)

    _running = False
    log.info("Frame grabber thread exited")
