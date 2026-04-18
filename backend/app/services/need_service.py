import math

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.enums import NeedStatus
from app.models.need import Need
from app.models.need_source import NeedSource
from app.models.organization import Organization
from app.models.user import User
from app.schemas.need import NeedCreateRequest, NeedSourceCreateRequest, NeedUpdateRequest


def _get_active_organization(db: Session, organization_id: int) -> Organization:
    organization = (
        db.query(Organization)
        .filter(Organization.id == organization_id, Organization.is_active.is_(True))
        .first()
    )
    if organization is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return organization


def create_need(db: Session, current_user: User, payload: NeedCreateRequest) -> Need:
    _get_active_organization(db, payload.organization_id)

    need = Need(
        title=payload.title,
        description=payload.description,
        category=payload.category,
        urgency=payload.urgency,
        status=NeedStatus.NEW,
        organization_id=payload.organization_id,
        created_by=current_user.id,
        latitude=payload.latitude,
        longitude=payload.longitude,
        address=payload.address,
    )
    db.add(need)
    db.commit()
    db.refresh(need)
    return need


def list_needs(
    db: Session,
    status_filter=None,
    urgency_filter=None,
    category_filter=None,
    organization_id: int | None = None,
) -> list[Need]:
    query = db.query(Need)

    if status_filter is not None:
        query = query.filter(Need.status == status_filter)
    if urgency_filter is not None:
        query = query.filter(Need.urgency == urgency_filter)
    if category_filter is not None:
        query = query.filter(Need.category == category_filter)
    if organization_id is not None:
        query = query.filter(Need.organization_id == organization_id)

    return query.order_by(Need.created_at.desc()).all()


def list_need_heatmap_items(db: Session) -> list[Need]:
    return (
        db.query(Need)
        .filter(Need.status != NeedStatus.CLOSED)
        .order_by(Need.created_at.desc())
        .all()
    )


def get_need_by_id(db: Session, need_id: int) -> Need:
    need = db.query(Need).filter(Need.id == need_id).first()
    if need is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Need not found")
    return need


def update_need(db: Session, need_id: int, payload: NeedUpdateRequest) -> Need:
    need = get_need_by_id(db, need_id)

    if payload.organization_id is not None:
        _get_active_organization(db, payload.organization_id)
        need.organization_id = payload.organization_id

    if payload.title is not None:
        need.title = payload.title
    if payload.description is not None:
        need.description = payload.description
    if payload.category is not None:
        need.category = payload.category
    if payload.urgency is not None:
        need.urgency = payload.urgency
    if payload.status is not None:
        need.status = payload.status
    if payload.priority_score is not None:
        need.priority_score = payload.priority_score
    if payload.latitude is not None:
        need.latitude = payload.latitude
    if payload.longitude is not None:
        need.longitude = payload.longitude
    if payload.address is not None:
        need.address = payload.address
    if payload.resolved_at is not None:
        need.resolved_at = payload.resolved_at

    db.add(need)
    db.commit()
    db.refresh(need)
    return need


def close_need(db: Session, need_id: int) -> None:
    need = get_need_by_id(db, need_id)
    need.status = NeedStatus.CLOSED
    db.add(need)
    db.commit()


def add_need_source(db: Session, need_id: int, payload: NeedSourceCreateRequest) -> NeedSource:
    get_need_by_id(db, need_id)

    source = NeedSource(
        need_id=need_id,
        source_type=payload.source_type,
        location=payload.location,
        multimedia_txt=payload.multimedia_txt,
        ai_extraction=payload.ai_extraction,
    )
    db.add(source)
    db.commit()
    db.refresh(source)
    return source


def list_need_sources(db: Session, need_id: int) -> list[NeedSource]:
    get_need_by_id(db, need_id)
    return (
        db.query(NeedSource)
        .filter(NeedSource.need_id == need_id)
        .order_by(NeedSource.created_at.desc())
        .all()
    )


# ── ML helper functions ───────────────────────────────────────────────────────

def count_need_sources(db: Session, need_id: int) -> int:
    return db.query(NeedSource).filter(NeedSource.need_id == need_id).count()


def count_nearby_open_needs(db: Session, lat: float, lng: float, radius_km: float = 5.0) -> int:
    """
    Counts open needs within ~radius_km of (lat, lng) using a bounding-box
    approximation. Excludes the exact location match to avoid self-counting
    (caller should subtract 1 if the current need is already in the DB).
    """
    delta_lat = radius_km / 111.0
    delta_lng = radius_km / (111.0 * math.cos(math.radians(lat)))
    return (
        db.query(Need)
        .filter(
            Need.status != NeedStatus.CLOSED,
            Need.latitude.between(lat - delta_lat, lat + delta_lat),
            Need.longitude.between(lng - delta_lng, lng + delta_lng),
        )
        .count()
    )


def set_priority_score(db: Session, need: Need, score: float) -> None:
    need.priority_score = score
    db.add(need)
    db.commit()
    db.refresh(need)
