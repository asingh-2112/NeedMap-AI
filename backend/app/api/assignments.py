from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.enums import AssignmentStatus
from app.models.user import User
from app.schemas.assignment import (
    AssignmentCreateRequest,
    AssignmentFeedbackRequest,
    AssignmentResponse,
    AssignmentStatusUpdateRequest,
)
from app.services.assignment_service import (
    create_assignment,
    get_assignment_by_id,
    list_assignments,
    submit_assignment_feedback,
    update_assignment_status,
)

router = APIRouter(prefix="/assignments", tags=["Assignments"])


# ── Assignment CRUD ──────────────────────────────────────────────────────────


@router.post("", response_model=AssignmentResponse, status_code=status.HTTP_201_CREATED)
def create_assignment_route(
    payload: AssignmentCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_assignment(db=db, current_user=current_user, payload=payload)


@router.get("", response_model=list[AssignmentResponse])
def list_assignments_route(
    need_id: int | None = None,
    volunteer_id: int | None = None,
    organization_id: int | None = None,
    status: AssignmentStatus | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return list_assignments(
        db=db,
        need_id=need_id,
        volunteer_id=volunteer_id,
        organization_id=organization_id,
        status_filter=status,
    )


@router.get("/{assignment_id}", response_model=AssignmentResponse)
def get_assignment_route(
    assignment_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return get_assignment_by_id(db=db, assignment_id=assignment_id)


# ── Status & Feedback ────────────────────────────────────────────────────────


@router.patch("/{assignment_id}/status", response_model=AssignmentResponse)
def update_status_route(
    assignment_id: int,
    payload: AssignmentStatusUpdateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return update_assignment_status(db=db, assignment_id=assignment_id, payload=payload)


@router.patch("/{assignment_id}/feedback", response_model=AssignmentResponse)
def submit_feedback_route(
    assignment_id: int,
    payload: AssignmentFeedbackRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return submit_assignment_feedback(db=db, assignment_id=assignment_id, payload=payload)
