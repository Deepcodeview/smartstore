"""
video_utils.py — Annotation helpers for drawing on frames.
"""

import cv2
import numpy as np
from typing import Optional


def draw_virtual_line(frame: np.ndarray, line_y: int, color=(0, 255, 255), thickness=2, label="ENTRY/EXIT") -> np.ndarray:
    h, w = frame.shape[:2]
    cv2.line(frame, (0, line_y), (w, line_y), color, thickness)
    cv2.putText(frame, label, (10, line_y - 8),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
    return frame


def draw_tracked_persons(
    frame: np.ndarray,
    tracked,
    color=(0, 200, 0),
    thickness=2,
) -> np.ndarray:
    """Draw bounding boxes + global ID label for each tracked person."""
    if len(tracked) == 0 or tracked.tracker_id is None:
        return frame

    global_ids = tracked.data.get("global_id", None)

    for i, (box, tid) in enumerate(zip(tracked.xyxy, tracked.tracker_id)):
        x1, y1, x2, y2 = map(int, box)
        gid = int(global_ids[i]) if global_ids is not None and i < len(global_ids) else int(tid)

        cv2.rectangle(frame, (x1, y1), (x2, y2), color, thickness)

        label = f"ID:{gid}"
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 1)
        cv2.rectangle(frame, (x1, y1 - th - 6), (x1 + tw + 4, y1), color, -1)
        cv2.putText(frame, label, (x1 + 2, y1 - 4),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 0), 1)

    return frame


def draw_zone_overlay(
    frame: np.ndarray,
    zone_counts: dict,
    width: int,
    height: int,
    alpha: float = 0.25,
    zone_polygons: Optional[dict] = None,
) -> np.ndarray:
    """Draw semi-transparent zone overlays with person counts.
    If zone_polygons provided, draws actual polygons; else falls back to vertical thirds.
    """
    colors = [(255, 100, 100), (100, 255, 100), (100, 100, 255), (255, 200, 50), (180, 100, 255)]

    if zone_polygons:
        overlay = frame.copy()
        for i, (name, poly) in enumerate(zone_polygons.items()):
            color = colors[i % len(colors)]
            cv2.fillPoly(overlay, [poly], color)
        cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0, frame)
        for i, (name, poly) in enumerate(zone_polygons.items()):
            color = colors[i % len(colors)]
            cv2.polylines(frame, [poly], True, color, 2)
            cx = int(poly[:, 0].mean())
            cy = int(poly[:, 1].mean())
            count = zone_counts.get(name, 0)
            cv2.putText(frame, name, (cx - 30, cy - 8),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 2)
            cv2.putText(frame, str(count), (cx - 8, cy + 16),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)
    else:
        w3 = width // 3
        x_starts = [0, w3, 2 * w3]
        x_ends   = [w3, 2 * w3, width]
        overlay = frame.copy()
        for i, (name, count) in enumerate(zone_counts.items()):
            x0, x1 = x_starts[i], x_ends[i]
            cv2.rectangle(overlay, (x0, 0), (x1, height), colors[i], -1)
        cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0, frame)
        for i, (name, count) in enumerate(zone_counts.items()):
            cx = (x_starts[i] + x_ends[i]) // 2
            cv2.putText(frame, name, (cx - 30, 25),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, colors[i], 2)
            cv2.putText(frame, str(count), (cx - 8, 50),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, colors[i], 2)

    return frame


def draw_stats_panel(
    frame: np.ndarray,
    stats: dict,
) -> np.ndarray:
    """Overlay a small HUD in the top-right corner."""
    h, w = frame.shape[:2]
    panel_w, panel_h = 220, 130
    x0, y0 = w - panel_w - 10, 10

    overlay = frame.copy()
    cv2.rectangle(overlay, (x0, y0), (x0 + panel_w, y0 + panel_h), (20, 20, 20), -1)
    cv2.addWeighted(overlay, 0.6, frame, 0.4, 0, frame)

    lines = [
        f"Unique People : {stats.get('unique_people', 0)}",
        f"Entries       : {stats.get('entries', 0)}",
        f"Exits         : {stats.get('exits', 0)}",
        f"Inside Now    : {stats.get('currently_inside', 0)}",
        f"Shelf         : {stats.get('shelf_status', '...')}",
    ]
    for j, line in enumerate(lines):
        cv2.putText(frame, line, (x0 + 6, y0 + 20 + j * 22),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.42, (220, 220, 220), 1)

    return frame