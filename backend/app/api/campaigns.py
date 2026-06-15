from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.campaign import CampaignCreateRequest, CampaignUpdateRequest, CampaignResponse
from app.services.organization_service import get_accessible_organization_ids
from app.services import campaign_service

router = APIRouter(prefix="/api/campaigns", tags=["Campaigns"])


@router.post("/", response_model=CampaignResponse)
def create_campaign(
    payload: CampaignCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a future campaign."""
    allowed = set(get_accessible_organization_ids(db=db, current_user=current_user))
    if payload.organization_id not in allowed:
        raise HTTPException(status_code=403, detail="Not allowed to create campaign for this organization/branch")
    return campaign_service.create_campaign(db, payload, current_user.id)


@router.get("/", response_model=list[CampaignResponse])
def list_campaigns(
    org_id: int | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List campaigns with optional filters."""
    allowed = set(get_accessible_organization_ids(db=db, current_user=current_user))
    if org_id is not None and org_id not in allowed:
        raise HTTPException(status_code=403, detail="Not allowed to view this organization/branch campaigns")
    return campaign_service.get_campaigns(
        db,
        org_id=org_id,
        org_ids=None if org_id is not None else list(allowed),
        limit=limit,
        offset=offset,
    )


@router.get("/{campaign_id}", response_model=CampaignResponse)
def get_campaign(
    campaign_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a single campaign."""
    campaign = campaign_service.get_campaign(db, campaign_id)
    allowed = set(get_accessible_organization_ids(db=db, current_user=current_user))
    if campaign.organization_id not in allowed:
        raise HTTPException(status_code=403, detail="Not allowed to view this campaign")
    return campaign


@router.patch("/{campaign_id}", response_model=CampaignResponse)
def update_campaign(
    campaign_id: int,
    payload: CampaignUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a campaign."""
    campaign = campaign_service.get_campaign(db, campaign_id)
    allowed = set(get_accessible_organization_ids(db=db, current_user=current_user))
    if campaign.organization_id not in allowed:
        raise HTTPException(status_code=403, detail="Not allowed to update this campaign")
    return campaign_service.update_campaign(db, campaign_id, payload)


@router.put("/{campaign_id}", response_model=CampaignResponse)
def replace_campaign(
    campaign_id: int,
    payload: CampaignUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a campaign (PUT alias for compatibility)."""
    campaign = campaign_service.get_campaign(db, campaign_id)
    allowed = set(get_accessible_organization_ids(db=db, current_user=current_user))
    if campaign.organization_id not in allowed:
        raise HTTPException(status_code=403, detail="Not allowed to update this campaign")
    return campaign_service.update_campaign(db, campaign_id, payload)


@router.delete("/{campaign_id}")
def delete_campaign(
    campaign_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a campaign."""
    campaign = campaign_service.get_campaign(db, campaign_id)
    allowed = set(get_accessible_organization_ids(db=db, current_user=current_user))
    if campaign.organization_id not in allowed:
        raise HTTPException(status_code=403, detail="Not allowed to delete this campaign")
    campaign_service.delete_campaign(db, campaign_id)
    return {"message": "Campaign deleted successfully"}
