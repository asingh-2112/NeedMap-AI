import os
import time
import pandas as pd
from utils.sampler import sample_images

# OCR engines
from ocr_engines.tesseract_engine import run_tesseract
from ocr_engines.easyocr_engine import run_easyocr
from ocr_engines.paddle_engine import run_paddle
from ocr_engines.doctr_engine import run_doctr
# from ocr_engines.google_vision_engine import run_google

# Paths
DATA_PATH = "./data"
OUTPUT_PATH = "./outputs/predictions"

os.makedirs(OUTPUT_PATH, exist_ok=True)

print("Script started")

# Engines dictionary
ENGINES = {
    "tesseract": run_tesseract,
    "easyocr": run_easyocr,
    "paddle": run_paddle,
    "doctr": run_doctr,
    # "google": run_google,
}

results = []

# Check datasets
datasets = os.listdir(DATA_PATH)
print("Datasets found:", datasets)

for dataset in datasets:
    folder = os.path.join(DATA_PATH, dataset)

    if not os.path.isdir(folder):
        continue

    print(f"\nProcessing dataset: {dataset}")

    images = sample_images(folder)

    print(f"Images found: {len(images)}")

    if len(images) == 0:
        print("No images found, skipping...")
        continue

    # Language selection (simple logic)
    if "hindi" in dataset.lower():
        lang = "hin"
    elif "telugu" in dataset.lower():
        lang = "tel"
    else:
        lang = "eng"

    for img in images:
        print(f"\nImage: {img}")

        for name, func in ENGINES.items():
            print(f"Running {name}...")

            start = time.time()

            try:
                if name == "tesseract":
                    text = func(img, lang=lang)
                elif name == "easyocr":
                    text = func(img, dataset)
                else:
                    text = func(img)

                time_taken = round(time.time() - start, 3)

                results.append({
                    "dataset": dataset,
                    "image": os.path.basename(img),
                    "engine": name,
                    "time_sec": time_taken,
                    "text": text[:200]
                })

                print(f"{name} done in {time_taken}s")

            except Exception as e:
                print(f"Error in {name}: {e}")

# Save results
if len(results) > 0:
    df = pd.DataFrame(results)
    output_file = os.path.join(OUTPUT_PATH, "results.csv")
    df.to_csv(output_file, index=False)
    print(f"\nBenchmark completed! Results saved to {output_file}")
else:
    print("\nNo results generated. Check dataset/images.")