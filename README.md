<div align="center">

# 🗺️ NeedMap AI

**AI-powered community response platform for mapping needs, managing organizations, matching volunteers, and tracking impact in real time.**

[![Live Demo](https://img.shields.io/badge/Live-need--map--ai.vercel.app-blue?style=for-the-badge&logo=vercel)](https://need-map-ai.vercel.app/)
[![Google Solution Challenge 2026](https://img.shields.io/badge/Google%20Solution%20Challenge-2026-4285F4?style=for-the-badge&logo=google)](https://developers.google.com/community/gdsc-solution-challenge)

</div>

---

## 📌 Overview

**NeedMap AI** is a full-stack application built for the **Google Solution Challenge 2026**. It helps NGOs, branch admins, coordinators, volunteers, and community users identify needs, prioritize urgent cases, assign volunteers, and monitor field impact through one connected platform.

The latest implementation includes role-based organization workflows, branch-scoped admin operations, realtime assignment notifications, volunteer ratings, frontend-only multilingual support, accessibility settings, heatmaps, analytics, and AI-assisted need extraction.

The platform enables teams to:

- 📍 **Map community needs** with interactive maps, branch markers, and heatmaps
- 🤖 **Prioritize urgent needs** with ML-backed priority scoring
- 🧠 **Match volunteers intelligently** using skills, distance, reliability, and availability
- 📄 **Extract need details** from text, images, PDFs, audio, CSV files, and OCR pipelines
- 🏢 **Manage organizations and branches** with owner/admin separation
- 📡 **Coordinate in real time** with WebSocket updates and notification prompts
- ⭐ **Rate and review volunteer work** after completed assignments
- 🌐 **Support multiple frontend languages** without changing backend data
- ♿ **Improve accessibility** with text scaling, high contrast, reduced motion, screen-reader labels, and larger touch targets

---

## 🏗️ Architecture

```text
┌──────────────────────────────┐        HTTPS + JWT        ┌──────────────────────────────┐
│                              │ ◄───────────────────────► │                              │
│   React Native / Expo Web    │                           │       FastAPI Backend        │
│   TypeScript Frontend        │                           │                              │
│                              │                           │   ├─ API Routers             │
│   ├─ Role-based screens      │                           │   ├─ Services Layer          │
│   ├─ Realtime context        │                           │   ├─ ML / AI Module          │
│   ├─ Accessibility context   │                           │   ├─ WebSocket Notifications │
│   ├─ Language context        │                           │   └─ SQLAlchemy ORM          │
│   └─ Toast + theme context   │                           │                              │
└──────────────────────────────┘                           └──────────────┬───────────────┘
                                                                           │
                                                               ┌───────────▼───────────┐
                                                               │    PostgreSQL 17      │
                                                               │    Supabase / Render  │
                                                               └───────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React Native, Expo, React Native Web, TypeScript |
| **Backend** | Python 3.11+, FastAPI, SQLAlchemy 2.0, Pydantic |
| **Database** | PostgreSQL 17 / Supabase |
| **ML / AI** | Gemini Vision API, OCR pipeline, custom priority and matching models |
| **Auth** | JWT bearer tokens, role-based access |
| **Realtime** | FastAPI WebSockets, frontend realtime context |
| **Deployment** | Vercel frontend, Render backend |

---

## ✨ Current Features

### Role-Based App Experience

| Role | Capabilities |
|------|--------------|
| **Owner** | Manage the root organization, create branches, assign branch admins, view all branch analytics, monitor organization-wide needs and completion performance |
| **Admin** | Manage needs and assignments only for the assigned branch, view branch-scoped analytics, receive completed-assignment rating prompts |
| **Volunteer** | Browse active and nearby needs, receive assignment proposals, accept/decline work, track assignment status, submit feedback after completion |
| **User / Community Reporter** | Create or report needs with location, category, urgency, and supporting details |

### Organization And Branch Management

- Owner can create active branch organizations
- Each branch has its own name, location, address, phone, and admin account
- Admin accounts are scoped through `managed_branch_id`
- Owner-level workflows remain separate from branch-admin workflows
- Branch detail pages show admin details, branch status, location, and reference IDs

### Need Creation And Management

- Create needs with description, category, custom category, urgency, affected count, full address, and coordinates
- View organization or branch-specific needs depending on role
- Filter volunteer needs by organization, branch, assignment state, and location
- Open full need detail pages with status, assigned volunteers, priority score, timestamps, category, and location
- Delete needs where permitted

### AI And Data Extraction

| Module | Description |
|--------|-------------|
| `priority.py` | Scores need urgency from urgency level, category, source count, keyword density, geo-density, and age decay |
| `matching.py` | Ranks volunteers with skill match, proximity, reliability, and availability scoring |
| `ocr.py` | Extracts structured data from images and paper reports |
| `llm_extraction.py` | Uses Gemini Vision for structured data extraction from uploaded images |

Supported ingestion paths include:

- Manual need creation
- Text field notes
- Voice/audio transcription input
- Image OCR input
- PDF input
- CSV upload and CSV source tracking

### Volunteer Matching And Assignments

- Backend assignment workflow from proposed to accepted, in progress, completed, cancelled, or declined
- Auto match-score support for volunteers
- Volunteer-facing assignment proposal modal
- Admin/owner assignment status updates
- Volunteer feedback after completed work
- Admin rating flow for completed volunteer assignments
- Volunteer rating is reflected on the volunteer home screen

### Realtime Notifications

- WebSocket endpoint for notification events
- Realtime refresh counters for needs, assignments, volunteer ratings, and statistics
- Live assignment proposal prompts for volunteers
- Completed-assignment rating prompts for admins
- Dashboard refresh after need creation, assignment status change, and rating update

### Maps, Heatmaps, And Analytics

- Interactive map view for organization needs, volunteers, and branches
- Heatmap and area clusters for high-need locations
- Owner branch map with branch markers
- Need popups with translated labels, category, urgency, status, and address
- Statistics dashboard with:
  - All needs / branch needs
  - Open load
  - Completed percentage
  - Urgent open needs
  - Affected people
  - Average priority
  - Workload mix
  - Branch completion details
  - Urgency load
  - New needs this week
  - Category distribution
  - Top organization or branch areas

### Articles, Campaigns, Stories, And Camps

- Organization articles and campaigns through the Feeds screen
- Create, edit, delete, and display organization content
- Story highlights and story detail pages
- Updated camps screen generated from active need/camp data
- Scheme cards for support programs

### Accessibility

Accessibility is available globally across roles and pages through the frontend accessibility context.

- Text size controls
- High contrast mode
- Reduced motion support
- Screen-reader optimized labels and hints
- Larger touch targets
- Device accessibility status awareness
- Reset accessibility settings

### Multilingual Frontend

Frontend-only multilingual support is implemented without changing backend/database data.

Supported languages:

- English
- Hindi
- Marathi
- Tamil
- Telugu
- Kannada

Localized areas include:

- Navigation titles and tab labels
- Forms, buttons, validation messages, and empty states
- Need cards and need detail labels
- Organization and branch cards
- Assignment and notification modals
- Analytics headings and completion labels
- Common address fragments and seeded/demo need data

> Note: Backend data remains stored in its original language. The frontend translates known labels, seeded/demo values, statuses, categories, and common address fragments at render time.

---

## 📡 API Areas

| Area | Capabilities |
|------|--------------|
| **Auth** | Register, login, profile, JWT authentication |
| **Users** | User CRUD and profile operations |
| **Organizations** | Organization creation, branch creation, branch admin assignment, branch details |
| **Needs** | CRUD, heatmap data, file ingestion, OCR extraction, priority scoring, volunteer suggestions |
| **Volunteers** | Volunteer profiles, skills, availability, ratings, location data |
| **Assignments** | Create assignments, update status, feedback, ratings, match-score workflow |
| **Notifications** | Notification records and realtime event support |
| **Analytics** | Organization and branch statistics |
| **Campaigns** | Campaign content management |
| **Stories** | Story and article content management |
| **Nominations** | Nomination workflows |
| **WebSocket** | Live notification stream for frontend realtime refresh |

---

## 🚀 Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL / Supabase database
- Optional Google API key for Gemini Vision extraction

### Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Fill the required environment variables in `.env`, then start the API:

```bash
RUN_MIGRATIONS=true python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

API docs are available at:

```text
http://localhost:8000/docs
```

### Frontend Setup

```bash
cd frontend
npm install
npx expo start --web --port 19006
```

### TypeScript Validation

```bash
cd frontend
npx tsc --noEmit
```

### Backend Tests

```bash
cd backend
source venv/bin/activate
pytest tests/
```

---

## 🔐 Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET_KEY` | JWT signing secret |
| `JWT_EXPIRE_MINUTES` | Token expiry window |
| `RUN_MIGRATIONS` | Set to `true` to auto-create tables on startup |
| `OCR_USE_GPU` | Set to `true` for GPU OCR or `false` for CPU hosts |
| `GOOGLE_API_KEY` | Gemini API key for vision/extraction |

---

## 📂 Project Structure

```text
NeedMap-AI/
├── backend/
│   ├── app/
│   │   ├── api/            # Auth, users, organizations, needs, assignments, analytics, notifications, websocket
│   │   ├── core/           # Config, database, dependencies, security
│   │   ├── ml/             # Priority scoring, matching, OCR, Gemini extraction
│   │   ├── models/         # SQLAlchemy ORM models
│   │   ├── schemas/        # Pydantic request/response schemas
│   │   └── services/       # Business logic and realtime event services
│   ├── docs/               # Backend API guides
│   ├── tests/              # Unit and E2E tests
│   └── requirements.txt
├── frontend/
│   ├── App.tsx
│   └── src/
│       ├── components/     # Reusable UI components
│       ├── context/        # Auth, accessibility, language, realtime, theme, toast contexts
│       ├── navigation/     # Stack and tab navigation
│       ├── screens/        # Auth, dashboard, needs, orgs, assignments, statistics, feeds, profile
│       ├── services/       # API client, location, toast helpers
│       └── types/          # TypeScript API types
├── docs/                   # Architecture and IO contracts
├── render.yaml             # Render deployment config
└── README.md
```

---

## 🧪 Validation Status

Recent frontend validation:

```bash
cd frontend
npx tsc --noEmit
```

Expected result: no TypeScript errors.

---

## 🌐 Live Demo

👉 **[https://need-map-ai.vercel.app/](https://need-map-ai.vercel.app/)**

---

## 📄 License

This project was built for the **Google Solution Challenge 2026**.

---

<div align="center">
  Made with ❤️ by the NeedMap AI Team
</div>
