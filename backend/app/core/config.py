import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


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
    # CORS
    allowed_origins: list[str] | None
    # Gemini — Vertex AI (primary) or AI Studio (fallback)
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
    jwt_secret_key=os.getenv("JWT_SECRET_KEY", ""),
    jwt_algorithm=os.getenv("JWT_ALGORITHM", "HS256"),
    jwt_expire_minutes=_env_int("JWT_EXPIRE_MINUTES", default=60),
    allowed_origins=[o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()] or None,
    gemini_api_key=os.getenv("GEMINI_API_KEY"),
    google_application_credentials=os.getenv("GOOGLE_APPLICATION_CREDENTIALS"),
    llm_model=os.getenv("LLM_MODEL", "gemini-2.5-flash"),
)
