import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.core.database import get_session_local
from app.core.security import decode_access_token
from app.models.volunteer import Volunteer
from app.services import notification_service
from app.services.realtime_event_service import websocket_subjects_for_user

logger = logging.getLogger(__name__)

router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws/notifications")
async def websocket_notifications(websocket: WebSocket, token: str = Query(...)):
    """
    WebSocket endpoint for real-time notifications.
    Connect with: ws://host/ws/notifications?token=<jwt_token>
    """
    # Authenticate via JWT token in query param
    user_id = decode_access_token(token)
    if user_id is None:
        await websocket.close(code=4001, reason="Invalid or expired token")
        return

    await notification_service.connect(websocket, user_id)
    SessionLocal = get_session_local()
    db = SessionLocal()
    try:
        from app.models.user import User

        user = db.query(User).filter(User.id == user_id).first()
        volunteer = db.query(Volunteer).filter(Volunteer.user_id == user_id).first() if user else None
        if user:
            await websocket.send_json({
                "event": "realtime.subscribed",
                "type": "realtime.subscribed",
                "title": "Realtime connected",
                "payload": {"subjects": websocket_subjects_for_user(user, volunteer.id if volunteer else None)},
            })
    finally:
        db.close()
    try:
        while True:
            # Keep connection alive; client can send ping/pong
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        notification_service.disconnect(websocket, user_id)
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}")
        notification_service.disconnect(websocket, user_id)
