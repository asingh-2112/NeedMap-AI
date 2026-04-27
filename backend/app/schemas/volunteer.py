from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from app.models.enums import Proficiency


# ── Volunteer Schemas ─────────────────────────────────────────────────────────


class VolunteerCreateRequest(BaseModel):
    organization_id: int | None = None
    availability: bool = True
    bio: str | None = Field(
        default=None,
        max_length=1000,
        description="Optional bio used to auto-extract skills on profile creation. Not stored in DB.",
    )


class VolunteerUpdateRequest(BaseModel):
    availability: bool | None = None
    organization_id: int | None = None
    verified: bool | None = None

    @model_validator(mode="after")
    def validate_payload(self):
        if self.availability is None and self.organization_id is None and self.verified is None:
            raise ValueError("Provide at least one field to update")
        return self


class VolunteerResponse(BaseModel):
    id: int
    user_id: int
    organization_id: int | None
    availability: bool
    rating: float | None
    tasks_completed: int
    active_tasks: int
    is_active: bool
    verified: bool
    skills: list["VolunteerSkillResponse"] = []
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Volunteer Skill Schemas ───────────────────────────────────────────────────


class VolunteerSkillCreateRequest(BaseModel):
    skill_name: str = Field(..., min_length=2, max_length=100)
    proficiency: Proficiency


class VolunteerSkillUpdateRequest(BaseModel):
    proficiency: Proficiency


class VolunteerSkillResponse(BaseModel):
    id: int
    volunteer_id: int
    skill_name: str
    proficiency: Proficiency

    model_config = {"from_attributes": True}
