from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.core.config import settings, _resolve_database_url

_engine = None
_SessionLocal = None


class Base(DeclarativeBase):
    pass


def get_engine():
    global _engine

    if _engine is None:
        raw_url = settings.database_url
        # Empty string or None → try Secret Manager
        db_url = _resolve_database_url(raw_url or None)
        if not db_url:
            raise ValueError("Could not resolve DATABASE_URL — set it in .env or Secret Manager")
        # Convert psycopg2 URL to psycopg3 URL format if needed
        if "postgresql://" in db_url and "+psycopg" not in db_url:
            db_url = db_url.replace("postgresql://", "postgresql+psycopg://", 1)
        # Disable prepared statements for PgBouncer/Supabase pooler compatibility
        _engine = create_engine(
            db_url,
            echo=settings.sqlalchemy_echo,
            connect_args={"prepare_threshold": None},
        )

    return _engine


def get_session_local():
    global _SessionLocal

    if _SessionLocal is None:
        _SessionLocal = sessionmaker(bind=get_engine())

    return _SessionLocal


def get_db():
    db = get_session_local()()
    try:
        yield db
    finally:
        db.close()
