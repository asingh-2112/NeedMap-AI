# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Branch: feat-adding-frontend

Full-stack branch adding the React Native/Expo mobile frontend on top of the FastAPI backend. This is the only branch containing the frontend.

## Stack

**Backend:** Python 3.11+, FastAPI, SQLAlchemy 2.0, PostgreSQL (Supabase), Uvicorn  
**Frontend:** React Native (Expo ~54), Redux Toolkit, React Navigation v6, Firebase (auth + Firestore), expo-location

## Setup & Run

### Backend
```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in DATABASE_URL
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm start          # Expo dev server (scan QR or press w/a/i)
npm run web        # Web browser
npm run android    # Android emulator
npm run ios        # iOS simulator
```

## Frontend Environment

Firebase config is set directly in [frontend/firebase.js](frontend/firebase.js). Update the `firebaseConfig` object with your Firebase project credentials.

## Architecture

### Backend
Same as the `dev` branch — FastAPI + SQLAlchemy models, no API routes yet. See `feature/backend-initial-work` for the complete API.

### Frontend

```
frontend/
├── App.js               # Root: Redux Provider + NavigationContainer
├── StackNavigator.js    # Navigation stack definition
├── store.js             # Redux store (CartReducer + ProductReducer)
├── CartReducer.js       # Cart state: add/remove items
├── ProductReducer.js    # Product selection state
├── firebase.js          # Firebase app init (auth, Firestore)
├── screens/             # One file per screen
│   ├── LoginScreen.js / RegisterScreen.js
│   ├── HomeScreen.js    # Entry point with categories + campaigns
│   ├── ProfileScreen.js / OrderScreen.js / PickUpScreen.js
│   ├── FoodScreen.js / VolunteerScreen.js / BooksScreen.js / HealthScreen.js
│   ├── CampaignDetailScreen.js / StoryDetailScreen.js
│   └── CartScreen.js
├── components/
│   ├── Carousel.js      # Impact stories carousel
│   ├── DressItem.js     # Donation item card
│   └── Services.js      # Service category list
└── data/
    ├── data.js          # Mock: campaigns, stories, donation items
    └── services.js      # Mock: service categories
```

**Data flow:** Firebase handles auth (Google sign-in). Redux manages the donation cart and selected products. Navigation is a flat stack from Login through category screens.

**Current state:** Frontend uses mock data from `data/` — not yet wired to the FastAPI backend.

## Worktree Layout

| Path | Branch |
|---|---|
| `../master` | master — base branch |
| `../dev` | dev — backend skeleton |
| `../feat-adding-frontend` | feat-adding-frontend — this branch |
| `../feature-backend-initial-work` | feature/backend-initial-work (most complete backend) |
| `../feature-create-database0304` | feature/create-database0304 |
| `../ocr-benchmark` | ocr-benchmark |
| `../ocr-dataset-updates` | ocr-dataset-updates |
