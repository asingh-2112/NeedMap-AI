from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.nomination import Nomination
from app.models.volunteer import Volunteer
from app.models.need import Need
from app.models.assignment import Assignment
from app.models.enums import NominationStatus, AssignmentStatus, NeedStatus
from app.schemas.nomination import NominationCreateRequest


def create_nomination(
    db: Session, need_id: int, volunteer_id: int, payload: NominationCreateRequest
) -> Nomination:
    """Volunteer self-nominates for a need."""
    # Check need exists and is open
    need = db.query(Need).filter(Need.id == need_id).first()
    if not need:
        raise HTTPException(status_code=404, detail="Need not found")
    if need.status in (NeedStatus.RESOLVED, NeedStatus.CLOSED):
        raise HTTPException(status_code=400, detail="Need is already resolved or closed")

    # Check volunteer exists
    volunteer = db.query(Volunteer).filter(Volunteer.id == volunteer_id).first()
    if not volunteer:
        raise HTTPException(status_code=404, detail="Volunteer profile not found")

    # Check for duplicate nomination
    existing = (
        db.query(Nomination)
        .filter(
            Nomination.need_id == need_id,
            Nomination.volunteer_id == volunteer_id,
            Nomination.status == NominationStatus.PENDING,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Already nominated for this need")

    nomination = Nomination(
        need_id=need_id,
        volunteer_id=volunteer_id,
        status=NominationStatus.PENDING,
        message=payload.message,
    )
    db.add(nomination)
    db.commit()
    db.refresh(nomination)
    return nomination


def get_nominations_for_need(db: Session, need_id: int) -> list[Nomination]:
    """Get all nominations for a need."""
    return (
        db.query(Nomination)
        .filter(Nomination.need_id == need_id)
        .order_by(Nomination.created_at.desc())
        .all()
    )


def approve_nomination(db: Session, nomination_id: int, reviewer_id: int) -> Nomination:
    """Approve a nomination — creates an assignment."""
    nomination = db.query(Nomination).filter(Nomination.id == nomination_id).first()
    if not nomination:
        raise HTTPException(status_code=404, detail="Nomination not found")
    if nomination.status != NominationStatus.PENDING:
        raise HTTPException(status_code=400, detail="Nomination already processed")

    nomination.status = NominationStatus.APPROVED
    nomination.reviewed_by = reviewer_id

    # Create assignment from nomination
    need = db.query(Need).filter(Need.id == nomination.need_id).first()
    assignment = Assignment(
        need_id=nomination.need_id,
        volunteer_id=nomination.volunteer_id,
        organization_id=need.organization_id,
        status=AssignmentStatus.ACCEPTED,
    )
    db.add(assignment)

    # Update need status
    if need.status == NeedStatus.NEW or need.status == NeedStatus.VERIFIED:
        need.status = NeedStatus.ASSIGNED

    db.add(nomination)
    db.commit()
    db.refresh(nomination)
    return nomination


def reject_nomination(db: Session, nomination_id: int, reviewer_id: int) -> Nomination:
    """Reject a nomination."""
    nomination = db.query(Nomination).filter(Nomination.id == nomination_id).first()
    if not nomination:
        raise HTTPException(status_code=404, detail="Nomination not found")
    if nomination.status != NominationStatus.PENDING:
        raise HTTPException(status_code=400, detail="Nomination already processed")

    nomination.status = NominationStatus.REJECTED
    nomination.reviewed_by = reviewer_id
    db.add(nomination)
    db.commit()
    db.refresh(nomination)
    return nomination
