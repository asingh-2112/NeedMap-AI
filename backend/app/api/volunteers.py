from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.ml.matching import extract_skills_from_text
from app.models.enums import Proficiency
from app.models.user import User
from app.schemas.volunteer import (
    VolunteerCreateRequest,
    VolunteerResponse,
    VolunteerSkillCreateRequest,
    VolunteerSkillResponse,
    VolunteerSkillUpdateRequest,
    VolunteerUpdateRequest,
)
from app.services.volunteer_service import (
    add_volunteer_skill,
    create_volunteer,
    delete_volunteer_skill,
    get_volunteer_by_id,
    list_volunteers,
    update_volunteer,
    update_volunteer_skill,
)  # get_volunteer_by_id used for re-fetch after skill extraction

router = APIRouter(prefix="/volunteers", tags=["Volunteers"])


# ── Volunteer CRUD ───────────────────────────────────────────────────────────


@router.post("", response_model=VolunteerResponse, status_code=status.HTTP_201_CREATED)
def create_volunteer_route(
    payload: VolunteerCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    volunteer = create_volunteer(db=db, current_user=current_user, payload=payload)

    # Auto-extract skills from bio if provided
    if payload.bio:
        extracted = extract_skills_from_text(payload.bio)
        for skill_name in extracted:
            try:
                add_volunteer_skill(
                    db=db,
                    volunteer_id=volunteer.id,
                    payload=VolunteerSkillCreateRequest(
                        skill_name=skill_name,
                        proficiency=Proficiency.BEGINNER,
                    ),
                )
            except HTTPException:
                pass  # skill already exists — skip silently
        # Re-fetch with eager-loaded skills so the response includes them
        return get_volunteer_by_id(db=db, volunteer_id=volunteer.id)

    return volunteer


@router.get("", response_model=list[VolunteerResponse])
def list_volunteers_route(
    availability: bool | None = None,
    organization_id: int | None = None,
    verified: bool | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return list_volunteers(
        db=db,
        availability=availability,
        organization_id=organization_id,
        verified=verified,
    )


@router.get("/{volunteer_id}", response_model=VolunteerResponse)
def get_volunteer_route(
    volunteer_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return get_volunteer_by_id(db=db, volunteer_id=volunteer_id)


@router.patch("/{volunteer_id}", response_model=VolunteerResponse)
def update_volunteer_route(
    volunteer_id: int,
    payload: VolunteerUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return update_volunteer(db=db, current_user=current_user, volunteer_id=volunteer_id, payload=payload)


# ── Volunteer Skills ─────────────────────────────────────────────────────────


@router.post(
    "/{volunteer_id}/skills",
    response_model=VolunteerSkillResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_skill_route(
    volunteer_id: int,
    payload: VolunteerSkillCreateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return add_volunteer_skill(db=db, volunteer_id=volunteer_id, payload=payload)


@router.patch(
    "/{volunteer_id}/skills/{skill_id}",
    response_model=VolunteerSkillResponse,
)
def update_skill_route(
    volunteer_id: int,
    skill_id: int,
    payload: VolunteerSkillUpdateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return update_volunteer_skill(db=db, volunteer_id=volunteer_id, skill_id=skill_id, payload=payload)


@router.delete("/{volunteer_id}/skills/{skill_id}", status_code=status.HTTP_200_OK)
def delete_skill_route(
    volunteer_id: int,
    skill_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    delete_volunteer_skill(db=db, volunteer_id=volunteer_id, skill_id=skill_id)
    return {"message": "Skill removed successfully"}
