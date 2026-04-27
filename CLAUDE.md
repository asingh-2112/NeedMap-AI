# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Branch: feature/backend-initial-work

The most complete backend implementation — full REST API with JWT authentication, Pydantic schemas, a service layer, and comprehensive docs. This is the reference implementation for the NeedMap-AI backend.

## Stack

Python 3.11+, FastAPI, SQLAlchemy 2.0, PostgreSQL (Supabase), JWT (python-jose), bcrypt (passlib)

## Setup & Run

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in DATABASE_URL and JWT_SECRET_KEY
uvicorn app.main:app --reload
# Interactive API docs: http://localhost:8000/docs
```

## Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Supabase) |
| `JWT_SECRET_KEY` | Secret for signing JWT tokens |
| `JWT_EXPIRE_MINUTES` | Token expiry (default 60) |
| `SQLALCHEMY_ECHO` | `true` to log SQL queries |
| `RUN_MIGRATIONS` | `true` to run `create_all` on startup |

## Architecture

```
backend/app/
├── main.py              # App factory, router registration, lifespan
├── core/
│   ├── config.py        # Settings loaded from .env via pydantic-settings
│   ├── database.py      # SQLAlchemy engine + session dependency
│   ├── security.py      # JWT encode/decode, password hashing
│   └── dependencies.py  # get_current_user FastAPI dependency
├── models/              # SQLAlchemy ORM (8 tables)
├── schemas/             # Pydantic request/response models
│   ├── user.py / organization.py / need.py
│   ├── volunteer.py / assignment.py
├── api/                 # FastAPI routers (one per resource)
│   ├── auth.py / users.py / organizations.py
│   ├── needs.py / volunteers.py / assignments.py
└── services/            # Business logic (called by routers)
    ├── auth_service.py / user_service.py / organization_service.py
    ├── need_service.py / volunteer_service.py / assignment_service.py
```

### Request Flow

`Request → Router (api/) → Service (services/) → ORM (models/) → PostgreSQL`

Routers handle HTTP, services handle business logic — keep them separate.

### Key API Surface

| Group | Notable Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Users | `PATCH /users/me`, `PATCH /users/me/location` |
| Organizations | `POST /organizations/register`, `POST /organizations/{id}/members` |
| Needs | `POST /needs`, `GET /needs/heatmap`, `PATCH /needs/{id}` |
| Need Sources | `POST /needs/{id}/sources`, `GET /needs/{id}/sources` |
| Volunteers | `POST /volunteers`, `PATCH /volunteers/{id}/skills/{sid}` |
| Assignments | `POST /assignments`, `PATCH /assignments/{id}/status`, `PATCH /assignments/{id}/feedback` |

### Auth Pattern

All protected routes use the `get_current_user` dependency from `core/dependencies.py`. Pass `Authorization: Bearer <token>` header. Tokens are issued at `/auth/login`.

### Domain Model

- **User** → roles: `owner`, `admin`, `volunteer`
- **Need** → categories: water, food, shelter, health, education, etc. + geolocation
- **Assignment** → status workflow: `proposed → accepted → in_progress → completed`

Full API reference is in [backend/docs/](backend/docs/).

## Worktree Layout

| Path | Branch |
|---|---|
| `../master` | master — base branch |
| `../dev` | dev — backend skeleton |
| `../feat-adding-frontend` | feat-adding-frontend |
| `../feature-backend-initial-work` | feature/backend-initial-work — this branch (most complete) |
| `../feature-create-database0304` | feature/create-database0304 |
| `../ocr-benchmark` | ocr-benchmark |
| `../ocr-dataset-updates` | ocr-dataset-updates |
