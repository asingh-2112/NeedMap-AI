#!/usr/bin/env python3
"""Seed dense Bengaluru needs for the admin home-map visualization."""

from __future__ import annotations

import os
import random
from datetime import datetime, timezone, timedelta

from app.core.database import get_session_local
from app.core.security import hash_password
from app.models.assignment import Assignment
from app.models.enums import AssignmentStatus, NeedCategory, NeedStatus, NeedUrgency, Proficiency, UserRole
from app.models.need import Need
from app.models.organization import Organization
from app.models.user import User
from app.models.volunteer import Volunteer
from app.models.volunteer_skill import VolunteerSkill


ADMIN_EMAIL = os.getenv("ADMIN_SEED_EMAIL", "admin.phase2@needmap.org")
SEED_PREFIX = "Bengaluru Area Heatmap Seed"
ORG_SEED_PREFIX = "Area Partner"
VOLUNTEER_SEED_PREFIX = "Area Volunteer"
SEED_PASSWORD = "NeedMapSeed@123"


AREA_SPECS = [
    ("Indiranagar", 12.9784, 77.6408, 58, (36, 14, 8)),
    ("Koramangala", 12.9279, 77.6271, 64, (42, 16, 6)),
    ("Whitefield", 12.9698, 77.7500, 72, (44, 19, 9)),
    ("Jayanagar", 12.9250, 77.5938, 42, (18, 8, 16)),
    ("Electronic City", 12.8399, 77.6770, 68, (43, 18, 7)),
    ("Yelahanka", 13.1007, 77.5963, 36, (13, 8, 15)),
    ("Malleshwaram", 13.0031, 77.5643, 32, (10, 7, 15)),
    ("Rajajinagar", 12.9915, 77.5568, 48, (25, 12, 11)),
    ("Hebbal", 13.0358, 77.5970, 54, (30, 14, 10)),
    ("Marathahalli", 12.9569, 77.7011, 61, (39, 15, 7)),
    ("KR Puram", 13.0070, 77.6951, 45, (22, 11, 12)),
    ("Banashankari", 12.9152, 77.5736, 39, (15, 9, 15)),
]

CATEGORIES = [
    NeedCategory.FOOD,
    NeedCategory.WATER_ACCESS,
    NeedCategory.HEALTH,
    NeedCategory.SHELTER,
    NeedCategory.SANITATION,
    NeedCategory.EDUCATION,
]

ORG_TYPES = [
    "Relief Center",
    "Food Bank",
    "Health Camp",
    "Shelter Desk",
]

VOLUNTEER_SKILLS = [
    "food distribution",
    "medical support",
    "transport coordination",
    "field survey",
    "community outreach",
    "water supply",
]


def statuses_for_counts(active: int, in_progress: int, completed: int) -> list[NeedStatus]:
    statuses: list[NeedStatus] = []
    for i in range(active):
        statuses.append(NeedStatus.NEW if i % 2 == 0 else NeedStatus.VERIFIED)
    statuses.extend([NeedStatus.IN_PROGRESS] * in_progress)
    for i in range(completed):
        statuses.append(NeedStatus.RESOLVED if i % 2 == 0 else NeedStatus.CLOSED)
    return statuses


def seed_area_organizations_and_volunteers(db, parent_organization_id: int) -> tuple[int, int]:
    inserted_orgs = 0
    inserted_volunteers = 0
    password_hash = hash_password(SEED_PASSWORD)

    for area_index, (area, center_lat, center_lng, _total, _counts) in enumerate(AREA_SPECS):
        for org_index in range(2):
            org_email = f"area-org-{area.lower().replace(' ', '-')}-{org_index + 1}@needmap.seed"
            owner = db.query(User).filter(User.email == org_email).first()
            if owner is None:
                owner = User(
                    user_name=f"{area} {ORG_TYPES[(area_index + org_index) % len(ORG_TYPES)]} Owner",
                    email=org_email,
                    password_hash=password_hash,
                    role=UserRole.OWNER,
                    phone=f"90000{area_index:02d}{org_index:02d}",
                    latitude=round(center_lat + 0.004 + org_index * 0.003, 6),
                    longitude=round(center_lng - 0.004 + org_index * 0.003, 6),
                    colony=area,
                    city="Bengaluru",
                    state="Karnataka",
                    country="India",
                    is_active=True,
                )
                db.add(owner)
                db.flush()

            org_name = f"{ORG_SEED_PREFIX} {area} {ORG_TYPES[(area_index + org_index) % len(ORG_TYPES)]}"
            organization = db.query(Organization).filter(Organization.organization_name == org_name).first()
            if organization is None:
                org_lat = round(center_lat + 0.004 + org_index * 0.003, 6)
                org_lng = round(center_lng - 0.004 + org_index * 0.003, 6)
                organization = Organization(
                    user_id=owner.id,
                    parent_organization_id=parent_organization_id,
                    organization_name=org_name,
                    branch_location=f"{org_lat},{org_lng}",
                    is_branch=False,
                    address=f"{area}, Bengaluru, Karnataka, India",
                    phone=f"080-40{area_index:02d}{org_index:02d}",
                    is_active=True,
                )
                db.add(organization)
                db.flush()
                inserted_orgs += 1

            owner.organization_id = organization.id
            db.add(owner)

        for volunteer_index in range(4):
            volunteer_email = f"area-volunteer-{area.lower().replace(' ', '-')}-{volunteer_index + 1}@needmap.seed"
            volunteer_user = db.query(User).filter(User.email == volunteer_email).first()
            volunteer_lat = round(center_lat - 0.004 + volunteer_index * 0.0021, 6)
            volunteer_lng = round(center_lng + 0.004 - volunteer_index * 0.0018, 6)
            if volunteer_user is None:
                volunteer_user = User(
                    user_name=f"{VOLUNTEER_SEED_PREFIX} {area} #{volunteer_index + 1}",
                    email=volunteer_email,
                    password_hash=password_hash,
                    role=UserRole.VOLUNTEER,
                    phone=f"91000{area_index:02d}{volunteer_index:02d}",
                    latitude=volunteer_lat,
                    longitude=volunteer_lng,
                    radius_km=6,
                    colony=area,
                    city="Bengaluru",
                    state="Karnataka",
                    country="India",
                    is_active=True,
                )
                db.add(volunteer_user)
                db.flush()

            volunteer = db.query(Volunteer).filter(Volunteer.user_id == volunteer_user.id).first()
            if volunteer is None:
                volunteer = Volunteer(
                    user_id=volunteer_user.id,
                    organization_id=parent_organization_id,
                    availability=volunteer_index % 3 != 0,
                    rating=round(4.1 + (volunteer_index % 5) * 0.16, 2),
                    tasks_completed=8 + area_index + volunteer_index * 3,
                    active_tasks=volunteer_index % 3,
                    verified=True,
                    is_active=True,
                    last_seen=datetime.now(timezone.utc),
                )
                db.add(volunteer)
                db.flush()
                inserted_volunteers += 1

            for skill_offset in range(2):
                skill_name = VOLUNTEER_SKILLS[(area_index + volunteer_index + skill_offset) % len(VOLUNTEER_SKILLS)]
                existing_skill = db.query(VolunteerSkill).filter(
                    VolunteerSkill.volunteer_id == volunteer.id,
                    VolunteerSkill.skill_name == skill_name,
                ).first()
                if existing_skill is None:
                    db.add(
                        VolunteerSkill(
                            volunteer_id=volunteer.id,
                            skill_name=skill_name,
                            proficiency=Proficiency.INTERMEDIATE if skill_offset == 0 else Proficiency.BEGINNER,
                        )
                    )

    return inserted_orgs, inserted_volunteers


def seed_multi_volunteer_assignments(db, organization_id: int) -> int:
    volunteers = (
        db.query(Volunteer)
        .filter(Volunteer.organization_id == organization_id, Volunteer.is_active.is_(True))
        .order_by(Volunteer.id.asc())
        .all()
    )
    needs = (
        db.query(Need)
        .filter(
            Need.organization_id == organization_id,
            Need.title.like(f"{SEED_PREFIX}%"),
            Need.status.in_([NeedStatus.NEW, NeedStatus.VERIFIED, NeedStatus.ASSIGNED, NeedStatus.IN_PROGRESS]),
        )
        .order_by(Need.id.asc())
        .limit(24)
        .all()
    )

    if len(volunteers) < 2 or not needs:
        return 0

    inserted = 0
    statuses = [AssignmentStatus.ACCEPTED, AssignmentStatus.IN_PROGRESS, AssignmentStatus.PROPOSED]
    now = datetime.now(timezone.utc)

    for need_index, need in enumerate(needs):
        assignment_total = 2 + (need_index % 3)
        for offset in range(assignment_total):
            volunteer = volunteers[(need_index + offset) % len(volunteers)]
            exists = db.query(Assignment).filter(
                Assignment.need_id == need.id,
                Assignment.volunteer_id == volunteer.id,
            ).first()
            if exists is not None:
                continue

            status = statuses[(need_index + offset) % len(statuses)]
            db.add(
                Assignment(
                    need_id=need.id,
                    organization_id=organization_id,
                    volunteer_id=volunteer.id,
                    status=status,
                    match_score=round(0.72 + ((need_index + offset) % 16) * 0.015, 2),
                    accepted_at=now if status in {AssignmentStatus.ACCEPTED, AssignmentStatus.IN_PROGRESS} else None,
                )
            )
            inserted += 1

        if need.status in {NeedStatus.NEW, NeedStatus.VERIFIED}:
            need.status = NeedStatus.ASSIGNED

    return inserted


def main() -> None:
    random.seed(20260614)
    session_local = get_session_local()
    db = session_local()

    try:
        admin = db.query(User).filter(User.email == ADMIN_EMAIL, User.role == "admin").first()
        if admin is None:
            raise RuntimeError(f"Admin user not found: {ADMIN_EMAIL}")

        organization_id = admin.managed_branch_id or admin.organization_id
        if organization_id is None:
            raise RuntimeError(f"Admin {ADMIN_EMAIL} has no managed branch or organization id")

        seeded_orgs, seeded_volunteers = seed_area_organizations_and_volunteers(db, organization_id)
        seeded_assignments = seed_multi_volunteer_assignments(db, organization_id)

        existing = db.query(Need).filter(
            Need.organization_id == organization_id,
            Need.title.like(f"{SEED_PREFIX}%"),
        ).count()

        if existing:
            db.commit()
            print(f"organization_id={organization_id}")
            print(f"existing_seed_records={existing}")
            print(f"inserted_area_organizations={seeded_orgs}")
            print(f"inserted_area_volunteers={seeded_volunteers}")
            print(f"inserted_multi_volunteer_assignments={seeded_assignments}")
            print("No new records inserted; seed is already present.")
            return

        inserted = 0
        now = datetime.now(timezone.utc)

        for area, center_lat, center_lng, total, counts in AREA_SPECS:
            statuses = statuses_for_counts(*counts)
            random.shuffle(statuses)

            for index, need_status in enumerate(statuses[:total], start=1):
                row = index // 9
                col = index % 9
                jitter_lat = (row - 4) * 0.0022 + random.uniform(-0.0009, 0.0009)
                jitter_lng = (col - 4) * 0.0025 + random.uniform(-0.0011, 0.0011)
                category = CATEGORIES[(inserted + index) % len(CATEGORIES)]
                urgency = NeedUrgency.CRITICAL if index % 17 == 0 else NeedUrgency.HIGH if index % 5 == 0 else NeedUrgency.MEDIUM
                resolved_at = now - timedelta(days=index % 21) if need_status in {NeedStatus.RESOLVED, NeedStatus.CLOSED} else None

                db.add(
                    Need(
                        title=f"{SEED_PREFIX} - {area} #{index:03d}",
                        description=f"Seeded {area} need for admin Bengaluru area-border heatmap visualization.",
                        category=category,
                        urgency=urgency,
                        status=need_status,
                        organization_id=organization_id,
                        created_by=admin.id,
                        priority_score=round(0.45 + min(0.5, total / 150) + (0.05 if urgency == NeedUrgency.CRITICAL else 0), 2),
                        latitude=round(center_lat + jitter_lat, 6),
                        longitude=round(center_lng + jitter_lng, 6),
                        address=f"{area}, Bengaluru, Karnataka, India",
                        street=f"Sector {(index % 12) + 1}",
                        colony=area,
                        city="Bengaluru",
                        state="Karnataka",
                        country="India",
                        pincode=str(560000 + (index % 95)),
                        affected_count=8 + (index % 37),
                        resolved_at=resolved_at,
                    )
                )
                inserted += 1

        db.commit()

        seeded_assignments += seed_multi_volunteer_assignments(db, organization_id)
        db.commit()

        active = db.query(Need).filter(
            Need.organization_id == organization_id,
            Need.title.like(f"{SEED_PREFIX}%"),
            Need.status.in_([NeedStatus.NEW, NeedStatus.VERIFIED, NeedStatus.ASSIGNED]),
        ).count()
        in_progress = db.query(Need).filter(
            Need.organization_id == organization_id,
            Need.title.like(f"{SEED_PREFIX}%"),
            Need.status == NeedStatus.IN_PROGRESS,
        ).count()
        completed = db.query(Need).filter(
            Need.organization_id == organization_id,
            Need.title.like(f"{SEED_PREFIX}%"),
            Need.status.in_([NeedStatus.RESOLVED, NeedStatus.CLOSED]),
        ).count()

        print(f"organization_id={organization_id}")
        print(f"inserted_seed_records={inserted}")
        print(f"inserted_area_organizations={seeded_orgs}")
        print(f"inserted_area_volunteers={seeded_volunteers}")
        print(f"inserted_multi_volunteer_assignments={seeded_assignments}")
        print(f"active={active}")
        print(f"in_progress={in_progress}")
        print(f"completed={completed}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
