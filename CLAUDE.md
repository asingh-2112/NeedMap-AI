# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Branch: feature/create-database0304

Database schema setup branch. Contains the FastAPI backend focused on initializing the PostgreSQL schema. Structurally similar to `dev`; the primary deliverable of this branch was getting the database tables created and reviewed.

## Stack

Python 3.11+, FastAPI, SQLAlchemy 2.0, PostgreSQL (Supabase), Uvicorn

## Setup & Run

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in DATABASE_URL, set RUN_MIGRATIONS=true
uvicorn app.main:app --reload
```

Setting `RUN_MIGRATIONS=true` triggers `Base.metadata.create_all()` on startup, which creates all tables.

## Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Supabase) |
| `SQLALCHEMY_ECHO` | `true` to log SQL |
| `RUN_MIGRATIONS` | `true` to create tables on startup |

## Architecture

Same structure as `dev` — models-only backend with no API routes:

```
backend/app/
├── main.py       # FastAPI app + lifespan migration trigger
├── database.py   # Engine + session
└── models/       # 8 SQLAlchemy ORM tables
    ├── user.py / organization.py
    ├── need.py / need_source.py
    ├── volunteer.py / volunteer_skill.py
    ├── assignment.py / enums.py
```

For the full API implementation, see the `feature/backend-initial-work` worktree.

## Worktree Layout

| Path | Branch |
|---|---|
| `../master` | master — base branch |
| `../dev` | dev — backend skeleton |
| `../feat-adding-frontend` | feat-adding-frontend |
| `../feature-backend-initial-work` | feature/backend-initial-work (most complete backend) |
| `../feature-create-database0304` | feature/create-database0304 — this branch |
| `../ocr-benchmark` | ocr-benchmark |
| `../ocr-dataset-updates` | ocr-dataset-updates |
