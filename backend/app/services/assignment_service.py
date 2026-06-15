from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.assignment import Assignment
from app.models.enums import AssignmentStatus, NeedStatus, UserRole
from app.models.need import Need
from app.models.organization import Organization
from app.models.user import User
from app.models.volunteer import Volunteer
from app.services.organization_service import get_accessible_organization_ids
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


def _ensure_assignment_access(db: Session, current_user: User, assignment: Assignment) -> None:
    if current_user.role == UserRole.VOLUNTEER:
        volunteer = db.query(Volunteer).filter(Volunteer.id == assignment.volunteer_id).first()
        if volunteer is None or volunteer.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not allowed to access this assignment",
            )
        return

    allowed_ids = set(get_accessible_organization_ids(db=db, current_user=current_user))
    if assignment.organization_id not in allowed_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to access this assignment",
        )


# ── Assignment CRUD ──────────────────────────────────────────────────────────


def create_assignment(db: Session, current_user: User, payload: AssignmentCreateRequest) -> Assignment:
    """Assign a volunteer to a need. Only owner or admin can create assignments."""
    _require_owner_or_admin(current_user)
    allowed_ids = set(get_accessible_organization_ids(db=db, current_user=current_user))
    if payload.organization_id not in allowed_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to create assignment for this organization/branch",
        )

    # Validate need exists
    need = db.query(Need).filter(Need.id == payload.need_id).first()
    if need is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Need not found")
    if need.organization_id != payload.organization_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Need and assignment organization mismatch",
        )

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

    db.commit()
    db.refresh(assignment)
    return assignment


def list_assignments(
    db: Session,
    current_user: User,
    need_id: int | None = None,
    volunteer_id: int | None = None,
    organization_id: int | None = None,
    status_filter: AssignmentStatus | None = None,
) -> list[Assignment]:
    if current_user.role == UserRole.VOLUNTEER:
        volunteer_profile = db.query(Volunteer).filter(Volunteer.user_id == current_user.id).first()
        if volunteer_profile is None:
            return []
        query = db.query(Assignment).filter(Assignment.volunteer_id == volunteer_profile.id)
    else:
        allowed_ids = set(get_accessible_organization_ids(db=db, current_user=current_user))
        query = db.query(Assignment).filter(Assignment.organization_id.in_(allowed_ids))

    if need_id is not None:
        query = query.filter(Assignment.need_id == need_id)
    if volunteer_id is not None:
        query = query.filter(Assignment.volunteer_id == volunteer_id)
    if organization_id is not None:
        if current_user.role != UserRole.VOLUNTEER:
            allowed_ids = set(get_accessible_organization_ids(db=db, current_user=current_user))
            if organization_id not in allowed_ids:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not allowed to access this organization/branch",
                )
        query = query.filter(Assignment.organization_id == organization_id)
    if status_filter is not None:
        query = query.filter(Assignment.status == status_filter)

    return query.order_by(Assignment.assigned_at.desc()).all()


def get_assignment_by_id(db: Session, current_user: User, assignment_id: int) -> Assignment:
    assignment = _get_assignment_or_404(db, assignment_id)
    _ensure_assignment_access(db=db, current_user=current_user, assignment=assignment)
    return assignment


def update_assignment_status(
    db: Session,
    current_user: User,
    assignment_id: int,
    payload: AssignmentStatusUpdateRequest,
) -> Assignment:
    """Update assignment lifecycle status with transition validation."""
    assignment = _get_assignment_or_404(db, assignment_id)
    _ensure_assignment_access(db=db, current_user=current_user, assignment=assignment)

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
        volunteer = db.query(Volunteer).filter(Volunteer.id == assignment.volunteer_id).first()
        if volunteer:
            volunteer.active_tasks += 1
            db.add(volunteer)
        need = db.query(Need).filter(Need.id == assignment.need_id).first()
        if need and need.status in {NeedStatus.NEW, NeedStatus.VERIFIED}:
            need.status = NeedStatus.ASSIGNED
            db.add(need)
    elif target == AssignmentStatus.IN_PROGRESS:
        need = db.query(Need).filter(Need.id == assignment.need_id).first()
        if need:
            need.status = NeedStatus.IN_PROGRESS
            db.add(need)
    elif target == AssignmentStatus.COMPLETED:
        assignment.completed_at = now
        # Update volunteer stats
        volunteer = db.query(Volunteer).filter(Volunteer.id == assignment.volunteer_id).first()
        if volunteer:
            volunteer.tasks_completed += 1
            volunteer.active_tasks = max(0, volunteer.active_tasks - 1)
            db.add(volunteer)
        need = db.query(Need).filter(Need.id == assignment.need_id).first()
        if need:
            need.status = NeedStatus.RESOLVED
            need.resolved_at = now
            db.add(need)
    elif target == AssignmentStatus.CANCELLED:
        # Decrement active tasks if assignment was not already completed
        if current in {AssignmentStatus.ACCEPTED, AssignmentStatus.IN_PROGRESS}:
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
    current_user: User,
    assignment_id: int,
    payload: AssignmentFeedbackRequest,
) -> Assignment:
    """Submit feedback and rating for an assignment."""
    assignment = _get_assignment_or_404(db, assignment_id)
    _ensure_assignment_access(db=db, current_user=current_user, assignment=assignment)

    if assignment.status != AssignmentStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Feedback and rating can only be submitted after the assignment is completed",
        )

    if payload.feedback is not None:
        assignment.feedback = payload.feedback
    if payload.rating is not None:
        assignment.rating = payload.rating

    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment
