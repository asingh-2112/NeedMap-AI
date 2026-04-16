# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Branch: ocr-dataset-updates

Enhanced OCR benchmarking — production-ready evaluation tool with CER/WER accuracy metrics, centralized config, base-class engine design, and Excel reporting. Builds on `ocr-benchmark`.

## Stack

Python 3.x, pytesseract, EasyOCR, PaddleOCR, DocTR (torch backend), OpenCV, pandas, openpyxl

## Setup & Run

```bash
pip install -r requirements.txt
python benchmark.py        # Run benchmark → outputs/results.csv
python excel_report.py     # Generate formatted Excel report from results.csv
```

Note: PaddleOCR and DocTR download large models (~1GB+) on first run.

## Architecture

```
final datasets/
├── benchmark.py      # Entry point: load config/engines, run, save CSV
├── config.py         # DATASETS dict, MAX_IMAGES=15, ENGINES list
├── metrics.py        # CER and WER calculation (jiwer / edit distance)
├── excel_report.py   # Read results.csv → formatted .xlsx report
├── requirements.txt
├── engines/
│   ├── base.py            # Abstract OCREngine base class
│   ├── tesseract_engine.py
│   ├── easyocr_engine.py
│   ├── paddle_engine.py
│   └── doctr_engine.py
├── data/              # Dataset image directories
└── outputs/           # results.csv written here
```

### Key Differences from ocr-benchmark

| Feature | ocr-benchmark | ocr-dataset-updates |
|---|---|---|
| Engines | 5 (incl. Google Vision) | 4 (no Google Vision) |
| Engine design | Standalone files | Abstract base class |
| Accuracy metrics | None | CER + WER via `metrics.py` |
| Config | Hardcoded | Centralized `config.py` |
| Output | CSV only | CSV + Excel report |
| Max images/dataset | All | 15 (configurable) |

### Configuration

Edit [config.py](config.py) to change datasets, engine selection, or `MAX_IMAGES`.

### Benchmark Flow

1. `config.py` defines datasets and engines to run
2. `benchmark.py` initializes engines, samples up to `MAX_IMAGES` per dataset
3. Each engine processes each image; timing and extracted text are recorded
4. `metrics.py` computes CER/WER if ground-truth is available
5. Results written to `outputs/results.csv`
6. `excel_report.py` converts the CSV to a formatted Excel workbook

## Worktree Layout

| Path | Branch |
|---|---|
| `../../../../../../../master` | master — base branch |
| `../../../../../../../dev` | dev — backend skeleton |
| `../../../../../../../feat-adding-frontend` | feat-adding-frontend |
| `../../../../../../../feature-backend-initial-work` | feature/backend-initial-work |
| `../../../../../../../feature-create-database0304` | feature/create-database0304 |
| `../../../../../../../ocr-benchmark` | ocr-benchmark (basic version) |
| `../../../../../../../ocr-dataset-updates` | ocr-dataset-updates — this branch |
