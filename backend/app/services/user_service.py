from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.user import User
from app.schemas.user import (
    PasswordChangeRequest,
    UserLocationUpdateRequest,
    UserProfileUpdateRequest,
)


def update_profile(db: Session, user: User, payload: UserProfileUpdateRequest) -> User:
    if payload.user_name is not None:
        user.user_name = payload.user_name

    if payload.phone is not None:
        user.phone = payload.phone

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


def update_location(db: Session, user: User, payload: UserLocationUpdateRequest) -> User:
    if payload.latitude is not None and payload.longitude is not None:
        user.latitude = payload.latitude
        user.longitude = payload.longitude

    if payload.radius_km is not None:
        user.radius_km = payload.radius_km

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


def change_password(db: Session, user: User, payload: PasswordChangeRequest) -> None:
    if not verify_password(payload.old_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect",
        )

    user.password_hash = hash_password(payload.new_password)
    db.add(user)
    db.commit()


def deactivate_account(db: Session, user: User) -> None:
    user.is_active = False
    db.add(user)
    db.commit()
