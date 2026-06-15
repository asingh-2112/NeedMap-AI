from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, model_validator
from typing_extensions import Self
import re

from app.models.enums import UserRole

_PHONE_RE = re.compile(r"^\+?[0-9\-\s()]{7,20}$")
_PASSWORD_UPPER = re.compile(r"[A-Z]")
_PASSWORD_DIGIT = re.compile(r"[0-9]")
_PASSWORD_SPECIAL = re.compile(r"[!@#$%^&*(),.?\":{}|<>]")


def _validate_password_strength(password: str) -> str:
    """Validate password meets strength requirements. Returns the password if valid."""
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters")
    if not _PASSWORD_UPPER.search(password):
        raise ValueError("Password must contain at least one uppercase letter")
    if not _PASSWORD_DIGIT.search(password):
        raise ValueError("Password must contain at least one digit")
    if not _PASSWORD_SPECIAL.search(password):
        raise ValueError("Password must contain at least one special character")
    return password


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
    def validate_password(self) -> Self:
        _validate_password_strength(self.password)
        return self

    @model_validator(mode="after")
    def validate_phone(self) -> Self:
        if self.phone and not _PHONE_RE.match(self.phone.strip()):
            raise ValueError("Invalid phone number format")
        return self

    @model_validator(mode="after")
    def validate_location_pair(self) -> Self:
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

    @model_validator(mode="after")
    def validate_phone(self) -> Self:
        if self.phone and not _PHONE_RE.match(self.phone.strip()):
            raise ValueError("Invalid phone number format")
        return self


class AddMemberRequest(BaseModel):
    """Used by org owner/admin to add a member to their organization."""
    user_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=8)
    role: UserRole
    managed_branch_id: int | None = None
    phone: str | None = Field(default=None, max_length=20)

    @model_validator(mode="after")
    def validate_password(self) -> Self:
        _validate_password_strength(self.password)
        return self

    @model_validator(mode="after")
    def validate_phone(self) -> Self:
        if self.phone and not _PHONE_RE.match(self.phone.strip()):
            raise ValueError("Invalid phone number format")
        return self

    @model_validator(mode="after")
    def validate_role(self) -> Self:
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
    def validate_new_password(self) -> Self:
        _validate_password_strength(self.new_password)
        return self

    @model_validator(mode="after")
    def passwords_differ(self) -> Self:
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
