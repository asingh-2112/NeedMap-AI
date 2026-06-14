from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.models.enums import UserRole
from app.models.organization import Organization
from app.models.user import User
from app.models.volunteer import Volunteer
from app.models.volunteer_skill import VolunteerSkill
from app.schemas.volunteer import (
    VolunteerCreateRequest,
    VolunteerSkillCreateRequest,
    VolunteerSkillUpdateRequest,
    VolunteerUpdateRequest,
)


# ── Helpers ──────────────────────────────────────────────────────────────────


def _get_volunteer_or_404(db: Session, volunteer_id: int) -> Volunteer:
    volunteer = db.query(Volunteer).filter(Volunteer.id == volunteer_id).first()
    if volunteer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Volunteer not found")
    return volunteer


def _is_owner_or_admin(user: User) -> bool:
    return user.role in {UserRole.OWNER, UserRole.ADMIN}


def _ensure_volunteer_skill_access(current_user: User | None, volunteer: Volunteer) -> None:
    if current_user is None or _is_owner_or_admin(current_user):
        return
    if current_user.role == UserRole.VOLUNTEER and volunteer.user_id == current_user.id:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Not allowed to modify this volunteer's skills",
    )


# ── Volunteer CRUD ───────────────────────────────────────────────────────────


def create_volunteer(db: Session, current_user: User, payload: VolunteerCreateRequest) -> Volunteer:
    """Create a volunteer profile for the authenticated user."""

    # Only volunteers can create a volunteer profile
    if current_user.role != UserRole.VOLUNTEER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only users with volunteer role can create a volunteer profile",
        )

    # Check if the user already has a volunteer profile
    existing = db.query(Volunteer).filter(Volunteer.user_id == current_user.id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Volunteer profile already exists",
        )

    # If organization_id is provided, validate it exists and is active
    if payload.organization_id is not None:
        org = (
            db.query(Organization)
            .filter(Organization.id == payload.organization_id, Organization.is_active.is_(True))
            .first()
        )
        if org is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    volunteer = Volunteer(
        user_id=current_user.id,
        organization_id=payload.organization_id,
        availability=payload.availability,
    )
    db.add(volunteer)
    db.commit()
    db.refresh(volunteer)
    return volunteer


def list_volunteers(
    db: Session,
    availability: bool | None = None,
    organization_id: int | None = None,
    verified: bool | None = None,
) -> list[Volunteer]:
    query = (
        db.query(Volunteer)
        .options(joinedload(Volunteer.user), joinedload(Volunteer.skills))
        .filter(Volunteer.is_active.is_(True))
    )

    if availability is not None:
        query = query.filter(Volunteer.availability == availability)
    if organization_id is not None:
        query = query.filter(Volunteer.organization_id == organization_id)
    if verified is not None:
        query = query.filter(Volunteer.verified == verified)

    return query.order_by(Volunteer.created_at.desc()).all()


def get_volunteer_by_id(db: Session, volunteer_id: int) -> Volunteer:
    volunteer = (
        db.query(Volunteer)
        .options(joinedload(Volunteer.skills))
        .filter(Volunteer.id == volunteer_id)
        .first()
    )
    if volunteer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Volunteer not found")
    return volunteer


def get_my_volunteer_profile(db: Session, current_user: User) -> Volunteer:
    if current_user.role != UserRole.VOLUNTEER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only volunteers have a volunteer profile",
        )

    volunteer = (
        db.query(Volunteer)
        .options(joinedload(Volunteer.skills))
        .filter(Volunteer.user_id == current_user.id)
        .first()
    )
    if volunteer is None:
        volunteer = Volunteer(user_id=current_user.id, availability=True)
        db.add(volunteer)
        db.commit()
        db.refresh(volunteer)
    return volunteer


def update_volunteer(
    db: Session,
    current_user: User,
    volunteer_id: int,
    payload: VolunteerUpdateRequest,
) -> Volunteer:
    """Update volunteer profile. Only owner or admin can update."""
    volunteer = _get_volunteer_or_404(db, volunteer_id)

    if not _is_owner_or_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owner or admin can update volunteer profiles",
        )

    # If organization_id is being updated, validate it
    if payload.organization_id is not None:
        org = (
            db.query(Organization)
            .filter(Organization.id == payload.organization_id, Organization.is_active.is_(True))
            .first()
        )
        if org is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
        volunteer.organization_id = payload.organization_id

    if payload.availability is not None:
        volunteer.availability = payload.availability
    if payload.verified is not None:
        volunteer.verified = payload.verified
    if payload.rating is not None:
        volunteer.rating = payload.rating

    db.add(volunteer)
    db.commit()
    db.refresh(volunteer)
    return volunteer


# ── Volunteer Skills ─────────────────────────────────────────────────────────


def add_volunteer_skill(
    db: Session,
    volunteer_id: int,
    payload: VolunteerSkillCreateRequest,
    current_user: User | None = None,
) -> VolunteerSkill:
    """Add a skill to a volunteer."""
    volunteer = _get_volunteer_or_404(db, volunteer_id)
    _ensure_volunteer_skill_access(current_user, volunteer)

    # Check for duplicate skill name on this volunteer
    existing = (
        db.query(VolunteerSkill)
        .filter(
            VolunteerSkill.volunteer_id == volunteer.id,
            VolunteerSkill.skill_name == payload.skill_name,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Skill already exists for this volunteer",
        )

    skill = VolunteerSkill(
        volunteer_id=volunteer.id,
        skill_name=payload.skill_name,
        proficiency=payload.proficiency,
    )
    db.add(skill)
    db.commit()
    db.refresh(skill)
    return skill


def update_volunteer_skill(
    db: Session,
    volunteer_id: int,
    skill_id: int,
    payload: VolunteerSkillUpdateRequest,
    current_user: User | None = None,
) -> VolunteerSkill:
    """Update proficiency of a volunteer's skill."""
    volunteer = _get_volunteer_or_404(db, volunteer_id)
    _ensure_volunteer_skill_access(current_user, volunteer)

    skill = (
        db.query(VolunteerSkill)
        .filter(VolunteerSkill.id == skill_id, VolunteerSkill.volunteer_id == volunteer_id)
        .first()
    )
    if skill is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found")

    skill.proficiency = payload.proficiency
    db.add(skill)
    db.commit()
    db.refresh(skill)
    return skill


def list_volunteers_with_relations(
    db: Session,
    organization_id: int | None = None,
    verified: bool | None = None,
) -> list[Volunteer]:
    """
    Same filters as list_volunteers, but eagerly loads .user and .skills
    so the matching scorer can access geo coords and skill data without
    triggering lazy-load queries inside the ML module.
    """
    query = (
        db.query(Volunteer)
        .options(joinedload(Volunteer.user), joinedload(Volunteer.skills))
        .filter(Volunteer.is_active.is_(True))
    )
    if organization_id is not None:
        query = query.filter(Volunteer.organization_id == organization_id)
    if verified is not None:
        query = query.filter(Volunteer.verified == verified)
    return query.order_by(Volunteer.created_at.desc()).all()


def delete_volunteer_skill(
    db: Session,
    volunteer_id: int,
    skill_id: int,
    current_user: User | None = None,
) -> None:
    """Remove a skill from a volunteer."""
    volunteer = _get_volunteer_or_404(db, volunteer_id)
    _ensure_volunteer_skill_access(current_user, volunteer)

    skill = (
        db.query(VolunteerSkill)
        .filter(VolunteerSkill.id == skill_id, VolunteerSkill.volunteer_id == volunteer_id)
        .first()
    )
    if skill is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found")

    db.delete(skill)
    db.commit()
