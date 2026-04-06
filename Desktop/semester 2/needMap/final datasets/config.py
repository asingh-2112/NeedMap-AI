import os

# ── Paths ──────────────────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
DATA_DIR    = os.path.join(BASE_DIR, "data")
OUTPUT_DIR  = os.path.join(BASE_DIR, "outputs")
RESULTS_CSV = os.path.join(OUTPUT_DIR, "results.csv")

# ── Datasets ───────────────────────────────────────────────────────────
DATASETS = {
    "hindi":               {"path": os.path.join(DATA_DIR, "hindi"),               "lang": "hin"},
    "telugu":              {"path": os.path.join(DATA_DIR, "telugu"),              "lang": "tel"},
    "english_scanned":     {"path": os.path.join(DATA_DIR, "english_scanned"),     "lang": "eng"},
    "handwritten_english": {"path": os.path.join(DATA_DIR, "handwritten_english"), "lang": "eng"},
    "noisy_receipts":      {"path": os.path.join(DATA_DIR, "noisy_receipts"),      "lang": "eng"},
}

# ── Sampling ───────────────────────────────────────────────────────────
MAX_IMAGES = 15          # max images per dataset
IMAGE_EXTS  = {".jpg", ".jpeg", ".png", ".bmp", ".tiff"}

# ── Engines to run ─────────────────────────────────────────────────────
ENGINES = ["tesseract", "easyocr", "paddle", "doctr"]


