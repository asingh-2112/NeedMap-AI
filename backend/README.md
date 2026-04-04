# NeedMap AI — Backend

## Quick Setup

```bash
# 1. Go to backend folder
cd backend

# 2. Create virtual environment (packages install here, not on your system)
python3 -m venv venv

# 3. Activate it
source venv/bin/activate

# 4. Install dependencies
pip install -r requirements.txt

# 5. Create tables in Supabase
python -c "
from app.database import engine, Base
import app.models
Base.metadata.create_all(bind=engine)
print('✅ Tables created!')
"

# 6. Run the server
uvicorn app.main:app --reload
```

## Environment

- Copy `.env.example` to `.env` and add your Supabase connection string:
```
DATABASE_URL=postgresql://postgres.xxxxx:[PASSWORD]@aws-0-region.pooler.supabase.com:6543/postgres
```

## Tech Stack

| Layer | Tool |
|-------|------|
| Framework | FastAPI |
| ORM | SQLAlchemy |
| Database | PostgreSQL 17 (Supabase) |
| Python | 3.11+ |

## Database Tables

| Table | Purpose |
|-------|---------|
| `users` | All users (admin, coordinator, volunteer) |
| `organizations` | NGOs and social groups |
| `needs` | Community needs (AI-generated) |
| `need_sources` | Raw data inputs (OCR, voice, CSV) |
| `volunteers` | Volunteer profiles |
| `volunteer_skills` | Skills with proficiency levels |
| `assignments` | Need ↔ Volunteer dispatch |

## Useful Commands

```bash
source venv/bin/activate     # Enter virtual env
deactivate                   # Exit virtual env
rm -rf venv                  # Delete virtual env completely
```
