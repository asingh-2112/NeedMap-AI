import os
import time
import csv
import traceback

from config import DATASETS, MAX_IMAGES, IMAGE_EXTS, ENGINES, OUTPUT_DIR, RESULTS_CSV
from metrics import character_error_rate, word_error_rate

from engines.tesseract_engine import TesseractEngine
from engines.easyocr_engine   import EasyOCREngine
from engines.paddle_engine    import PaddleEngine
from engines.doctr_engine     import DoctrEngine

# ── Engine registry ────────────────────────────────────────────────────
ENGINE_MAP = {
    "tesseract": TesseractEngine,
    "easyocr":   EasyOCREngine,
    "paddle":    PaddleEngine,
    "doctr":     DoctrEngine,
}

# ── CSV columns ────────────────────────────────────────────────────────
COLUMNS = [
    "dataset", "image", "engine",
    "time_sec", "text_length",
    "predicted_text",
]

def get_images(folder: str) -> list:
    """Return up to MAX_IMAGES image paths from a folder."""
    files = [
        os.path.join(folder, f)
        for f in sorted(os.listdir(folder))
        if os.path.splitext(f)[1].lower() in IMAGE_EXTS
    ]
    return files[:MAX_IMAGES]

def run_benchmark():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Load all engines once
    print("\n🔧 Loading engines...")
    engines = {}
    for name in ENGINES:
        if name not in ENGINE_MAP:
            print(f"  ⚠ Skipping unknown engine: {name}")
            continue
        try:
            engine = ENGINE_MAP[name]()
            engine.load()
            engines[name] = engine
            print(f"  ✅ {name} loaded")
        except Exception as e:
            print(f"  ❌ {name} failed to load: {e}")

    if not engines:
        print("No engines loaded. Exiting.")
        return

    # Open CSV and start benchmarking
    with open(RESULTS_CSV, "w", newline="", encoding="utf-8") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=COLUMNS)
        writer.writeheader()

        for dataset_name, info in DATASETS.items():
            folder = info["path"]
            lang   = info["lang"]

            if not os.path.isdir(folder):
                print(f"\n⚠ Skipping {dataset_name}: folder not found")
                continue

            images = get_images(folder)
            if not images:
                print(f"\n⚠ Skipping {dataset_name}: no images found")
                continue

            print(f"\n📂 Dataset: {dataset_name} ({len(images)} images, lang={lang})")

            for img_path in images:
                img_name = os.path.basename(img_path)

                for eng_name, engine in engines.items():
                    print(f"   🔍 {eng_name:<12} ← {img_name}", end="", flush=True)

                    try:
                        start = time.time()
                        text  = engine.run(img_path, lang)
                        elapsed = round(time.time() - start, 3)
                    except Exception:
                        text    = "ERROR"
                        elapsed = 0.0
                        traceback.print_exc()

                    writer.writerow({
                        "dataset":        dataset_name,
                        "image":          img_name,
                        "engine":         eng_name,
                        "time_sec":       elapsed,
                        "text_length":    len(text),
                        "predicted_text": text.replace("\n", " "),
                    })

                    print(f"  ✅ {elapsed}s  ({len(text)} chars)")

    print(f"\n✅ Done! Results saved to: {RESULTS_CSV}")

if __name__ == "__main__":
    run_benchmark()