from datetime import datetime

from pydantic import BaseModel, Field


class StoryCreateRequest(BaseModel):
    organization_id: int
    need_id: int | None = None
    title: str = Field(..., min_length=2, max_length=255)
    narrative: str = Field(..., min_length=10)
    media_urls: str | None = None  # JSON array string
    metrics: str | None = None  # JSON string


class StoryUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=255)
    narrative: str | None = Field(default=None, min_length=10)
    need_id: int | None = None
    media_urls: str | None = None
    metrics: str | None = None


class StoryResponse(BaseModel):
    id: int
    organization_id: int
    need_id: int | None
    title: str
    narrative: str
    media_urls: str | None
    metrics: str | None
    created_by: int | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
