from datetime import datetime

from pydantic import BaseModel, Field, model_validator
from typing_extensions import Self

from app.models.enums import CampaignStatus


class CampaignCreateRequest(BaseModel):
    organization_id: int = Field(..., gt=0)
    title: str = Field(..., min_length=2, max_length=255)
    description: str | None = None
    target_date: datetime | None = None
    goals: str | None = None  # JSON string
    target_volunteers: int | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def validate_description(self) -> Self:
        if not self.description or not self.description.strip():
            raise ValueError("Description is required")
        return self


class CampaignUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=255)
    description: str | None = None
    target_date: datetime | None = None
    goals: str | None = None
    target_volunteers: int | None = Field(default=None, ge=0)
    current_volunteers: int | None = Field(default=None, ge=0)
    status: CampaignStatus | None = None

    @model_validator(mode="after")
    def validate_at_least_one(self) -> Self:
        fields = ("title", "description", "target_date", "goals",
                   "target_volunteers", "current_volunteers", "status")
        if all(getattr(self, f) is None for f in fields):
            raise ValueError("Provide at least one field to update")
        return self


class CampaignResponse(BaseModel):
    id: int
    organization_id: int
    title: str
    description: str | None
    target_date: datetime | None
    goals: str | None
    target_volunteers: int | None
    current_volunteers: int
    status: CampaignStatus
    created_by: int | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
