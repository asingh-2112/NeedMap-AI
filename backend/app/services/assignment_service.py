from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.assignment import Assignment
from app.models.enums import AssignmentStatus, UserRole
from app.models.need import Need
from app.models.organization import Organization
from app.models.user import User
from app.models.volunteer import Volunteer
from app.schemas.assignment import (
    AssignmentCreateRequest,
    AssignmentFeedbackRequest,
    AssignmentStatusUpdateRequest,
)


# ── Valid status transitions ─────────────────────────────────────────────────
# proposed → accepted → in_progress → completed
# proposed → declined
# any → cancelled

VALID_TRANSITIONS: dict[AssignmentStatus, set[AssignmentStatus]] = {
    AssignmentStatus.PROPOSED: {
        AssignmentStatus.ACCEPTED,
        AssignmentStatus.DECLINED,
        AssignmentStatus.CANCELLED,
    },
    AssignmentStatus.ACCEPTED: {
        AssignmentStatus.IN_PROGRESS,
        AssignmentStatus.CANCELLED,
    },
    AssignmentStatus.DECLINED: {
        AssignmentStatus.CANCELLED,
    },
    AssignmentStatus.IN_PROGRESS: {
        AssignmentStatus.COMPLETED,
        AssignmentStatus.CANCELLED,
    },
    AssignmentStatus.COMPLETED: {
        AssignmentStatus.CANCELLED,
    },
    AssignmentStatus.CANCELLED: set(),
}


# ── Helpers ──────────────────────────────────────────────────────────────────


def _get_assignment_or_404(db: Session, assignment_id: int) -> Assignment:
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if assignment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")
    return assignment


def _require_owner_or_admin(user: User) -> None:
    if user.role not in {UserRole.OWNER, UserRole.ADMIN}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owner or admin can perform this action",
        )


# ── Assignment CRUD ──────────────────────────────────────────────────────────


def create_assignment(db: Session, current_user: User, payload: AssignmentCreateRequest) -> Assignment:
    """Assign a volunteer to a need. Only owner or admin can create assignments."""
    _require_owner_or_admin(current_user)

    # Validate need exists
    need = db.query(Need).filter(Need.id == payload.need_id).first()
    if need is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Need not found")

    # Validate organization exists and is active
    org = (
        db.query(Organization)
        .filter(Organization.id == payload.organization_id, Organization.is_active.is_(True))
        .first()
    )
    if org is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    # Validate volunteer exists and is active
    volunteer = (
        db.query(Volunteer)
        .filter(Volunteer.id == payload.volunteer_id, Volunteer.is_active.is_(True))
        .first()
    )
    if volunteer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Volunteer not found")

    # Check for duplicate active assignment (same need + volunteer, not cancelled/completed)
    existing = (
        db.query(Assignment)
        .filter(
            Assignment.need_id == payload.need_id,
            Assignment.volunteer_id == payload.volunteer_id,
            Assignment.status.notin_([AssignmentStatus.CANCELLED, AssignmentStatus.COMPLETED]),
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Volunteer already has an active assignment for this need",
        )

    assignment = Assignment(
        need_id=payload.need_id,
        volunteer_id=payload.volunteer_id,
        organization_id=payload.organization_id,
        match_score=payload.match_score,
        status=AssignmentStatus.PROPOSED,
    )
    db.add(assignment)

    # Increment volunteer active_tasks
    volunteer.active_tasks += 1
    db.add(volunteer)

    db.commit()
    db.refresh(assignment)
    return assignment


def list_assignments(
    db: Session,
    need_id: int | None = None,
    volunteer_id: int | None = None,
    organization_id: int | None = None,
    status_filter: AssignmentStatus | None = None,
) -> list[Assignment]:
    query = db.query(Assignment)

    if need_id is not None:
        query = query.filter(Assignment.need_id == need_id)
    if volunteer_id is not None:
        query = query.filter(Assignment.volunteer_id == volunteer_id)
    if organization_id is not None:
        query = query.filter(Assignment.organization_id == organization_id)
    if status_filter is not None:
        query = query.filter(Assignment.status == status_filter)

    return query.order_by(Assignment.assigned_at.desc()).all()


def get_assignment_by_id(db: Session, assignment_id: int) -> Assignment:
    return _get_assignment_or_404(db, assignment_id)


def update_assignment_status(
    db: Session,
    assignment_id: int,
    payload: AssignmentStatusUpdateRequest,
) -> Assignment:
    """Update assignment lifecycle status with transition validation."""
    assignment = _get_assignment_or_404(db, assignment_id)

    current = assignment.status
    target = payload.status

    allowed = VALID_TRANSITIONS.get(current, set())
    if target not in allowed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot transition from '{current.value}' to '{target.value}'",
        )

    now = datetime.now(timezone.utc)

    # Track timestamps on key transitions
    if target == AssignmentStatus.ACCEPTED:
        assignment.accepted_at = now
    elif target == AssignmentStatus.COMPLETED:
        assignment.completed_at = now
        # Update volunteer stats
        volunteer = db.query(Volunteer).filter(Volunteer.id == assignment.volunteer_id).first()
        if volunteer:
            volunteer.tasks_completed += 1
            volunteer.active_tasks = max(0, volunteer.active_tasks - 1)
            db.add(volunteer)
    elif target == AssignmentStatus.CANCELLED:
        # Decrement active tasks if assignment was not already completed
        if current not in {AssignmentStatus.COMPLETED, AssignmentStatus.DECLINED}:
            volunteer = db.query(Volunteer).filter(Volunteer.id == assignment.volunteer_id).first()
            if volunteer:
                volunteer.active_tasks = max(0, volunteer.active_tasks - 1)
                db.add(volunteer)
    elif target == AssignmentStatus.DECLINED:
        # Volunteer declined, decrement active tasks
        volunteer = db.query(Volunteer).filter(Volunteer.id == assignment.volunteer_id).first()
        if volunteer:
            volunteer.active_tasks = max(0, volunteer.active_tasks - 1)
            db.add(volunteer)

    assignment.status = target
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment


def submit_assignment_feedback(
    db: Session,
    assignment_id: int,
    payload: AssignmentFeedbackRequest,
) -> Assignment:
    """Submit feedback and rating for an assignment."""
    assignment = _get_assignment_or_404(db, assignment_id)

    if payload.feedback is not None:
        assignment.feedback = payload.feedback
    if payload.rating is not None:
        assignment.rating = payload.rating

        # Update volunteer average rating
        volunteer = db.query(Volunteer).filter(Volunteer.id == assignment.volunteer_id).first()
        if volunteer:
            # Recalculate average from all rated assignments for this volunteer
            rated = (
                db.query(Assignment)
                .filter(
                    Assignment.volunteer_id == volunteer.id,
                    Assignment.rating.is_not(None),
                    Assignment.id != assignment.id,  # exclude current (not yet committed)
                )
                .all()
            )
            total = sum(a.rating for a in rated) + payload.rating
            count = len(rated) + 1
            volunteer.rating = round(total / count, 2)
            db.add(volunteer)

    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment
