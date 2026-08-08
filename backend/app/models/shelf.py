"""
shelf.py — Shelf occupancy detector.

CRITICAL FIX over original:
  - space_a  = available shelf space  (empty/vacant slot)
  - space_na = not-available / occupied slot (product IS there)

  Original code treated space_na as "occupied" and returned "NORMAL"
  when most slots were occupied — CORRECT so far — but the thresholds
  were applied to occupancy = space_na / total, which means:
    • occupancy > 0.7 → shelves mostly full → "NORMAL"   ✓
    • occupancy > 0.4 → partially stocked   → "LOW STOCK" ✓
    • else            → mostly empty        → "EMPTY"     ✓

  This is actually the right direction, BUT the labels in the original
  returned the KEY of shelf_accumulator (lowercase), not the display string.
  That's why the frontend saw "normal" instead of "NORMAL" or "No shelf detected".

  This version:
  - Returns clean enum strings: "NORMAL" | "LOW STOCK" | "EMPTY" | "NO SHELF DETECTED"
  - Handles zero-detection frames correctly (no shelf in view)
  - Exposes confidence score for debugging
"""

from ultralytics import YOLO


# Map label → occupancy contribution
_LABEL_IS_OCCUPIED = {
    "space_na": True,   # space NOT available → product present → occupied
    "space_a":  False,  # space available     → empty slot
}

# Thresholds
_THRESHOLD_NORMAL    = 0.70   # ≥70% occupied → NORMAL
_THRESHOLD_LOW_STOCK = 0.40   # ≥40% occupied → LOW STOCK  (else EMPTY)


class ShelfDetector:
    def __init__(self, model: YOLO):
        self.model = model

    def detect(self, frame) -> dict:
        """
        Run shelf detection on a single frame.

        Returns:
            {
                "status":     "NORMAL" | "LOW STOCK" | "EMPTY" | "NO SHELF DETECTED",
                "occupied":   int,
                "available":  int,
                "occupancy":  float (0–1),
                "confidence": float (avg detection confidence)
            }
        """
        results = self.model(frame, conf=0.25, verbose=False, device="cpu")[0]
        boxes = results.boxes
        names = results.names

        occupied = 0
        available = 0
        confs = []

        if boxes is not None and len(boxes) > 0:
            for cls, conf in zip(boxes.cls, boxes.conf):
                label = names[int(cls)]
                confs.append(float(conf))

                if label == "space_na":
                    occupied += 1
                elif label == "space_a":
                    available += 1
                # ignore unknown labels

        total = occupied + available

        if total == 0:
            return {
                "status": "NO SHELF DETECTED",
                "occupied": 0,
                "available": 0,
                "occupancy": 0.0,
                "confidence": 0.0,
            }

        occupancy = occupied / total
        avg_conf = sum(confs) / len(confs) if confs else 0.0

        if occupancy >= _THRESHOLD_NORMAL:
            status = "NORMAL"
        elif occupancy >= _THRESHOLD_LOW_STOCK:
            status = "LOW STOCK"
        else:
            status = "EMPTY"

        return {
            "status": status,
            "occupied": occupied,
            "available": available,
            "occupancy": round(occupancy, 3),
            "confidence": round(avg_conf, 3),
        }