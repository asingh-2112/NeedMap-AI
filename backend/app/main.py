import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from app.database import Base, get_engine, get_session_local

# Import all models so Base knows about them
import app.models  # noqa: F401

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if os.getenv("RUN_MIGRATIONS", "false").lower() == "true":
        Base.metadata.create_all(bind=get_engine())
        logger.info("Database tables created / verified.")
    yield


app = FastAPI(title="NeedMap AI", version="0.1.0", lifespan=lifespan)


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
