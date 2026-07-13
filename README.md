<div align="center">

# 🗺️ NeedMap AI

**AI-powered platform to identify, prioritize, and match community needs with volunteers in real time.**

[![Live Demo](https://img.shields.io/badge/Live-need--map--ai.vercel.app-blue?style=for-the-badge&logo=vercel)](https://need-map-ai.vercel.app/)
[![Google Solution Challenge 2026](https://img.shields.io/badge/Google%20Solution%20Challenge-2026-4285F4?style=for-the-badge&logo=google)](https://developers.google.com/community/gdsc-solution-challenge)

</div>

---

## 📌 Overview

**NeedMap AI** is a full-stack application built for the **Google Solution Challenge 2026** that leverages artificial intelligence to bridge the gap between community needs and volunteer resources. The platform enables organizations, coordinators, and volunteers to:

- 📍 **Map & visualize** community needs via interactive heatmaps
- 🤖 **AI-powered prioritization** — automatically scores need urgency using ML models
- 🧠 **Smart volunteer matching** — ranks volunteers based on skills, proximity, reliability, and availability
- 📄 **OCR extraction** — digitize paper surveys and handwritten need reports using image recognition (Gemini Vision)
- 📋 **End-to-end assignment workflow** — from need creation → volunteer matching → dispatch → completion

---

## 🏗️ Architecture

```
┌──────────────────────┐        HTTPS + JWT         ┌──────────────────────┐
│                      │ ◄───────────────────────►  │                      │
│   React Native /     │                            │   FastAPI Backend    │
│   Expo Frontend      │                            │                      │
│   (Vercel)           │                            │   ├─ API Routers     │
│                      │                            │   ├─ Services Layer  │
└──────────────────────┘                            │   ├─ ML Module       │
                                                    │   └─ ORM (SQLAlchemy)│
                                                    └──────────┬───────────┘
                                                               │
                                                    ┌──────────▼───────────┐
                                                    │  PostgreSQL 17       │
                                                    │  (Supabase)          │
                                                    └──────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React Native, Expo, TypeScript |
| **Backend** | Python 3.11+, FastAPI, SQLAlchemy 2.0 |
| **Database** | PostgreSQL 17 (Supabase) |
| **ML / AI** | Gemini 2.5 Flash (Google AI Studio), custom scoring models |
| **Auth** | JWT (Bearer tokens) |
| **Deployment** | Vercel (frontend), Render (backend) |

---

## ✨ Key Features

### 🔬 ML Module (`backend/app/ml/`)

| Module | Description |
|--------|-------------|
| **`priority.py`** | Scores need urgency (0–100) using weighted factors: urgency level, category, source count, keyword density, geo-density, and age decay |
| **`matching.py`** | Ranks volunteers for a need with composite scoring: skill match (40%), proximity (30%), reliability (20%), availability (10%) |
| **`ocr.py`** | Extracts structured data from images via Gemini Vision (single-hop — no intermediate EasyOCR) |
| **`llm_extraction.py`** | Unified multimodal extraction via Google AI Studio Gemini API (text, image, audio, PDF) |

### 📡 API Endpoints

| Area | Endpoints |
|------|-----------|
| **Auth** | Register, Login, Profile |
| **Users** | CRUD operations |
| **Organizations** | Create & manage NGOs |
| **Needs** | CRUD + heatmap + OCR extract + priority scoring + volunteer suggestions |
| **Volunteers** | CRUD + auto skill extraction from descriptions |
| **Assignments** | Create, update status, auto match-score |

---

## 🚀 Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- A Supabase project (PostgreSQL)

### Backend Setup

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # Fill in DATABASE_URL, JWT_SECRET_KEY
uvicorn app.main:app --reload
# API docs → http://localhost:8000/docs
```

### Frontend Setup

```bash
cd frontend
npm install
npx expo start
```

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string (Supabase) |
| `JWT_SECRET_KEY` | JWT signing secret |
| `JWT_EXPIRE_MINUTES` | Token expiry (default 60) |
| `RUN_MIGRATIONS` | `true` to auto-create tables on startup |
| `GEMINI_API_KEY` | Google AI Studio API key for Gemini LLM extraction |
| `LLM_MODEL` | Gemini model name (default `gemini-2.5-flash`) |

---

## 📂 Project Structure

```
NeedMap-AI/
├── backend/
│   ├── app/
│   │   ├── api/            # Route handlers
│   │   ├── core/           # Config, DB, auth, dependencies
│   │   ├── ml/             # ML models (priority, matching, OCR)
│   │   ├── models/         # SQLAlchemy ORM models
│   │   ├── schemas/        # Pydantic request/response schemas
│   │   └── services/       # Business logic layer
│   ├── scripts/            # DB reset & smoke tests
│   ├── tests/              # Unit & E2E tests
│   └── docs/               # API guides
├── frontend/
│   └── src/
│       ├── components/     # Reusable UI components
│       ├── context/        # Auth context
│       ├── navigation/     # App navigator
│       ├── screens/        # Auth & main screens
│       ├── services/       # API client & location
│       └── types/          # TypeScript type definitions
└── docs/                   # Architecture & contracts
```

---

## 🧪 Testing

```bash
cd backend
source venv/bin/activate
pytest tests/
```

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
