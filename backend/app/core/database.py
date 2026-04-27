from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.core.config import settings

_engine = None
_SessionLocal = None


class Base(DeclarativeBase):
    pass


def get_engine():
    global _engine

    if _engine is None:
        if not settings.database_url:
            raise ValueError("DATABASE_URL environment variable is not set")
        _engine = create_engine(settings.database_url, echo=settings.sqlalchemy_echo)

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
