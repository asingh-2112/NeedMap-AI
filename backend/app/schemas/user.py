from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, model_validator

from app.models.enums import UserRole


# ── Request schemas (what the client sends) ──────────────────────────────────

class UserRegisterRequest(BaseModel):
    user_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=8)
    role: UserRole = UserRole.VOLUNTEER
    phone: str | None = Field(default=None, max_length=20)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    radius_km: float | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def validate_location_pair(self):
        has_lat = self.latitude is not None
        has_lng = self.longitude is not None
        if has_lat != has_lng:
            raise ValueError("Both latitude and longitude are required together")
        return self


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserLocationUpdateRequest(BaseModel):
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    radius_km: float | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def validate_location_update(self):
        has_lat = self.latitude is not None
        has_lng = self.longitude is not None

        if has_lat != has_lng:
            raise ValueError("Both latitude and longitude are required together")

        if not has_lat and self.radius_km is None:
            raise ValueError("Provide latitude/longitude or radius_km")

        return self


# ── Response schemas (what the server returns) ────────────────────────────────

class UserResponse(BaseModel):
    id: int
    user_name: str
    email: str
    role: UserRole
    phone: str | None
    organization_id: int | None
    latitude: float | None
    longitude: float | None
    radius_km: float | None
    is_active: bool
    last_seen: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
