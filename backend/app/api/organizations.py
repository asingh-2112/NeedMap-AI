from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.organization import (
    OrganizationCreateRequest,
    OrganizationRegisterRequest,
    OrganizationRegisterResponse,
    OrganizationResponse,
    OrganizationUpdateRequest,
)
from app.schemas.user import AddMemberRequest, UserResponse
from app.services.organization_service import (
    add_member,
    create_organization,
    deactivate_organization,
    get_active_organization_by_id,
    list_active_organizations,
    register_organization,
    update_organization,
)

router = APIRouter(prefix="/organizations", tags=["Organizations"])


# ── Public: register org + first admin ────────────────────────────────────────

@router.post("/register", response_model=OrganizationRegisterResponse, status_code=status.HTTP_201_CREATED)
def register_organization_route(
    payload: OrganizationRegisterRequest,
    db: Session = Depends(get_db),
):
    return register_organization(db=db, payload=payload)


# ── Protected: add member to org ──────────────────────────────────────────────

@router.post("/{organization_id}/members", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def add_member_route(
    organization_id: int,
    payload: AddMemberRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return add_member(db=db, current_user=current_user, organization_id=organization_id, payload=payload)


# ── Existing CRUD routes ──────────────────────────────────────────────────────

@router.post("", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
def create_organization_route(
    payload: OrganizationCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_organization(db=db, current_user=current_user, payload=payload)


@router.get("", response_model=list[OrganizationResponse])
def list_organizations_route(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return list_active_organizations(db=db)


@router.get("/{organization_id}", response_model=OrganizationResponse)
def get_organization_route(
    organization_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return get_active_organization_by_id(db=db, organization_id=organization_id)


@router.patch("/{organization_id}", response_model=OrganizationResponse)
def update_organization_route(
    organization_id: int,
    payload: OrganizationUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return update_organization(
        db=db,
        current_user=current_user,
        organization_id=organization_id,
        payload=payload,
    )


@router.delete("/{organization_id}", status_code=status.HTTP_200_OK)
def deactivate_organization_route(
    organization_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deactivate_organization(db=db, current_user=current_user, organization_id=organization_id)
    return {"message": "Organization deactivated successfully"}
