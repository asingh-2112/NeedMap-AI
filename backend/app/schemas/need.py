from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from app.models.enums import NeedCategory, NeedStatus, NeedUrgency, SourceType


class NeedCreateRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    description: str | None = None
    category: NeedCategory
    urgency: NeedUrgency
    organization_id: int
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    address: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def validate_location_pair(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Both latitude and longitude are required together")
        return self


class NeedUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=255)
    description: str | None = None
    category: NeedCategory | None = None
    urgency: NeedUrgency | None = None
    status: NeedStatus | None = None
    organization_id: int | None = None
    priority_score: float | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    address: str | None = Field(default=None, max_length=500)
    resolved_at: datetime | None = None

    @model_validator(mode="after")
    def validate_payload(self):
        if (
            self.title is None
            and self.description is None
            and self.category is None
            and self.urgency is None
            and self.status is None
            and self.organization_id is None
            and self.priority_score is None
            and self.latitude is None
            and self.longitude is None
            and self.address is None
            and self.resolved_at is None
        ):
            raise ValueError("Provide at least one field to update")

        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Both latitude and longitude are required together")
        return self


class NeedResponse(BaseModel):
    id: int
    title: str
    description: str | None
    category: NeedCategory
    urgency: NeedUrgency
    status: NeedStatus
    organization_id: int
    created_by: int | None
    priority_score: float | None
    latitude: float | None
    longitude: float | None
    address: str | None
    created_at: datetime
    resolved_at: datetime | None

    model_config = {"from_attributes": True}


class NeedHeatmapItem(BaseModel):
    id: int
    title: str
    category: NeedCategory
    urgency: NeedUrgency
    latitude: float
    longitude: float


class NeedSourceCreateRequest(BaseModel):
    source_type: SourceType
    location: str | None = Field(default=None, max_length=100)
    multimedia_txt: str | None = Field(default=None, max_length=500)
    ai_extraction: str | None = Field(default=None, max_length=500)


class NeedSourceResponse(BaseModel):
    id: int
    need_id: int
    source_type: SourceType
    location: str | None
    multimedia_txt: str | None
    ai_extraction: str | None
    processed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}
