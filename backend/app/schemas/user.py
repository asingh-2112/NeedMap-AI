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


class UserProfileUpdateRequest(BaseModel):
    user_name: str | None = Field(default=None, min_length=2, max_length=255)
    phone: str | None = Field(default=None, max_length=20)
    house_number: str | None = Field(default=None, max_length=50)
    street: str | None = Field(default=None, max_length=255)
    colony: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)
    pincode: str | None = Field(default=None, max_length=10)
    country: str | None = Field(default=None, max_length=100)
    preferred_language: str | None = Field(default=None, max_length=10)


class AddMemberRequest(BaseModel):
    """Used by org owner/admin to add a member to their organization."""
    user_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=8)
    role: UserRole
    managed_branch_id: int | None = None
    phone: str | None = Field(default=None, max_length=20)

    @model_validator(mode="after")
    def validate_role(self):
        if self.role == UserRole.OWNER:
            raise ValueError("Owner role is assigned only during organization registration")
        if self.role == UserRole.ADMIN and self.managed_branch_id is None:
            raise ValueError("managed_branch_id is required when role is admin")
        if self.role != UserRole.ADMIN and self.managed_branch_id is not None:
            raise ValueError("managed_branch_id is only valid for admin role")
        return self


class PasswordChangeRequest(BaseModel):
    old_password: str = Field(..., min_length=8)
    new_password: str = Field(..., min_length=8)

    @model_validator(mode="after")
    def passwords_differ(self):
        if self.old_password == self.new_password:
            raise ValueError("New password must be different from old password")
        return self


# ── Response schemas (what the server returns) ────────────────────────────────

class UserResponse(BaseModel):
    id: int
    user_name: str
    email: str
    role: UserRole
    phone: str | None
    organization_id: int | None
    managed_branch_id: int | None = None
    latitude: float | None
    longitude: float | None
    radius_km: float | None
    house_number: str | None = None
    street: str | None = None
    colony: str | None = None
    city: str | None = None
    state: str | None = None
    pincode: str | None = None
    country: str | None = None
    preferred_language: str = "en"
    is_active: bool
    last_seen: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
