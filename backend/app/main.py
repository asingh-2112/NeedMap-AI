import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from app.core.database import Base, get_engine, get_session_local
from app.api.auth import router as auth_router
from app.api.assignments import router as assignments_router
from app.api.needs import router as needs_router
from app.api.organizations import router as organizations_router
from app.api.users import router as users_router
from app.api.volunteers import router as volunteers_router
from app.core.config import settings

# Import all models so Base knows about them
import app.models  # noqa: F401

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.run_migrations:
        Base.metadata.create_all(bind=get_engine())
        logger.info("Database tables created / verified.")
    yield


app = FastAPI(title=settings.app_name, version=settings.app_version, lifespan=lifespan)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(organizations_router)
app.include_router(needs_router)
app.include_router(volunteers_router)
app.include_router(assignments_router)

# Serve sample files at /samples/* (for local OCR testing)
_samples_dir = Path(__file__).parent.parent / "samples"
if _samples_dir.exists():
    app.mount("/samples", StaticFiles(directory=str(_samples_dir)), name="samples")


@app.get("/")
def root():
    return {"status": "ok", "app": "NeedMap AI"}


@app.get("/health")
def health_check():
    from sqlalchemy import text

    SessionLocal = get_session_local()
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        logger.error("Health check DB error: %s", e)
        db_status = "error"
    finally:
        db.close()

    if db_status != "connected":
        raise HTTPException(status_code=503, detail="Database unhealthy")

    return {"status": "healthy", "database": "connected"}
