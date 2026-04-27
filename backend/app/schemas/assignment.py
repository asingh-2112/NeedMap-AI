from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from app.models.enums import AssignmentStatus


# ── Assignment Schemas ────────────────────────────────────────────────────────


class AssignmentCreateRequest(BaseModel):
    need_id: int
    volunteer_id: int
    organization_id: int
    match_score: float | None = Field(default=None, ge=0, le=100)


class AssignmentStatusUpdateRequest(BaseModel):
    status: AssignmentStatus

    @model_validator(mode="after")
    def validate_status(self):
        # Only allow target statuses that make sense via the update endpoint
        allowed = {
            AssignmentStatus.ACCEPTED,
            AssignmentStatus.DECLINED,
            AssignmentStatus.IN_PROGRESS,
            AssignmentStatus.COMPLETED,
            AssignmentStatus.CANCELLED,
        }
        if self.status not in allowed:
            raise ValueError(f"Cannot transition to status '{self.status.value}' via this endpoint")
        return self


class AssignmentFeedbackRequest(BaseModel):
    feedback: str | None = Field(default=None, max_length=2000)
    rating: float | None = Field(default=None, ge=0.0, le=5.0)

    @model_validator(mode="after")
    def validate_payload(self):
        if self.feedback is None and self.rating is None:
            raise ValueError("Provide at least feedback or rating")
        return self


class AssignmentResponse(BaseModel):
    id: int
    need_id: int
    volunteer_id: int
    organization_id: int
    status: AssignmentStatus
    match_score: float | None
    assigned_at: datetime
    accepted_at: datetime | None
    completed_at: datetime | None
    feedback: str | None
    rating: float | None

    model_config = {"from_attributes": True}
