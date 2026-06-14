from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, model_validator


# ── Organization + Admin registration (public, no token) ─────────────────────

class OrganizationRegisterRequest(BaseModel):
    """Public endpoint: register an org and its owner in one step."""
    organization_name: str = Field(..., min_length=2, max_length=255)
    address: str | None = Field(default=None, max_length=500)
    phone: str | None = Field(default=None, max_length=20)
    owner_name: str = Field(..., min_length=2, max_length=255)
    owner_email: EmailStr
    owner_password: str = Field(..., min_length=8)


class OrganizationRegisterResponse(BaseModel):
    """Returned after org registration — org info + token so owner is logged in."""
    organization: "OrganizationResponse"
    access_token: str
    token_type: str = "bearer"
    expires_in: int


# ── Existing CRUD schemas ─────────────────────────────────────────────────────

class OrganizationCreateRequest(BaseModel):
    organization_name: str = Field(..., min_length=2, max_length=255)
    address: str | None = Field(default=None, max_length=500)
    phone: str | None = Field(default=None, max_length=20)


class OrganizationUpdateRequest(BaseModel):
    organization_name: str | None = Field(default=None, min_length=2, max_length=255)
    address: str | None = Field(default=None, max_length=500)
    phone: str | None = Field(default=None, max_length=20)
    is_active: bool | None = None

    @model_validator(mode="after")
    def validate_at_least_one_field(self):
        if (
            self.organization_name is None
            and self.address is None
            and self.phone is None
            and self.is_active is None
        ):
            raise ValueError("Provide at least one field to update")
        return self


class OrganizationResponse(BaseModel):
    id: int
    parent_organization_id: int | None = None
    organization_name: str
    branch_location: str | None = None
    is_branch: bool = False
    address: str | None
    phone: str | None
    user_id: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# Resolve forward reference for OrganizationRegisterResponse
OrganizationRegisterResponse.model_rebuild()


class BranchCreateRequest(BaseModel):
    organization_name: str = Field(..., min_length=2, max_length=255)
    branch_location: str = Field(..., min_length=2, max_length=255)
    address: str | None = Field(default=None, max_length=500)
    phone: str | None = Field(default=None, max_length=20)


class BranchResponse(OrganizationResponse):
    pass
