"""
config.py — Centralised configuration for the Retail AI backend.
"""

import os

# ── Directories ───────────────────────────────
BASE_DIR    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_DIR  = os.path.join(BASE_DIR, "temp")
OUTPUT_DIR  = os.path.join(BASE_DIR, "outputs")

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ── Model paths ───────────────────────────────
PERSON_MODEL_PATH = "yolov8n.pt"                        # auto-downloaded by ultralytics
SHELF_MODEL_PATH  = os.path.join(BASE_DIR, "app", "models", "best.pt")

# ── Detection thresholds ─────────────────────
PERSON_CONF     = 0.35          # lowered: retail video has partial occlusions
SHELF_CONF      = 0.25
PERSON_CLASS_ID = 0             # COCO class 0 = person

# ── Tracking ─────────────────────────────────
IDENTITY_TTL         = 15.0    # seconds before a dead track is forgotten
IDENTITY_DIST_THRESH = 150.0   # increased: 1280px wide frame, people move more

# ── Footfall line ────────────────────────────
# Retails.mp4: camera is top-down/angled, store entrance likely bottom third
FOOTFALL_LINE_RATIO = 0.65     # 65% down the frame = near store entrance area

# ── Video output ─────────────────────────────
SAVE_ANNOTATED_VIDEO = True
ANNOTATION_SKIP_FRAMES = 1     # annotate every N frames (1 = all, 2 = every other)