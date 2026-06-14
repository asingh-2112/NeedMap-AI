from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token, hash_password
from app.models.enums import UserRole
from app.models.organization import Organization
from app.models.user import User
from app.schemas.organization import (
    BranchCreateRequest,
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


def get_accessible_organization_ids(db: Session, current_user: User) -> list[int]:
    """
    Returns organization IDs a user is allowed to access.
    - Owner: root organization + all active branches.
    - Admin: managed branch only (if set), else their organization.
    - Volunteer: only their organization (if set).
    """
    if current_user.organization_id is None:
        return []

    if current_user.role == UserRole.OWNER:
        branch_ids = [
            row[0]
            for row in (
                db.query(Organization.id)
                .filter(
                    Organization.parent_organization_id == current_user.organization_id,
                    Organization.is_branch.is_(True),
                    Organization.is_active.is_(True),
                )
                .all()
            )
        ]
        return [current_user.organization_id, *branch_ids]

    if current_user.role == UserRole.ADMIN:
        if current_user.managed_branch_id is not None:
            return [current_user.managed_branch_id]
        return []

    return [current_user.organization_id]


def _get_branch_for_org(db: Session, organization_id: int, branch_id: int) -> Organization:
    branch = (
        db.query(Organization)
        .filter(
            Organization.id == branch_id,
            Organization.parent_organization_id == organization_id,
            Organization.is_branch.is_(True),
            Organization.is_active.is_(True),
        )
        .first()
    )

    if branch is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Branch not found for this organization",
        )

    return branch


# ── Public org + owner registration ──────────────────────────────────────────

def register_organization(db: Session, payload: OrganizationRegisterRequest) -> OrganizationRegisterResponse:
    """Create an organization and its first owner user in one transaction."""
    try:
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
        print(f"✓ Created owner user: {owner_user.id}")

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
        print(f"✓ Created organization: {organization.id}")

        # Link owner to the org
        owner_user.organization_id = organization.id
        db.add(owner_user)

        db.commit()
        print(f"✓ Transaction committed")
        
        db.refresh(organization)
        db.refresh(owner_user)
        print(f"✓ Refreshed objects from database")

        # Generate JWT so the owner is logged in immediately
        token = create_access_token(owner_user.id)
        print(f"✓ Generated JWT token")

        response = OrganizationRegisterResponse(
            organization=OrganizationResponse.model_validate(organization),
            access_token=token,
            expires_in=settings.jwt_expire_seconds,
        )
        print(f"✓ Built response: {response}")
        return response
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"✗ Error in register_organization: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}",
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

    if payload.role == UserRole.ADMIN and not _is_owner(current_user, organization):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owner can create admin accounts",
        )

    # Reuse deactivated user records in the same organization and allow admin upsert
    # for existing same-email admin accounts in the same organization.
    existing = db.query(User).filter(User.email == payload.email).first()
    reusable_user: User | None = None
    upsert_active_admin_user: User | None = None
    if existing:
        if existing.organization_id != organization_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )

        if existing.is_active:
            if payload.role == UserRole.ADMIN and existing.role == UserRole.ADMIN:
                upsert_active_admin_user = existing
            else:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Email already registered",
                )
        else:
            reusable_user = existing

    managed_branch_id: int | None = None
    if payload.role == UserRole.ADMIN:
        branch = _get_branch_for_org(db=db, organization_id=organization_id, branch_id=payload.managed_branch_id)
        existing_branch_admin = (
            db.query(User)
            .filter(
                User.organization_id == organization_id,
                User.managed_branch_id == branch.id,
                User.role == UserRole.ADMIN,
                User.is_active.is_(True),
            )
            .first()
        )

        # If the branch already has an admin, treat this as an overwrite/update for that branch.
        if existing_branch_admin is not None:
            email_owner = db.query(User).filter(User.email == payload.email).first()
            if email_owner is not None and email_owner.id != existing_branch_admin.id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Email already registered",
                )

            existing_branch_admin.user_name = payload.user_name
            existing_branch_admin.email = payload.email
            existing_branch_admin.password_hash = hash_password(payload.password)
            existing_branch_admin.role = payload.role
            existing_branch_admin.phone = payload.phone
            existing_branch_admin.organization_id = organization_id
            existing_branch_admin.managed_branch_id = branch.id
            existing_branch_admin.is_active = True

            db.add(existing_branch_admin)
            db.commit()
            db.refresh(existing_branch_admin)
            return existing_branch_admin

        allowed_existing_ids = {
            reusable_user.id if reusable_user is not None else None,
            upsert_active_admin_user.id if upsert_active_admin_user is not None else None,
        }
        if existing_branch_admin is not None and existing_branch_admin.id not in allowed_existing_ids:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This branch already has an active admin",
            )
        managed_branch_id = branch.id

    if upsert_active_admin_user is not None:
        upsert_active_admin_user.user_name = payload.user_name
        upsert_active_admin_user.password_hash = hash_password(payload.password)
        upsert_active_admin_user.role = payload.role
        upsert_active_admin_user.phone = payload.phone
        upsert_active_admin_user.organization_id = organization_id
        upsert_active_admin_user.managed_branch_id = managed_branch_id
        upsert_active_admin_user.is_active = True

        db.add(upsert_active_admin_user)
        db.commit()
        db.refresh(upsert_active_admin_user)
        return upsert_active_admin_user

    if reusable_user is not None:
        reusable_user.user_name = payload.user_name
        reusable_user.password_hash = hash_password(payload.password)
        reusable_user.role = payload.role
        reusable_user.phone = payload.phone
        reusable_user.organization_id = organization_id
        reusable_user.managed_branch_id = managed_branch_id
        reusable_user.is_active = True

        db.add(reusable_user)
        db.commit()
        db.refresh(reusable_user)
        return reusable_user

    new_user = User(
        user_name=payload.user_name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        phone=payload.phone,
        organization_id=organization_id,
        managed_branch_id=managed_branch_id,
        is_active=True,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


def list_active_organizations(db: Session) -> list[Organization]:
    return (
        db.query(Organization)
        .filter(Organization.is_active.is_(True), Organization.is_branch.is_(False))
        .order_by(Organization.created_at.desc())
        .all()
    )


def list_branches(db: Session, current_user: User, organization_id: int) -> list[Organization]:
    organization = db.query(Organization).filter(Organization.id == organization_id).first()

    if organization is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    if not _can_manage_organization(current_user, organization):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view branches",
        )

    return (
        db.query(Organization)
        .filter(
            Organization.parent_organization_id == organization_id,
            Organization.is_branch.is_(True),
            Organization.is_active.is_(True),
        )
        .order_by(Organization.branch_location.asc(), Organization.created_at.asc())
        .all()
    )


def create_branch(
    db: Session,
    current_user: User,
    organization_id: int,
    payload: BranchCreateRequest,
) -> Organization:
    organization = db.query(Organization).filter(Organization.id == organization_id).first()

    if organization is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    if organization.is_branch:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Branches can only be created under a root organization",
        )

    if not _is_owner(current_user, organization):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owner can create branches",
        )

    existing_location = (
        db.query(Organization)
        .filter(
            Organization.parent_organization_id == organization_id,
            Organization.branch_location == payload.branch_location.strip(),
            Organization.is_branch.is_(True),
            Organization.is_active.is_(True),
        )
        .first()
    )
    if existing_location is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A branch already exists for this location",
        )

    branch = Organization(
        user_id=organization.user_id,
        parent_organization_id=organization_id,
        organization_name=payload.organization_name,
        branch_location=payload.branch_location.strip(),
        is_branch=True,
        address=payload.address,
        phone=payload.phone,
        is_active=True,
    )
    db.add(branch)
    db.commit()
    db.refresh(branch)
    return branch


def list_members(db: Session, current_user: User, organization_id: int) -> list[User]:
    organization = db.query(Organization).filter(Organization.id == organization_id).first()

    if organization is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    if not _can_manage_organization(current_user, organization):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view members",
        )

    return (
        db.query(User)
        .filter(
            User.organization_id == organization_id,
            User.is_active.is_(True),
        )
        .order_by(User.role.asc(), User.created_at.asc())
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


def deactivate_member(
    db: Session,
    current_user: User,
    organization_id: int,
    member_id: int,
) -> None:
    organization = db.query(Organization).filter(Organization.id == organization_id).first()

    if organization is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    member = (
        db.query(User)
        .filter(
            User.id == member_id,
            User.organization_id == organization_id,
            User.is_active.is_(True),
        )
        .first()
    )

    if member is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        )

    if member.role == UserRole.OWNER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Owner account cannot be deactivated from member endpoint",
        )

    if member.role == UserRole.ADMIN and not _is_owner(current_user, organization):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owner can delete admin accounts",
        )

    if member.role != UserRole.ADMIN and not _can_manage_organization(current_user, organization):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this member",
        )

    member.is_active = False
    db.add(member)
    db.commit()
