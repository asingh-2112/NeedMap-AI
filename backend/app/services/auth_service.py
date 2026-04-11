from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token, hash_password, verify_password
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.user import TokenResponse, UserLoginRequest, UserRegisterRequest


# Only volunteers can self-register.
_RESTRICTED_ROLES = {UserRole.OWNER, UserRole.ADMIN}


def register_user(db: Session, payload: UserRegisterRequest) -> User:
    if payload.role in _RESTRICTED_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Owner and admin accounts must be created by an organization",
        )

    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        user_name=payload.user_name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        phone=payload.phone,
        latitude=payload.latitude,
        longitude=payload.longitude,
        radius_km=payload.radius_km,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


def login_user(db: Session, payload: UserLoginRequest) -> TokenResponse:
    user = db.query(User).filter(User.email == payload.email).first()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive",
        )

    token = create_access_token(user.id)
    return TokenResponse(
        access_token=token,
        expires_in=settings.jwt_expire_seconds,
    )
