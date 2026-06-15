from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import NotificationType


class NotificationResponse(BaseModel):
    id: int
    user_id: int
    type: NotificationType
    title: str
    message: str | None
    payload_json: str | None
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationMarkReadRequest(BaseModel):
    notification_ids: list[int] = Field(..., min_length=1)
