from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.story import Story
from app.schemas.story import StoryCreateRequest, StoryUpdateRequest


def create_story(db: Session, payload: StoryCreateRequest, user_id: int) -> Story:
    """Create an impact story."""
    story = Story(
        organization_id=payload.organization_id,
        need_id=payload.need_id,
        title=payload.title,
        narrative=payload.narrative,
        media_urls=payload.media_urls,
        metrics=payload.metrics,
        created_by=user_id,
    )
    db.add(story)
    db.commit()
    db.refresh(story)
    return story


def get_stories(
    db: Session,
    org_id: int | None = None,
    org_ids: list[int] | None = None,
    limit: int = 20,
    offset: int = 0,
) -> list[Story]:
    """List stories, optionally filtered by org."""
    query = db.query(Story)
    if org_id is not None:
        query = query.filter(Story.organization_id == org_id)
    elif org_ids is not None:
        query = query.filter(Story.organization_id.in_(org_ids))
    return query.order_by(Story.created_at.desc()).offset(offset).limit(limit).all()


def get_story(db: Session, story_id: int) -> Story:
    """Get a single story by ID."""
    story = db.query(Story).filter(Story.id == story_id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


def update_story(db: Session, story_id: int, payload: StoryUpdateRequest) -> Story:
    """Update an impact story."""
    story = db.query(Story).filter(Story.id == story_id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(story, field, value)

    db.add(story)
    db.commit()
    db.refresh(story)
    return story


def delete_story(db: Session, story_id: int) -> None:
    """Delete an impact story."""
    story = db.query(Story).filter(Story.id == story_id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")

    db.delete(story)
    db.commit()
