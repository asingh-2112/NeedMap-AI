from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.user import (
    PasswordChangeRequest,
    UserLocationUpdateRequest,
    UserProfileUpdateRequest,
    UserResponse,
)
from app.services.user_service import (
    change_password,
    deactivate_account,
    update_location,
    update_profile,
)

router = APIRouter(prefix="/users", tags=["Users"])


# ── Update profile ───────────────────────────────────────────────────────────

@router.patch("/me", response_model=UserResponse)
def update_my_profile(
    payload: UserProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return update_profile(db=db, user=current_user, payload=payload)


# ── Update location ──────────────────────────────────────────────────────────

@router.patch("/me/location", response_model=UserResponse)
def update_my_location(
    payload: UserLocationUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return update_location(db=db, user=current_user, payload=payload)


# ── Change password ──────────────────────────────────────────────────────────

@router.put("/me/password", status_code=status.HTTP_200_OK)
def change_my_password(
    payload: PasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    change_password(db=db, user=current_user, payload=payload)
    return {"message": "Password changed successfully"}


# ── Deactivate account ───────────────────────────────────────────────────────

@router.delete("/me", status_code=status.HTTP_200_OK)
def deactivate_my_account(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deactivate_account(db=db, user=current_user)
    return {"message": "Account deactivated successfully"}
