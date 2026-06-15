from datetime import datetime

from pydantic import BaseModel, Field, model_validator
from typing_extensions import Self


class CampaignCreateRequest(BaseModel):
    organization_id: int = Field(..., gt=0)
    title: str = Field(..., min_length=2, max_length=300)
    description: str | None = None
    goal_amount: float | None = None
    cover_image_url: str | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None

    @model_validator(mode="after")
    def validate_description(self) -> Self:
        if not self.description or not self.description.strip():
            raise ValueError("Description is required")
        return self


class CampaignUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=300)
    description: str | None = None
    goal_amount: float | None = None
    raised_amount: float | None = None
    cover_image_url: str | None = None
    is_active: bool | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None

    @model_validator(mode="after")
    def validate_at_least_one(self) -> Self:
        fields = ("title", "description", "goal_amount", "raised_amount",
                   "cover_image_url", "is_active", "starts_at", "ends_at")
        if all(getattr(self, f) is None for f in fields):
            raise ValueError("Provide at least one field to update")
        return self


class CampaignResponse(BaseModel):
    id: int
    organization_id: int
    title: str
    description: str | None
    goal_amount: float | None
    raised_amount: float | None
    cover_image_url: str | None
    is_active: bool
    starts_at: datetime | None
    ends_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}
