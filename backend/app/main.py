from fastapi import FastAPI
from app.database import engine, Base

# Import all models so Base knows about them
import app.models  # noqa: F401

app = FastAPI(title="NeedMap AI", version="0.1.0")


# Create all tables on startup
@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)


@app.get("/")
def root():
    return {"status": "ok", "app": "NeedMap AI"}


@app.get("/health")
def health_check():
    from sqlalchemy import text
    from app.database import SessionLocal

    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"

    return {"status": "healthy" if db_status == "connected" else "unhealthy", "database": db_status}
