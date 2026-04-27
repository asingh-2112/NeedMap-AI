from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.enums import NeedCategory, NeedStatus, NeedUrgency
from app.models.user import User
from app.schemas.need import (
    NeedCreateRequest,
    NeedHeatmapItem,
    NeedResponse,
    NeedSourceCreateRequest,
    NeedSourceResponse,
    NeedUpdateRequest,
)
from app.services.need_service import (
    add_need_source,
    close_need,
    create_need,
    get_need_by_id,
    list_need_heatmap_items,
    list_need_sources,
    list_needs,
    update_need,
)

router = APIRouter(prefix="/needs", tags=["Needs"])


@router.post("", response_model=NeedResponse, status_code=status.HTTP_201_CREATED)
def create_need_route(
    payload: NeedCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_need(db=db, current_user=current_user, payload=payload)


@router.get("", response_model=list[NeedResponse])
def list_needs_route(
    status: NeedStatus | None = None,
    urgency: NeedUrgency | None = None,
    category: NeedCategory | None = None,
    organization_id: int | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return list_needs(
        db=db,
        status_filter=status,
        urgency_filter=urgency,
        category_filter=category,
        organization_id=organization_id,
    )


@router.get("/heatmap", response_model=list[NeedHeatmapItem])
def heatmap_needs_route(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    items = list_need_heatmap_items(db=db)
    return [
        NeedHeatmapItem(
            id=item.id,
            title=item.title,
            category=item.category,
            urgency=item.urgency,
            latitude=item.latitude,
            longitude=item.longitude,
        )
        for item in items
    ]


@router.get("/{need_id}", response_model=NeedResponse)
def get_need_route(
    need_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return get_need_by_id(db=db, need_id=need_id)


@router.patch("/{need_id}", response_model=NeedResponse)
def update_need_route(
    need_id: int,
    payload: NeedUpdateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return update_need(db=db, need_id=need_id, payload=payload)


@router.delete("/{need_id}", status_code=status.HTTP_200_OK)
def close_need_route(
    need_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    close_need(db=db, need_id=need_id)
    return {"message": "Need closed successfully"}


@router.post("/{need_id}/sources", response_model=NeedSourceResponse, status_code=status.HTTP_201_CREATED)
def add_need_source_route(
    need_id: int,
    payload: NeedSourceCreateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return add_need_source(db=db, need_id=need_id, payload=payload)


@router.get("/{need_id}/sources", response_model=list[NeedSourceResponse])
def list_need_sources_route(
    need_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return list_need_sources(db=db, need_id=need_id)
