from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import CampaignStatus


class CampaignCreateRequest(BaseModel):
    organization_id: int
    title: str = Field(..., min_length=2, max_length=255)
    description: str | None = None
    target_date: datetime | None = None
    goals: str | None = None  # JSON string
    target_volunteers: int | None = None


class CampaignUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=255)
    description: str | None = None
    target_date: datetime | None = None
    goals: str | None = None
    target_volunteers: int | None = None
    current_volunteers: int | None = None
    status: CampaignStatus | None = None


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
