from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext
from app.core.config import settings

# ── Password hashing ────────────────────────────────────────────────────────
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain_password: str) -> str:
    """Return bcrypt hash of a plain-text password."""
    return _pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Return True if plain_password matches the stored hash."""
    return _pwd_context.verify(plain_password, hashed_password)


# ── JWT ──────────────────────────────────────────────────────────────────────
_SECRET_KEY = settings.jwt_secret_key
_ALGORITHM = settings.jwt_algorithm
_ACCESS_TOKEN_EXPIRE_MINUTES = settings.jwt_expire_minutes


def create_access_token(user_id: int) -> str:
    """Create a signed JWT access token containing the user id."""
    if not _SECRET_KEY:
        raise RuntimeError("JWT_SECRET_KEY environment variable is not set")

    expire = datetime.now(timezone.utc) + timedelta(minutes=_ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, _SECRET_KEY, algorithm=_ALGORITHM)


def decode_access_token(token: str) -> int | None:
    """Decode a JWT and return the user_id (sub), or None if invalid/expired."""
    try:
        payload = jwt.decode(token, _SECRET_KEY, algorithms=[_ALGORITHM])
        sub = payload.get("sub")
        if sub is None:
            return None
        return int(sub)
    except (JWTError, ValueError):
        return None
