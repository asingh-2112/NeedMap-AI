from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.services.organization_service import get_accessible_organization_ids
from app.services import analytics_service

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


@router.get("/org/{org_id}/dashboard")
def org_dashboard(
    org_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get org-level impact dashboard metrics."""
    allowed = set(get_accessible_organization_ids(db=db, current_user=current_user))
    if org_id not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to access this organization/branch analytics",
        )
    return analytics_service.get_org_dashboard(db, org_id)


@router.get("/org/{org_id}/trends")
def org_trends(
    org_id: int,
    days: int = Query(default=30, ge=7, le=365),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get daily trend data for charting."""
    allowed = set(get_accessible_organization_ids(db=db, current_user=current_user))
    if org_id not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to access this organization/branch analytics",
        )
    return analytics_service.get_org_trends(db, org_id, days=days)


@router.get("/org/{org_id}/category-breakdown")
def category_breakdown(
    org_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get needs count by category for pie charts."""
    allowed = set(get_accessible_organization_ids(db=db, current_user=current_user))
    if org_id not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to access this organization/branch analytics",
        )
    return analytics_service.get_category_breakdown(db, org_id)


@router.get("/org/{org_id}/volunteer-leaderboard")
def volunteer_leaderboard(
    org_id: int,
    limit: int = Query(default=10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get top volunteers by tasks completed."""
    allowed = set(get_accessible_organization_ids(db=db, current_user=current_user))
    if org_id not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to access this organization/branch analytics",
        )
    return analytics_service.get_volunteer_leaderboard(db, org_id, limit=limit)
