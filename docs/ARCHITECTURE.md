# NeedMap-AI — System Architecture

## High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT (Frontend)                            │
│                                                                     │
│   React Native / Expo                                               │
│   ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐  │
│   │  Auth Screen  │   │  Need Map    │   │  Volunteer Dashboard  │  │
│   │  (Firebase)   │   │  (Heatmap)   │   │  (Assignments Feed)  │  │
│   └──────┬───────┘   └──────┬───────┘   └──────────┬───────────┘  │
│          │                  │                        │              │
│   ┌──────▼──────────────────▼────────────────────────▼──────────┐  │
│   │                    Redux Store                               │  │
│   │    auth slice │ needs slice │ volunteers slice │ org slice   │  │
│   └──────────────────────────┬───────────────────────────────────┘  │
└─────────────────────────────┼───────────────────────────────────────┘
                               │ HTTPS  +  Authorization: Bearer <JWT>
                               │
┌─────────────────────────────▼───────────────────────────────────────┐
│                        FASTAPI BACKEND                               │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                      API Layer (Routers)                       │  │
│  │                                                                │  │
│  │  /auth      /users     /organizations    /needs               │  │
│  │  /volunteers            /assignments                          │  │
│  └───────────────────────────┬───────────────────────────────────┘  │
│                               │                                      │
│          ┌────────────────────┼────────────────────┐                │
│          │                    │                     │                │
│  ┌───────▼──────┐   ┌────────▼────────┐   ┌───────▼──────────┐    │
│  │  Auth        │   │  Business Logic  │   │   ML Layer       │    │
│  │  Middleware  │   │  (Services)      │   │  (Pure Python)   │    │
│  │              │   │                  │   │                   │    │
│  │  JWT decode  │   │  need_service    │   │  priority.py      │    │
│  │  get_current │   │  volunteer_svc   │   │  matching.py      │    │
│  │  _user()     │   │  assignment_svc  │   │  ocr.py           │    │
│  │              │   │  org_service     │   │                   │    │
│  └──────────────┘   └────────┬────────┘   └───────┬──────────┘    │
│                               │                     │               │
│                    ┌──────────▼─────────────────────▼────────────┐ │
│                    │             ORM Layer (SQLAlchemy 2.0)       │ │
│                    │  User │ Org │ Need │ NeedSource │ Volunteer  │ │
│                    │  VolunteerSkill │ Assignment                  │ │
│                    └──────────────────────┬──────────────────────┘ │
└───────────────────────────────────────────┼────────────────────────┘
                                            │ TCP / SSL
                                            │
                               ┌────────────▼────────────┐
                               │   PostgreSQL (Supabase)  │
                               │                          │
                               │  users                   │
                               │  organizations           │
                               │  needs                   │
                               │  need_sources            │
                               │  volunteers              │
                               │  volunteer_skills        │
                               │  assignments             │
                               └──────────────────────────┘
```

---

## Request Lifecycle

```
Frontend                  FastAPI                    Services                  ML / DB
   │                         │                           │                        │
   │  POST /needs  ──────────►│                           │                        │
   │  (+ Bearer token)        │                           │                        │
   │                          │── get_current_user() ────►│                        │
   │                          │◄─ User or 401 ───────────│                        │
   │                          │                           │                        │
   │                          │── create_need() ─────────►│                        │
   │                          │                           │── INSERT Need ─────────►│
   │                          │                           │◄─ Need ORM obj ────────│
   │                          │                           │                        │
   │                          │── count_nearby_open() ───►│                        │
   │                          │◄─ int ───────────────────│                        │
   │                          │                           │                        │
   │                          │── compute_priority_score()─────────────────────────►│ (pure fn)
   │                          │◄─ float (0–100) ──────────────────────────────────│
   │                          │                           │                        │
   │                          │── set_priority_score() ──►│                        │
   │                          │                           │── UPDATE Need ─────────►│
   │                          │                           │◄─ Need ────────────────│
   │                          │◄─ NeedResponse ──────────│                        │
   │◄─ 201 NeedResponse ──────│                           │                        │
```

---

## Domain Model & Relationships

```
Organization  ◄──────────── User  (organization_id FK, nullable)
     │                       │
     │                       │ created_by FK
     │                       ▼
     │ 1                   Need  ──────────── NeedSource  (images, forms, surveys)
     └──► N                  │                    │
                             │                    └─ multimedia_txt  (OCR raw text)
                             │                    └─ ai_extraction   (OCR JSON)
                             │
                             │ N             N
                   Assignment (join) ◄──────── Volunteer
                             │                    │
                             └─ match_score (ML)  └─ VolunteerSkill (skill_name + proficiency)
                             └─ status lifecycle  └─ rating, tasks_completed, verified
```

---

## ML Integration Points

```
                    ┌─────────────────────────────────────────┐
                    │           app/ml/  (No DB I/O)          │
                    │                                          │
                    │  priority.py                             │
                    │  ┌──────────────────────────────────┐   │
                    │  │ compute_priority_score(           │   │
                    │  │   urgency, category,              │   │
                    │  │   source_count, description,      │   │
                    │  │   nearby_open_needs, days         │   │
                    │  │ ) → float 0–100                   │   │
                    │  └──────────────────────────────────┘   │
                    │                                          │
                    │  matching.py                             │
                    │  ┌──────────────────────────────────┐   │
                    │  │ score_volunteers_for_need(        │   │
                    │  │   volunteers, need                │   │
                    │  │ ) → list[{volunteer_id, scores}]  │   │
                    │  │                                   │   │
                    │  │ extract_skills_from_text(         │   │
                    │  │   bio_text                        │   │
                    │  │ ) → list[canonical_skill_name]    │   │
                    │  └──────────────────────────────────┘   │
                    │                                          │
                    │  ocr.py                                  │
                    │  ┌──────────────────────────────────┐   │
                    │  │ run_ocr_pipeline(                 │   │
                    │  │   image_url                       │   │
                    │  │ ) → {multimedia_txt,              │   │
                    │  │       ai_extraction,              │   │
                    │  │       structured}                 │   │
                    │  └──────────────────────────────────┘   │
                    └─────────────────────────────────────────┘

Auto-trigger map:

  POST /needs          ──► compute_priority_score()   → Need.priority_score
  PATCH /needs/{id}    ──► compute_priority_score()   → Need.priority_score
                           (only if urgency | category | description changed)
  POST /volunteers     ──► extract_skills_from_text() → VolunteerSkill rows
  POST /assignments    ──► score_volunteers_for_need() → Assignment.match_score
                           (only if match_score not provided by caller)
```

---

## Authentication Flow

```
  Client                            Backend
    │                                  │
    │  POST /auth/register ───────────►│
    │  or POST /organizations/register │── hash_password(bcrypt)
    │                                  │── INSERT User + optional Org
    │◄─ 201 { user, access_token } ───│── create_access_token(user_id, HS256)
    │                                  │
    │  POST /auth/login ──────────────►│
    │                                  │── verify_password()
    │◄─ 200 { access_token } ─────────│── create_access_token()
    │                                  │
    │  GET /auth/me ──────────────────►│
    │  Authorization: Bearer <token>   │── decode_access_token() → user_id
    │                                  │── SELECT User WHERE id=user_id
    │◄─ 200 UserResponse ─────────────│   (401 if expired/invalid, 403 if inactive)
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React Native / Expo, Redux, Firebase Auth |
| API Framework | FastAPI 0.115, Python 3.11+ |
| Validation | Pydantic v2 |
| ORM | SQLAlchemy 2.0 |
| Database | PostgreSQL (Supabase) |
| Auth | JWT (python-jose, HS256), bcrypt (passlib) |
| ML — OCR | EasyOCR + PyTorch (lazy singleton, GPU optional) |
| ML — Geo | geopy (geodesic distance) |
| ASGI Server | uvicorn |

---

## Key Design Rules

- **ML functions are pure** — no DB calls inside `app/ml/`. Routers fetch primitives, pass them in, then delegate persistence to service layer.
- **Route ordering** — static paths (`/heatmap`, `/ocr-extract`) are registered before `/{need_id}` to prevent FastAPI casting string literals as integers.
- **Lazy imports** — `geopy` and `easyocr` are imported inside their first-call function (not at module level) to prevent startup failures on environments without those packages.
- **EasyOCR singleton** — `_reader` is a module-level global initialised once (~5–10 s, ~200 MB). Subsequent OCR calls are fast.
- **Roles** — Only `OWNER` and `ADMIN` can create assignments. All other protected routes require any authenticated user.
