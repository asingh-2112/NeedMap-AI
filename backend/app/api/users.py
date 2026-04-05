from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.user import UserLocationUpdateRequest, UserResponse
from app.services.user_service import update_location

router = APIRouter(prefix="/users", tags=["Users"])


@router.patch("/me/location", response_model=UserResponse)
def update_my_location(
    payload: UserLocationUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return update_location(db=db, user=current_user, payload=payload)
