# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Branch: ocr-benchmark

OCR engine comparison tool for NeedMap-AI. Evaluates five OCR engines across multilingual and noisy datasets to choose the best engine for digitizing paper needs-assessment surveys.

## Stack

Python 3.x, pytesseract, EasyOCR, PaddleOCR, DocTR, Google Cloud Vision, OpenCV, pandas

## Setup & Run

```bash
pip install -r requirements.txt
# For Google Vision: set GOOGLE_APPLICATION_CREDENTIALS env var to your service account JSON
python benchmark.py
# Output: CSV file with columns: dataset, image, engine, time_sec, text
```

Note: PaddleOCR and DocTR have large model downloads on first run (~1GB+).

## Architecture

```
ocr-benchmark/
├── benchmark.py          # Entry point: load engines, iterate datasets, write CSV
├── requirements.txt
├── ocr_engines/
│   ├── tesseract_engine.py    # pytesseract wrapper
│   ├── easyocr_engine.py      # EasyOCR wrapper
│   ├── paddle_engine.py       # PaddleOCR wrapper
│   ├── doctr_engine.py        # DocTR wrapper
│   └── google_vision_engine.py # Google Cloud Vision wrapper
├── utils/
│   ├── metrics.py        # Text extraction helpers
│   └── sampler.py        # Random image sampling from dataset dirs
└── data/
    ├── 20_Hindi_Images/
    ├── 20_Telugu_Images/
    ├── english scanned forms/
    ├── handwritten english/
    └── noisy receipts/
```

### How It Works

`benchmark.py` loads all 5 engines, samples images from each dataset directory via `sampler.py`, runs every engine on every image with timing, and writes results to a CSV. Text output is truncated to 200 chars. The CSV is used to compare speed and quality across engines.

**No ground-truth / accuracy metrics in this branch** — for CER/WER evaluation see `ocr-dataset-updates`.

## Worktree Layout

| Path | Branch |
|---|---|
| `../master` | master — base branch |
| `../dev` | dev — backend skeleton |
| `../feat-adding-frontend` | feat-adding-frontend |
| `../feature-backend-initial-work` | feature/backend-initial-work |
| `../feature-create-database0304` | feature/create-database0304 |
| `../ocr-benchmark` | ocr-benchmark — this branch |
| `../ocr-dataset-updates` | ocr-dataset-updates (enhanced with CER/WER metrics) |
