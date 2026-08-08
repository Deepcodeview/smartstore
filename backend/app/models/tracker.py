"""
tracker.py — Loop-Aware Identity Manager + ByteTrack Wrapper

Fixes over original:
- mark_dead is safe even if tracker_id not in active_map
- global_id array always same length as tracked detections
- prev_active cleanup keeps memory bounded
- TTL pruning of dead_tracks runs every frame (no unbounded growth)
"""

import time
import math
import numpy as np
from collections import deque

import supervision as sv


# ──────────────────────────────────────────────
# LOOP-AWARE IDENTITY MANAGER
# ──────────────────────────────────────────────
class LoopAwareIdentityManager:
    """
    Maps ByteTrack's short-lived local IDs → stable global IDs.
    When a track disappears and reappears nearby within `ttl` seconds,
    it gets the SAME global ID (no phantom-new-person counts).
    """

    def __init__(self, ttl: float = 15.0, dist_thresh: float = 120.0):
        self.ttl = ttl
        self.dist_thresh = dist_thresh

        self.dead_tracks: deque = deque()   # [{gid, center, time}]
        self.active_map: dict = {}          # local_tid → global_id
        self.next_global_id: int = 1

    # ── helpers ──────────────────────────────
    @staticmethod
    def _center(box):
        x1, y1, x2, y2 = box
        return ((x1 + x2) / 2.0, (y1 + y2) / 2.0)

    def _prune_dead(self):
        """Remove expired dead tracks so the deque stays bounded."""
        now = time.time()
        while self.dead_tracks and (now - self.dead_tracks[0]["time"]) > self.ttl:
            self.dead_tracks.popleft()

    # ── public API ───────────────────────────
    def assign_id(self, tracker_id: int, box) -> int:
        """Return a stable global ID for a (ByteTrack local id, box) pair."""
        if tracker_id in self.active_map:
            return self.active_map[tracker_id]

        self._prune_dead()
        now = time.time()
        cx, cy = self._center(box)

        best_match = None
        best_dist = float("inf")

        for item in self.dead_tracks:
            if (now - item["time"]) > self.ttl:
                continue
            px, py = item["center"]
            dist = math.hypot(cx - px, cy - py)
            if dist < self.dist_thresh and dist < best_dist:
                best_dist = dist
                best_match = item

        if best_match:
            gid = best_match["gid"]
            self.active_map[tracker_id] = gid
            self.dead_tracks.remove(best_match)
            return gid

        # Brand-new person
        gid = self.next_global_id
        self.next_global_id += 1
        self.active_map[tracker_id] = gid
        return gid

    def mark_dead(self, tracker_id: int, box) -> None:
        """Call when a track disappears from the frame."""
        if tracker_id not in self.active_map:
            return
        self.dead_tracks.append({
            "gid": self.active_map.pop(tracker_id),
            "center": self._center(box),
            "time": time.time(),
        })

    @property
    def total_unique(self) -> int:
        """Total unique global IDs ever assigned."""
        return self.next_global_id - 1


# ──────────────────────────────────────────────
# TRACKER WRAPPER
# ──────────────────────────────────────────────
class Tracker:
    """
    Wraps sv.ByteTrack + LoopAwareIdentityManager.
    Returns a sv.Detections object with an extra `.data["global_id"]` array.
    """

    def __init__(self):
        self.tracker = sv.ByteTrack()
        self.id_manager = LoopAwareIdentityManager()
        self.prev_active: dict = {}         # local_tid → box (ints)

    def update(self, detections: sv.Detections) -> sv.Detections:
        if len(detections) == 0:
            detections.tracker_id = np.array([], dtype=int)
            detections.data["global_id"] = np.array([], dtype=int)
            
            # Clean up all previous tracks as disappeared since frame is empty
            disappeared = set(self.prev_active)
            for tid in disappeared:
                self.id_manager.mark_dead(tid, self.prev_active[tid])
            self.prev_active = {}
            
            return detections

        tracked = self.tracker.update_with_detections(detections)

        current_active: dict = {}
        global_ids: list = []

        if len(tracked) > 0 and tracked.tracker_id is not None and len(tracked.tracker_id) == len(tracked):
            for box, tid in zip(tracked.xyxy, tracked.tracker_id):
                box_ints = list(map(int, box))
                tid_int = int(tid)

                gid = self.id_manager.assign_id(tid_int, box_ints)
                current_active[tid_int] = box_ints
                global_ids.append(gid)

            tracked.data["global_id"] = np.array(global_ids, dtype=int)
        else:
            tracked.tracker_id = None
            tracked.data["global_id"] = np.array([], dtype=int)

        # Mark disappeared tracks as dead
        disappeared = set(self.prev_active) - set(current_active)
        for tid in disappeared:
            self.id_manager.mark_dead(tid, self.prev_active[tid])

        self.prev_active = current_active
        return tracked

    @property
    def total_unique_people(self) -> int:
        return self.id_manager.total_unique