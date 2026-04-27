# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Branch: ml-model-integration

Adds an `app/ml/` module to the NeedMap-AI FastAPI backend for rule-based ML features: volunteer–need matching, need priority scoring, and OCR-based paper survey extraction. Branched from `feature/backend-initial-work`.

## Stack

Python 3.11+, FastAPI, SQLAlchemy 2.0, PostgreSQL (Supabase), geopy, EasyOCR, numpy, pillow

## Setup & Run

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt   # includes easyocr — large first install (~500 MB PyTorch)
cp .env.example .env              # fill in DATABASE_URL, JWT_SECRET_KEY, OCR_USE_GPU
uvicorn app.main:app --reload
# Docs: http://localhost:8000/docs
```

## Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Supabase) |
| `JWT_SECRET_KEY` | JWT signing secret |
| `JWT_EXPIRE_MINUTES` | Token expiry (default 60) |
| `SQLALCHEMY_ECHO` | `true` to log SQL |
| `RUN_MIGRATIONS` | `true` to create tables on startup |
| `OCR_USE_GPU` | `true` (default) for GPU, `false` for CPU-only hosts |

## Architecture

```
backend/app/
├── ml/                          ← NEW — all ML logic, no DB I/O
│   ├── __init__.py              # re-exports 4 public functions
│   ├── priority.py              # Need priority scorer
│   ├── matching.py              # Volunteer–Need scorer + skill extraction from text
│   └── ocr.py                   # OCR pipeline (URL-based, EasyOCR singleton)
├── api/
│   ├── needs.py                 # +3 new ML endpoints + auto-triggers in existing routes
│   ├── assignments.py           # auto-populates match_score on create
│   └── volunteers.py            # auto-extracts skills from user description on create
├── schemas/need.py              # +4 new schemas
└── services/
    └── volunteer_service.py     # +list_volunteers_with_relations (with joinedload)
```

### ML Modules

**`app/ml/priority.py`** — `compute_priority_score(urgency, category, source_count, description, nearby_open_needs_count, days_since_created) -> float`
- Weights: urgency 35%, category 25%, source count 10%, keyword density 10%, geo-density 10%, age decay 10%
- Named constants: `MAX_SOURCES_FOR_FULL_SCORE = 5`, `KEYWORD_SATURATION_THRESHOLD = 3`

**`app/ml/matching.py`** — two public functions:
- `score_volunteers_for_need(volunteers, need) -> list[dict]` — composite score 0–100; weights: skill 40%, geo proximity 30%, reliability 20%, availability 10%
- `extract_skills_from_text(description: str) -> list[str]` — keyword scan against `SKILL_TAXONOMY`; returns canonical skill names

**`app/ml/ocr.py`** — `run_ocr_pipeline(image_url: str) -> dict`
- EasyOCR lazy singleton, GPU toggled by `OCR_USE_GPU` env var
- Accepts a public image URL (Supabase Storage / S3) — not raw bytes
- Returns `multimedia_txt` (raw text ≤500 chars) and `ai_extraction` (JSON ≤500 chars)

### New API Endpoints (all in `app/api/needs.py`)

| Method | Path | What |
|---|---|---|
| `GET` | `/needs/{id}/suggest-volunteers` | Ranked volunteer list with per-dimension scores |
| `POST` | `/needs/{id}/compute-priority` | Compute + save priority_score, returns NeedResponse |
| `POST` | `/needs/ocr-extract` | Image URL → OCR → structured extraction, optionally creates NeedSource |

**Route ordering:** `/needs/ocr-extract` is registered before `/{need_id}` — same pattern as the existing `/needs/heatmap` — to prevent FastAPI treating the static segment as an integer param.

### Auto-triggers (wired into existing routes, no new endpoints)

| Trigger | Action |
|---|---|
| `POST /needs` | Auto-computes `priority_score` |
| `PATCH /needs/{id}` | Recomputes `priority_score` if `urgency`, `category`, or `description` changed |
| `POST /volunteers` | Auto-extracts skills from user description via `extract_skills_from_text` |
| `POST /assignments` | Auto-computes `match_score` if not provided by caller |

### Existing ML hooks in schema (no migrations needed)

- `Need.priority_score` — populated by priority scorer
- `Assignment.match_score` — populated by matching scorer
- `NeedSource.multimedia_txt` — raw OCR text
- `NeedSource.ai_extraction` — structured JSON from OCR

## New Schemas (in `app/schemas/need.py`)

```python
VolunteerMatchResult        # per-volunteer score breakdown
SuggestVolunteersResponse   # need_id + scored_volunteers list
OCRExtractRequest           # image_url + optional need_id
OCRExtractionResponse       # source_id, structured fields, raw text
```

## Base Architecture (inherited from feature/backend-initial-work)

`Request → Router (api/) → ML (app/ml/, pure) → Service (services/) → ORM (models/) → PostgreSQL`

Auth: all protected routes use `get_current_user` from `core/dependencies.py`. Pass `Authorization: Bearer <token>`.

Full base API reference: [backend/docs/](backend/docs/)

## Worktree Layout

| Path | Branch |
|---|---|
| `../master` | master |
| `../dev` | dev |
| `../feat-adding-frontend` | feat-adding-frontend |
| `../feature-backend-initial-work` | feature/backend-initial-work (base for this branch) |
| `../feature-create-database0304` | feature/create-database0304 |
| `../ocr-benchmark` | ocr-benchmark |
| `../ocr-dataset-updates` | ocr-dataset-updates |
| `../ml-model-integration` | ml-model-integration (this branch) |
