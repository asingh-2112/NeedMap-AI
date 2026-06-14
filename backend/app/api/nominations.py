from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.volunteer import Volunteer
from app.models.enums import UserRole
from app.schemas.nomination import NominationCreateRequest, NominationResponse
from app.services import nomination_service

router = APIRouter(prefix="/api/nominations", tags=["Nominations"])


@router.post("/needs/{need_id}", response_model=NominationResponse)
def nominate_self(
    need_id: int,
    payload: NominationCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Volunteer self-nominates for a need."""
    # Get volunteer profile for the current user
    volunteer = db.query(Volunteer).filter(Volunteer.user_id == current_user.id).first()
    if not volunteer:
        raise HTTPException(status_code=400, detail="You must have a volunteer profile to nominate")

    return nomination_service.create_nomination(db, need_id, volunteer.id, payload)


@router.get("/needs/{need_id}", response_model=list[NominationResponse])
def list_nominations(
    need_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List nominations for a need (admin/owner only)."""
    if current_user.role == UserRole.VOLUNTEER:
        raise HTTPException(status_code=403, detail="Only admins can view nominations")
    return nomination_service.get_nominations_for_need(db, need_id)


@router.patch("/{nomination_id}/approve", response_model=NominationResponse)
def approve(
    nomination_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Approve a nomination (creates assignment)."""
    if current_user.role == UserRole.VOLUNTEER:
        raise HTTPException(status_code=403, detail="Only admins can approve nominations")
    return nomination_service.approve_nomination(db, nomination_id, current_user.id)


@router.patch("/{nomination_id}/reject", response_model=NominationResponse)
def reject(
    nomination_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Reject a nomination."""
    if current_user.role == UserRole.VOLUNTEER:
        raise HTTPException(status_code=403, detail="Only admins can reject nominations")
    return nomination_service.reject_nomination(db, nomination_id, current_user.id)
