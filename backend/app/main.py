from contextlib import asynccontextmanager

from fastapi import FastAPI
from app.database import engine, Base

# Import all models so Base knows about them
import app.models  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="NeedMap AI", version="0.1.0", lifespan=lifespan)


@app.get("/")
def root():
    return {"status": "ok", "app": "NeedMap AI"}


@app.get("/health")
def health_check():
    from sqlalchemy import text
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"
    finally:
        db.close()

    return {"status": "healthy" if db_status == "connected" else "unhealthy", "database": db_status}
