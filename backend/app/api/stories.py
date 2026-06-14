from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.story import StoryCreateRequest, StoryUpdateRequest, StoryResponse
from app.services.organization_service import get_accessible_organization_ids
from app.services import story_service

router = APIRouter(prefix="/api/stories", tags=["Stories"])


@router.post("/", response_model=StoryResponse)
def create_story(
    payload: StoryCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create an impact story."""
    allowed = set(get_accessible_organization_ids(db=db, current_user=current_user))
    if payload.organization_id not in allowed:
        raise HTTPException(status_code=403, detail="Not allowed to create story for this organization/branch")
    return story_service.create_story(db, payload, current_user.id)


@router.get("/", response_model=list[StoryResponse])
def list_stories(
    org_id: int | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List impact stories."""
    allowed = set(get_accessible_organization_ids(db=db, current_user=current_user))
    if org_id is not None and org_id not in allowed:
        raise HTTPException(status_code=403, detail="Not allowed to view this organization/branch stories")
    return story_service.get_stories(
        db,
        org_id=org_id,
        org_ids=None if org_id is not None else list(allowed),
        limit=limit,
        offset=offset,
    )


@router.get("/{story_id}", response_model=StoryResponse)
def get_story(
    story_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a single impact story."""
    story = story_service.get_story(db, story_id)
    allowed = set(get_accessible_organization_ids(db=db, current_user=current_user))
    if story.organization_id not in allowed:
        raise HTTPException(status_code=403, detail="Not allowed to view this story")
    return story


@router.put("/{story_id}", response_model=StoryResponse)
def update_story(
    story_id: int,
    payload: StoryUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update an impact story."""
    story = story_service.get_story(db, story_id)
    allowed = set(get_accessible_organization_ids(db=db, current_user=current_user))
    if story.organization_id not in allowed:
        raise HTTPException(status_code=403, detail="Not allowed to update this story")
    return story_service.update_story(db, story_id, payload)


@router.delete("/{story_id}")
def delete_story(
    story_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete an impact story."""
    story = story_service.get_story(db, story_id)
    allowed = set(get_accessible_organization_ids(db=db, current_user=current_user))
    if story.organization_id not in allowed:
        raise HTTPException(status_code=403, detail="Not allowed to delete this story")
    story_service.delete_story(db, story_id)
    return {"message": "Story deleted successfully"}
