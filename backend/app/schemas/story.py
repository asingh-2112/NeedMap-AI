from datetime import datetime

from pydantic import BaseModel, Field


class StoryCreateRequest(BaseModel):
    organization_id: int
    title: str = Field(..., min_length=2, max_length=300)
    content: str = Field(..., min_length=10)
    image_url: str | None = None
    is_published: bool = False


class StoryUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=300)
    content: str | None = Field(default=None, min_length=10)
    image_url: str | None = None
    is_published: bool | None = None


class StoryResponse(BaseModel):
    id: int
    author_id: int
    organization_id: int | None
    title: str
    content: str
    image_url: str | None
    is_published: bool
    created_at: datetime

    model_config = {"from_attributes": True}
