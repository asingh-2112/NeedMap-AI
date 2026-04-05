from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.user import UserLocationUpdateRequest


def update_location(db: Session, user: User, payload: UserLocationUpdateRequest) -> User:
    if payload.latitude is not None and payload.longitude is not None:
        user.latitude = payload.latitude
        user.longitude = payload.longitude

    if payload.radius_km is not None:
        user.radius_km = payload.radius_km

    db.add(user)
    db.commit()
    db.refresh(user)

    return user
