from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.campaign import Campaign
from app.schemas.campaign import CampaignCreateRequest, CampaignUpdateRequest


def create_campaign(db: Session, payload: CampaignCreateRequest, user_id: int) -> Campaign:
    """Create a campaign."""
    campaign = Campaign(
        organization_id=payload.organization_id,
        title=payload.title,
        description=payload.description or "",
        goal_amount=payload.goal_amount,
        cover_image_url=payload.cover_image_url,
        starts_at=payload.starts_at,
        ends_at=payload.ends_at,
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign


def get_campaigns(
    db: Session,
    org_id: int | None = None,
    org_ids: list[int] | None = None,
    limit: int = 20,
    offset: int = 0,
) -> list[Campaign]:
    """List campaigns with optional filters."""
    query = db.query(Campaign)
    if org_id is not None:
        query = query.filter(Campaign.organization_id == org_id)
    elif org_ids is not None:
        query = query.filter(Campaign.organization_id.in_(org_ids))
    return query.order_by(Campaign.created_at.desc()).offset(offset).limit(limit).all()


def get_campaign(db: Session, campaign_id: int) -> Campaign:
    """Get a single campaign."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


def update_campaign(db: Session, campaign_id: int, payload: CampaignUpdateRequest) -> Campaign:
    """Update a campaign."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(campaign, field, value)

    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign


def delete_campaign(db: Session, campaign_id: int) -> None:
    """Delete a campaign."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    db.delete(campaign)
    db.commit()
