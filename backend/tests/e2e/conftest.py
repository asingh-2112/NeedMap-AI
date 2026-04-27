"""
E2E test shared setup.

Creates an in-memory SQLite database and a FastAPI TestClient so that E2E
tests run without a live server or external database connection.

Just run (from backend/):
    pytest tests/e2e -v
"""

import os

# ── Env vars MUST be set before any app module is imported ────────────────────
# Settings is a frozen dataclass built at import time — values from os.environ
# at that moment are baked in. Setting them here (before `from app.* import`)
# ensures the test run uses the SQLite URL and a known JWT key.
os.environ.setdefault("DATABASE_URL",    "sqlite://")
os.environ.setdefault("JWT_SECRET_KEY",  "e2e-test-secret-key-do-not-use-in-prod")
os.environ["RUN_MIGRATIONS"]  = "false"   # force-off — we create SQLite tables ourselves
os.environ["SQLALCHEMY_ECHO"] = "false"

import pytest                                           # noqa: E402
from fastapi.testclient import TestClient              # noqa: E402
from sqlalchemy import create_engine                   # noqa: E402
from sqlalchemy.orm import sessionmaker                # noqa: E402
from sqlalchemy.pool import StaticPool                 # noqa: E402

import app.models                                      # noqa: F401, E402 — registers models
from app.core.database import Base, get_db             # noqa: E402
from app.main import app                               # noqa: E402

# ── In-memory SQLite (one fresh DB per test session) ─────────────────────────
# StaticPool is required for in-memory SQLite — without it each new connection
# would get its own empty database, so tables created in one connection are
# invisible to the next.
_engine  = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
_Session = sessionmaker(autocommit=False, autoflush=False, bind=_engine)

Base.metadata.create_all(bind=_engine)   # create all tables in SQLite


def _override_get_db():
    db = _Session()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override_get_db


# ── Shared TestClient fixture ─────────────────────────────────────────────────

@pytest.fixture(scope="module")
def client():
    """FastAPI TestClient — no running server required."""
    with TestClient(app) as c:
        yield c
