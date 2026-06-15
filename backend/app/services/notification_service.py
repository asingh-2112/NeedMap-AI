import json
import logging
from datetime import datetime, timezone

from fastapi import WebSocket
from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.models.enums import NotificationType

logger = logging.getLogger(__name__)

# In-memory WebSocket connections: user_id -> list[WebSocket]
_active_connections: dict[int, list[WebSocket]] = {}


async def connect(websocket: WebSocket, user_id: int):
    """Register a WebSocket connection for a user."""
    await websocket.accept()
    if user_id not in _active_connections:
        _active_connections[user_id] = []
    _active_connections[user_id].append(websocket)
    logger.info(f"WebSocket connected for user {user_id}")


def disconnect(websocket: WebSocket, user_id: int):
    """Remove a WebSocket connection for a user."""
    if user_id in _active_connections:
        _active_connections[user_id] = [
            ws for ws in _active_connections[user_id] if ws != websocket
        ]
        if not _active_connections[user_id]:
            del _active_connections[user_id]
    logger.info(f"WebSocket disconnected for user {user_id}")


async def send_to_user(user_id: int, data: dict):
    """Send a message to all WebSocket connections for a user."""
    connections = _active_connections.get(user_id, [])
    dead = []
    for ws in connections:
        try:
            await ws.send_json(data)
        except Exception:
            dead.append(ws)
    # Clean up dead connections
    for ws in dead:
        disconnect(ws, user_id)


def create_notification(
    db: Session,
    user_id: int,
    notification_type: NotificationType,
    title: str,
    message: str | None = None,
    payload: dict | None = None,
) -> Notification:
    """Create a notification record in the database."""
    notification = Notification(
        user_id=user_id,
        notification_type=notification_type,
        title=title,
        message=message,
        payload_json=json.dumps(payload) if payload else None,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


async def create_and_push_notification(
    db: Session,
    user_id: int,
    notification_type: NotificationType,
    title: str,
    message: str | None = None,
    payload: dict | None = None,
) -> Notification:
    """Create a notification in DB and push it via WebSocket if connected."""
    notification = create_notification(db, user_id, notification_type, title, message, payload)
    # Push via WebSocket
    ws_data = {
        "id": notification.id,
        "event": notification.notification_type,
        "type": notification.notification_type,
        "title": notification.title,
        "message": notification.message,
        "payload": payload,
        "is_read": False,
        "created_at": notification.created_at.isoformat() if notification.created_at else datetime.now(timezone.utc).isoformat(),
    }
    await send_to_user(user_id, ws_data)
    return notification


def get_user_notifications(
    db: Session, user_id: int, unread_only: bool = False, limit: int = 50, offset: int = 0
) -> list[Notification]:
    """Get notifications for a user."""
    query = db.query(Notification).filter(Notification.user_id == user_id)
    if unread_only:
        query = query.filter(Notification.is_read == False)  # noqa: E712
    return query.order_by(Notification.created_at.desc()).offset(offset).limit(limit).all()


def mark_as_read(db: Session, user_id: int, notification_ids: list[int]) -> int:
    """Mark notifications as read. Returns count updated."""
    count = (
        db.query(Notification)
        .filter(Notification.user_id == user_id, Notification.id.in_(notification_ids))
        .update({"is_read": True}, synchronize_session="fetch")
    )
    db.commit()
    return count


def get_unread_count(db: Session, user_id: int) -> int:
    """Get count of unread notifications for a user."""
    return (
        db.query(Notification)
        .filter(Notification.user_id == user_id, Notification.is_read == False)  # noqa: E712
        .count()
    )
