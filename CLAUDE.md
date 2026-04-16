# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Branch: dev

Backend skeleton for NeedMap-AI — a volunteer-and-needs matching platform. This branch contains the database models and app bootstrap; API routes are not yet implemented (see `feature/backend-initial-work` for the full implementation).

## Stack

- Python 3.11+, FastAPI, SQLAlchemy 2.0, PostgreSQL (Supabase), Uvicorn

## Setup & Run

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in DATABASE_URL
uvicorn app.main:app --reload
```

Health check: `GET /` and `GET /health`

## Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Supabase) |
| `SQLALCHEMY_ECHO` | Set `true` to log SQL queries |
| `RUN_MIGRATIONS` | Set `true` to run `create_all` on startup |

## Architecture

```
backend/app/
├── main.py          # FastAPI app + lifespan (runs migrations on startup)
├── database.py      # SQLAlchemy engine, session, Base
└── models/          # ORM models only — no API routes yet
    ├── user.py
    ├── organization.py
    ├── need.py / need_source.py
    ├── volunteer.py / volunteer_skill.py
    ├── assignment.py
    └── enums.py     # Role, NeedCategory, AssignmentStatus enums
```

### Domain Model

- **User** — platform accounts with roles (`owner`, `admin`, `volunteer`)
- **Organization** — groups that post needs
- **Need** — a resource need (water, food, shelter, health, education, etc.) with geolocation
- **NeedSource** — evidence/source links for a need
- **Volunteer** — user volunteering profile with location and availability
- **VolunteerSkill** — skills attached to a volunteer
- **Assignment** — links a volunteer to a need; workflow: `proposed → accepted → in_progress → completed`

## Worktree Layout

| Path | Branch |
|---|---|
| `../master` | master — base branch |
| `../dev` | dev — this branch |
| `../feat-adding-frontend` | feat-adding-frontend |
| `../feature-backend-initial-work` | feature/backend-initial-work (most complete backend) |
| `../feature-create-database0304` | feature/create-database0304 |
| `../ocr-benchmark` | ocr-benchmark |
| `../ocr-dataset-updates` | ocr-dataset-updates |
