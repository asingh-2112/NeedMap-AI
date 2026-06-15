from datetime import datetime, timezone, timedelta

from fastapi import HTTPException
from sqlalchemy import func, extract
from sqlalchemy.orm import Session

from app.models.assignment import Assignment
from app.models.need import Need
from app.models.volunteer import Volunteer
from app.models.enums import AssignmentStatus, NeedStatus, NeedCategory


def get_org_dashboard(db: Session, org_id: int) -> dict:
    """Get org-level impact dashboard metrics."""
    # Total needs resolved
    needs_resolved = (
        db.query(func.count(Need.id))
        .filter(Need.organization_id == org_id, Need.status == NeedStatus.RESOLVED)
        .scalar()
    ) or 0

    # Total needs
    total_needs = (
        db.query(func.count(Need.id))
        .filter(Need.organization_id == org_id)
        .scalar()
    ) or 0

    # Average response time (created_at to resolved_at in hours)
    avg_response = (
        db.query(
            func.avg(
                extract("epoch", Need.resolved_at) - extract("epoch", Need.created_at)
            )
        )
        .filter(
            Need.organization_id == org_id,
            Need.resolved_at.isnot(None),
        )
        .scalar()
    )
    avg_response_hours = round(avg_response / 3600, 1) if avg_response else 0

    # Total lives impacted (sum of affected_count)
    lives_impacted = (
        db.query(func.sum(Need.affected_count))
        .filter(Need.organization_id == org_id, Need.affected_count.isnot(None))
        .scalar()
    ) or 0

    # Active volunteers
    active_volunteers = (
        db.query(func.count(Volunteer.id))
        .filter(Volunteer.organization_id == org_id, Volunteer.is_active == True)  # noqa: E712
        .scalar()
    ) or 0

    # Total assignments completed
    tasks_completed = (
        db.query(func.count(Assignment.id))
        .filter(
            Assignment.organization_id == org_id,
            Assignment.status == AssignmentStatus.COMPLETED,
        )
        .scalar()
    ) or 0

    return {
        "needs_resolved": needs_resolved,
        "total_needs": total_needs,
        "avg_response_hours": avg_response_hours,
        "lives_impacted": lives_impacted,
        "active_volunteers": active_volunteers,
        "tasks_completed": tasks_completed,
    }


def get_org_trends(db: Session, org_id: int, days: int = 30) -> list[dict]:
    """Get daily trend data for the org over the past N days."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    # Needs created per day
    results = (
        db.query(
            func.date(Need.created_at).label("date"),
            func.count(Need.id).label("needs_created"),
        )
        .filter(Need.organization_id == org_id, Need.created_at >= cutoff)
        .group_by(func.date(Need.created_at))
        .order_by(func.date(Need.created_at))
        .all()
    )

    # Needs resolved per day
    resolved = (
        db.query(
            func.date(Need.resolved_at).label("date"),
            func.count(Need.id).label("needs_resolved"),
        )
        .filter(
            Need.organization_id == org_id,
            Need.resolved_at.isnot(None),
            Need.resolved_at >= cutoff,
        )
        .group_by(func.date(Need.resolved_at))
        .order_by(func.date(Need.resolved_at))
        .all()
    )

    resolved_map = {str(r.date): r.needs_resolved for r in resolved}

    trends = []
    for row in results:
        trends.append({
            "date": str(row.date),
            "needs_created": row.needs_created,
            "needs_resolved": resolved_map.get(str(row.date), 0),
        })

    return trends


def get_category_breakdown(db: Session, org_id: int) -> list[dict]:
    """Get needs count by category for the org."""
    results = (
        db.query(
            Need.category,
            func.count(Need.id).label("count"),
        )
        .filter(Need.organization_id == org_id)
        .group_by(Need.category)
        .all()
    )
    return [{"category": r.category.value, "count": r.count} for r in results]


def get_volunteer_leaderboard(db: Session, org_id: int, limit: int = 10) -> list[dict]:
    """Get top volunteers by tasks completed."""
    results = (
        db.query(Volunteer)
        .filter(Volunteer.organization_id == org_id, Volunteer.is_active == True)  # noqa: E712
        .order_by(Volunteer.tasks_completed.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "volunteer_id": v.id,
            "user_id": v.user_id,
            "tasks_completed": v.tasks_completed,
            "rating": v.rating,
            "verified": v.verified,
        }
        for v in results
    ]
