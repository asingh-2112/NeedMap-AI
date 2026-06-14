import logging
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

logger = logging.getLogger(__name__)

load_dotenv()


# ── credential resolution ────────────────────────────────────────────

def _find_service_account_json() -> str | None:
    """Find service-account.json without needing GOOGLE_APPLICATION_CREDENTIALS env."""
    # 1. Explicit env override (still works if set, but not required)
    env_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if env_path and os.path.isfile(env_path):
        return os.path.abspath(env_path)

    # 2. Well-known path: {project_root}/service-account.json
    candidates = [
        Path(__file__).resolve().parent.parent / "service-account.json",  # backend/service-account.json
        Path(__file__).resolve().parent / "service-account.json",
        Path(os.getcwd()) / "service-account.json",
    ]
    for p in candidates:
        if p.is_file():
            return str(p)

    # 3. ADC (Application Default Credentials) — works on Render/GCP
    if os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
        return os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

    return None


@lru_cache(maxsize=1)
def _get_google_creds():
    """Return (credentials, project_id) or (None, None)."""
    try:
        import google.auth
        sa_path = _find_service_account_json()
        if sa_path:
            creds, project = google.auth.load_credentials_from_file(sa_path)
        else:
            creds, project = google.auth.default()
        logger.debug("Google credentials loaded (project: %s)", project)
        return creds, project
    except Exception as e:
        logger.debug("No Google credentials available: %s", e)
        return None, None


# ── secret manager helpers ───────────────────────────────────────────

def _fetch_secret(name: str) -> str | None:
    """Fetch a secret from Google Secret Manager. Returns None on failure."""
    creds, project = _get_google_creds()
    if not creds or not project:
        return None
    try:
        from google.cloud import secretmanager
        client = secretmanager.SecretManagerServiceClient(credentials=creds)
        secret_path = f"projects/{project}/secrets/{name}/versions/latest"
        resp = client.access_secret_version(request={"name": secret_path})
        return resp.payload.data.decode("UTF-8").strip()
    except Exception as e:
        logger.debug("Secret Manager fetch '%s' failed: %s", name, e)
        return None


# ── URL resolver ─────────────────────────────────────────────────────

def _resolve_database_url(raw_url: str | None) -> str | None:
    """Resolve DATABASE_URL with this priority:
    1. DATABASE_URL in env with embedded password (backward compat)
    2. Full URL from Secret Manager (`needmap-db-url`)
    3. DATABASE_URL in env (passwordless) + DB_PASSWORD env var injected
    4. DATABASE_URL in env (passwordless) — assume proxy/IAM auth
    """
    # 1. URL already has password
    if raw_url and "://" in raw_url:
        auth_part = raw_url.split("://")[1].split("@")[0]
        if ":" in auth_part:
            logger.debug("DATABASE_URL password embedded — using as-is")
            return raw_url

    # 2. Secret Manager
    sm_url = _fetch_secret("needmap-db-url")
    if sm_url:
        logger.info("DATABASE_URL loaded from Secret Manager")
        return sm_url

    # 3. Fallback: passwordless URL + DB_PASSWORD
    if raw_url:
        db_password = os.getenv("DB_PASSWORD")
        if db_password:
            logger.info("DATABASE_URL password injected from DB_PASSWORD env")
            return raw_url.replace("@", f":{db_password}@", 1)
        logger.info("Using passwordless DATABASE_URL (proxy/IAM assumed)")
        return raw_url

    return None


# ── simple env helpers ───────────────────────────────────────────────

def _env_bool(name: str, default: bool = False) -> bool:
    v = os.getenv(name)
    return v.strip().lower() in {"1", "true", "yes", "on"} if v else default


def _env_int(name: str, default: int) -> int:
    v = os.getenv(name)
    try:
        return int(v) if v else default
    except ValueError:
        return default


# ── secrets ──────────────────────────────────────────────────────────

def _resolve_jwt_secret() -> str:
    """JWT secret: env override → Secret Manager → hard default."""
    env_val = os.getenv("JWT_SECRET_KEY")
    if env_val:
        return env_val
    sm_val = _fetch_secret("needmap-jwt-secret")
    if sm_val:
        logger.info("JWT secret loaded from Secret Manager")
        return sm_val
    return "needmap-dev-jwt-secret-change-in-production"


def _resolve_gemini_api_key() -> str | None:
    """Gemini API key: env override → Secret Manager → None."""
    env_val = os.getenv("GEMINI_API_KEY")
    if env_val:
        return env_val
    return _fetch_secret("needmap-gemini-api-key")


# ── settings ─────────────────────────────────────────────────────────

@dataclass(frozen=True)
class Settings:
    app_name: str
    app_version: str
    database_url: str | None
    sqlalchemy_echo: bool
    run_migrations: bool
    jwt_secret_key: str
    jwt_algorithm: str
    jwt_expire_minutes: int
    allowed_origins: list[str] | None
    gemini_api_key: str | None
    google_application_credentials: str | None
    llm_model: str

    @property
    def jwt_expire_seconds(self) -> int:
        return self.jwt_expire_minutes * 60

    @property
    def llm_enabled(self) -> bool:
        return bool(self.gemini_api_key or self.google_application_credentials)


settings = Settings(
    app_name=os.getenv("APP_NAME", "NeedMap AI"),
    app_version=os.getenv("APP_VERSION", "0.1.0"),
    database_url=os.getenv("DATABASE_URL"),
    sqlalchemy_echo=_env_bool("SQLALCHEMY_ECHO", default=False),
    run_migrations=_env_bool("RUN_MIGRATIONS", default=False),
    jwt_secret_key=_resolve_jwt_secret(),
    jwt_algorithm=os.getenv("JWT_ALGORITHM", "HS256"),
    jwt_expire_minutes=_env_int("JWT_EXPIRE_MINUTES", default=60),
    allowed_origins=[o.strip() for o in (os.getenv("ALLOWED_ORIGINS") or "").split(",") if o.strip()] or None,
    gemini_api_key=_resolve_gemini_api_key(),
    google_application_credentials=_find_service_account_json(),
    llm_model=os.getenv("LLM_MODEL", "gemini-2.5-flash"),
)