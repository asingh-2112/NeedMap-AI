import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Awaitable, Callable

from sqlalchemy.orm import Session

from app.ml.matching import score_volunteers_for_need
from app.models.assignment import Assignment
from app.models.enums import AssignmentStatus, NeedStatus, NotificationType, UserRole
from app.models.need import Need
from app.models.organization import Organization
from app.models.user import User
from app.models.volunteer import Volunteer
from app.services import notification_service
from app.services.volunteer_service import list_volunteers_with_relations

logger = logging.getLogger(__name__)

Subscriber = Callable[[str, dict], Awaitable[None]]


class RealtimeSubjects:
    NEED_CREATED = "need.created"
    ASSIGNMENT_PROPOSED = "assignment.proposed"
    ASSIGNMENT_STATUS_CHANGED = "assignment.status_changed"
    ASSIGNMENT_COMPLETED = "assignment.completed"
    VOLUNTEER_RATING_UPDATED = "volunteer.rating.updated"

    @staticmethod
    def need_created(organization_id: int) -> str:
        return f"{RealtimeSubjects.NEED_CREATED}.{organization_id}"

    @staticmethod
    def volunteer_assignment_proposed(volunteer_id: int) -> str:
        return f"volunteer.{volunteer_id}.{RealtimeSubjects.ASSIGNMENT_PROPOSED}"

    @staticmethod
    def assignment_status_changed(assignment_id: int) -> str:
        return f"assignment.{assignment_id}.{RealtimeSubjects.ASSIGNMENT_STATUS_CHANGED}"

    @staticmethod
    def admin_assignment_completed(organization_id: int) -> str:
        return f"admin.{organization_id}.{RealtimeSubjects.ASSIGNMENT_COMPLETED}"

    @staticmethod
    def volunteer_rating_updated(volunteer_id: int) -> str:
        return f"volunteer.{volunteer_id}.{RealtimeSubjects.VOLUNTEER_RATING_UPDATED}"


@dataclass(frozen=True)
class RealtimeEvent:
    subject: str
    event: str
    payload: dict


_subscribers: list[tuple[str, Subscriber]] = []


def subscribe(subject_pattern: str, callback: Subscriber) -> None:
    _subscribers.append((subject_pattern, callback))


def unsubscribe(subject_pattern: str, callback: Subscriber) -> None:
    _subscribers[:] = [
        item for item in _subscribers if item != (subject_pattern, callback)
    ]


def _matches(pattern: str, subject: str) -> bool:
    pattern_parts = pattern.split(".")
    subject_parts = subject.split(".")
    if len(pattern_parts) != len(subject_parts):
        return False
    return all(pattern == "*" or pattern == part for pattern, part in zip(pattern_parts, subject_parts))


async def publish(subject: str, event: str, payload: dict) -> None:
    envelope = {
        "subject": subject,
        "event": event,
        "payload": payload,
        "published_at": datetime.now(timezone.utc).isoformat(),
    }
    logger.info("NATS subject publish: %s event=%s", subject, event)
    for pattern, callback in list(_subscribers):
        if _matches(pattern, subject):
            try:
                await callback(subject, envelope)
            except Exception as exc:
                logger.warning("Realtime subscriber failed for %s: %s", subject, exc)


def websocket_subjects_for_user(user: User, volunteer_id: int | None = None) -> list[str]:
    subjects = [f"user.{user.id}.notifications"]
    if user.role == UserRole.VOLUNTEER and volunteer_id is not None:
        subjects.extend([
            RealtimeSubjects.volunteer_assignment_proposed(volunteer_id),
            RealtimeSubjects.volunteer_rating_updated(volunteer_id),
        ])
    if user.role == UserRole.ADMIN and user.managed_branch_id is not None:
        subjects.append(RealtimeSubjects.admin_assignment_completed(user.managed_branch_id))
    if user.role == UserRole.OWNER and user.organization_id is not None:
        subjects.append(f"owner.{user.organization_id}.>")
    return subjects


async def create_and_publish_notification(
    db: Session,
    user_id: int,
    notification_type: NotificationType,
    title: str,
    message: str,
    subject: str,
    payload: dict,
) -> None:
    full_payload = {**payload, "subject": subject}
    notification = await notification_service.create_and_push_notification(
        db=db,
        user_id=user_id,
        notification_type=notification_type,
        title=title,
        message=message,
        payload=full_payload,
    )
    await publish(
        subject=subject,
        event=notification_type.value,
        payload={**full_payload, "notification_id": notification.id, "user_id": user_id},
    )


def _assignment_payload(assignment: Assignment) -> dict:
    return {
        "assignment_id": assignment.id,
        "need_id": assignment.need_id,
        "organization_id": assignment.organization_id,
        "volunteer_id": assignment.volunteer_id,
        "status": assignment.status.value,
        "match_score": assignment.match_score,
    }


def _manager_users_for_organization(db: Session, organization_id: int) -> list[User]:
    users = (
        db.query(User)
        .filter(
            User.is_active.is_(True),
            User.role == UserRole.ADMIN,
            User.managed_branch_id == organization_id,
        )
        .all()
    )

    organization = db.query(Organization).filter(Organization.id == organization_id).first()
    owner_org_id = organization.parent_organization_id if organization and organization.parent_organization_id else organization_id
    owners = (
        db.query(User)
        .filter(
            User.is_active.is_(True),
            User.role == UserRole.OWNER,
            User.organization_id == owner_org_id,
        )
        .all()
    )
    by_id = {user.id: user for user in [*users, *owners]}
    return list(by_id.values())


async def publish_need_created_and_proposals(db: Session, need: Need) -> list[Assignment]:
    subject = RealtimeSubjects.need_created(need.organization_id)
    await publish(
        subject=subject,
        event=NotificationType.NEED_CREATED.value,
        payload={"need_id": need.id, "organization_id": need.organization_id, "title": need.title},
    )

    volunteers = [
        volunteer for volunteer in list_volunteers_with_relations(db, organization_id=None, verified=None)
        if volunteer.availability and volunteer.user is not None and volunteer.is_active
    ]
    ranked = [score for score in score_volunteers_for_need(volunteers, need) if score["availability_score"] > 0]
    top_matches = ranked[:10]
    created: list[Assignment] = []

    for match in top_matches:
        volunteer = db.query(Volunteer).filter(Volunteer.id == match["volunteer_id"]).first()
        if volunteer is None:
            continue
        existing = (
            db.query(Assignment)
            .filter(
                Assignment.need_id == need.id,
                Assignment.volunteer_id == volunteer.id,
                Assignment.status.notin_([AssignmentStatus.CANCELLED, AssignmentStatus.COMPLETED]),
            )
            .first()
        )
        assignment = existing or Assignment(
            need_id=need.id,
            volunteer_id=volunteer.id,
            organization_id=need.organization_id,
            match_score=match["composite_score"],
            status=AssignmentStatus.PROPOSED,
        )
        if existing is None:
            db.add(assignment)
            db.flush()
            created.append(assignment)

        if volunteer.user_id:
            proposal_subject = RealtimeSubjects.volunteer_assignment_proposed(volunteer.id)
            await create_and_publish_notification(
                db=db,
                user_id=volunteer.user_id,
                notification_type=NotificationType.ASSIGNMENT_CREATED,
                title="New matching need proposal",
                message=f"{need.title} matches your skills nearby. Accept or decline the assignment.",
                subject=proposal_subject,
                payload={
                    **_assignment_payload(assignment),
                    "need_title": need.title,
                    "need_category": need.category.value,
                    "need_urgency": need.urgency.value,
                    "address": need.address,
                },
            )

    db.commit()
    for assignment in created:
        db.refresh(assignment)
    return created


async def publish_assignment_status_change(db: Session, assignment: Assignment, previous_status: AssignmentStatus) -> None:
    payload = {**_assignment_payload(assignment), "previous_status": previous_status.value}
    subject = RealtimeSubjects.assignment_status_changed(assignment.id)
    await publish(subject=subject, event=NotificationType.ASSIGNMENT_STATUS_CHANGED.value, payload=payload)

    if assignment.status == AssignmentStatus.COMPLETED:
        completed_subject = RealtimeSubjects.admin_assignment_completed(assignment.organization_id)
        need = db.query(Need).filter(Need.id == assignment.need_id).first()
        for manager in _manager_users_for_organization(db, assignment.organization_id):
            await create_and_publish_notification(
                db=db,
                user_id=manager.id,
                notification_type=NotificationType.ASSIGNMENT_STATUS_CHANGED,
                title="Assignment completed",
                message="A volunteer completed an assignment. Please rate their work.",
                subject=completed_subject,
                payload={**payload, "need_title": need.title if need else None},
            )

    volunteer = db.query(Volunteer).filter(Volunteer.id == assignment.volunteer_id).first()
    if volunteer and volunteer.user_id:
        await create_and_publish_notification(
            db=db,
            user_id=volunteer.user_id,
            notification_type=NotificationType.ASSIGNMENT_STATUS_CHANGED,
            title="Assignment status updated",
            message=f"Assignment #{assignment.id} is now {assignment.status.value.replace('_', ' ')}.",
            subject=subject,
            payload=payload,
        )


async def publish_volunteer_rating_updated(db: Session, volunteer: Volunteer) -> None:
    if not volunteer.user_id:
        return
    subject = RealtimeSubjects.volunteer_rating_updated(volunteer.id)
    await create_and_publish_notification(
        db=db,
        user_id=volunteer.user_id,
        notification_type=NotificationType.GENERAL,
        title="Volunteer rating updated",
        message="Your organization rating has been updated.",
        subject=subject,
        payload={"volunteer_id": volunteer.id, "rating": volunteer.rating},
    )