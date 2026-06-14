from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import NominationStatus


class NominationCreateRequest(BaseModel):
    message: str | None = Field(default=None, max_length=500)


class NominationResponse(BaseModel):
    id: int
    need_id: int
    volunteer_id: int
    status: NominationStatus
    message: str | None
    reviewed_by: int | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
