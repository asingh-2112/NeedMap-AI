from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token, hash_password
from app.models.enums import UserRole
from app.models.organization import Organization
from app.models.user import User
from app.schemas.organization import (
    OrganizationCreateRequest,
    OrganizationRegisterRequest,
    OrganizationRegisterResponse,
    OrganizationResponse,
    OrganizationUpdateRequest,
)
from app.schemas.user import AddMemberRequest


def _is_admin(user: User) -> bool:
    return user.role == UserRole.ADMIN


def _is_owner(user: User, organization: Organization) -> bool:
    return organization.user_id == user.id


def _is_org_admin(user: User, organization: Organization) -> bool:
    return user.role == UserRole.ADMIN and user.organization_id == organization.id


def _can_manage_organization(user: User, organization: Organization) -> bool:
    return _is_owner(user, organization) or _is_org_admin(user, organization)


# ── Public org + owner registration ──────────────────────────────────────────

def register_organization(db: Session, payload: OrganizationRegisterRequest) -> OrganizationRegisterResponse:
    """Create an organization and its first owner user in one transaction."""
    # Check email uniqueness
    existing = db.query(User).filter(User.email == payload.owner_email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    # Create owner user
    owner_user = User(
        user_name=payload.owner_name,
        email=payload.owner_email,
        password_hash=hash_password(payload.owner_password),
        role=UserRole.OWNER,
        is_active=True,
    )
    db.add(owner_user)
    db.flush()

    # Create organization owned by owner
    organization = Organization(
        user_id=owner_user.id,
        organization_name=payload.organization_name,
        address=payload.address,
        phone=payload.phone,
        is_active=True,
    )
    db.add(organization)
    db.flush()

    # Link owner to the org
    owner_user.organization_id = organization.id
    db.add(owner_user)

    db.commit()
    db.refresh(organization)
    db.refresh(owner_user)

    # Generate JWT so the owner is logged in immediately
    token = create_access_token(owner_user.id)

    return OrganizationRegisterResponse(
        organization=OrganizationResponse.model_validate(organization),
        access_token=token,
        expires_in=settings.jwt_expire_seconds,
    )


# ── Add member to organization ───────────────────────────────────────────────

def add_member(db: Session, current_user: User, organization_id: int, payload: AddMemberRequest) -> User:
    """Owner or organization admin adds a new user to their organization."""
    organization = db.query(Organization).filter(Organization.id == organization_id).first()

    if organization is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    if not _can_manage_organization(current_user, organization):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not the owner or admin",
        )

    # Check email uniqueness
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    new_user = User(
        user_name=payload.user_name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        phone=payload.phone,
        organization_id=organization_id,
        is_active=True,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


# ── Existing CRUD (token-protected) ─────────────────────────────────────────

def create_organization(db: Session, current_user: User, payload: OrganizationCreateRequest) -> Organization:
    if current_user.role not in {UserRole.OWNER, UserRole.ADMIN}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owner or admin can create organization",
        )

    organization = Organization(
        user_id=current_user.id,
        organization_name=payload.organization_name,
        address=payload.address,
        phone=payload.phone,
        is_active=True,
    )
    db.add(organization)
    db.flush()

    current_user.organization_id = organization.id
    current_user.role = UserRole.OWNER
    db.add(current_user)

    db.commit()
    db.refresh(organization)

    return organization


def list_active_organizations(db: Session) -> list[Organization]:
    return (
        db.query(Organization)
        .filter(Organization.is_active.is_(True))
        .order_by(Organization.created_at.desc())
        .all()
    )


def get_active_organization_by_id(db: Session, organization_id: int) -> Organization:
    organization = (
        db.query(Organization)
        .filter(
            Organization.id == organization_id,
            Organization.is_active.is_(True),
        )
        .first()
    )

    if organization is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    return organization


def update_organization(
    db: Session,
    current_user: User,
    organization_id: int,
    payload: OrganizationUpdateRequest,
) -> Organization:
    organization = db.query(Organization).filter(Organization.id == organization_id).first()

    if organization is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    if not _can_manage_organization(current_user, organization):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not the owner or admin",
        )

    if payload.organization_name is not None:
        organization.organization_name = payload.organization_name
    if payload.address is not None:
        organization.address = payload.address
    if payload.phone is not None:
        organization.phone = payload.phone
    if payload.is_active is not None:
        organization.is_active = payload.is_active

    db.add(organization)
    db.commit()
    db.refresh(organization)

    return organization


def deactivate_organization(db: Session, current_user: User, organization_id: int) -> None:
    organization = db.query(Organization).filter(Organization.id == organization_id).first()

    if organization is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    if not _is_owner(current_user, organization):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owner can deactivate this organization",
        )

    organization.is_active = False
    db.add(organization)
    db.commit()
