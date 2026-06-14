from app.core.database import Base, get_engine, get_session_local
from app.core.security import hash_password
from app.models import *  # noqa: F401,F403
from app.models.enums import Proficiency, UserRole
from app.models.organization import Organization
from app.models.user import User
from app.models.volunteer import Volunteer
from app.models.volunteer_skill import VolunteerSkill

ADMIN_EMAIL = "admin.phase2@needmap.org"
ADMIN_PASSWORD = "Admin@1234"
VOLUNTEER_EMAIL = "volunteer.phase2@needmap.org"
VOLUNTEER_PASSWORD = "Volunteer@1234"
OWNER_EMAIL = "owner.phase2@needmap.org"

BENGALURU_LAT = 12.9716
BENGALURU_LNG = 77.5946


def upsert_user(db, email: str, name: str, password: str, role: UserRole) -> User:
    user = db.query(User).filter(User.email == email).first()
    password_hash = hash_password(password)
    if user is None:
        user = User(
            user_name=name,
            email=email,
            password_hash=password_hash,
            role=role,
            is_active=True,
        )
        db.add(user)
        db.flush()
    else:
        user.user_name = name
        user.password_hash = password_hash
        user.role = role
        user.is_active = True
        db.add(user)
        db.flush()
    return user


def ensure_skill(db, volunteer: Volunteer, skill_name: str, proficiency: Proficiency) -> None:
    skill = (
        db.query(VolunteerSkill)
        .filter(VolunteerSkill.volunteer_id == volunteer.id, VolunteerSkill.skill_name == skill_name)
        .first()
    )
    if skill is None:
        db.add(VolunteerSkill(volunteer_id=volunteer.id, skill_name=skill_name, proficiency=proficiency))
    else:
        skill.proficiency = proficiency
        db.add(skill)


def main() -> None:
    Base.metadata.create_all(bind=get_engine())
    SessionLocal = get_session_local()
    db = SessionLocal()
    try:
        owner = upsert_user(db, OWNER_EMAIL, "Phase 2 Owner", "Owner@1234", UserRole.OWNER)

        root_org = (
            db.query(Organization)
            .filter(Organization.organization_name == "NeedMap Phase 2 Demo Org", Organization.is_branch.is_(False))
            .first()
        )
        if root_org is None:
            root_org = Organization(
                user_id=owner.id,
                organization_name="NeedMap Phase 2 Demo Org",
                address="MG Road, Bengaluru, Karnataka",
                phone="+91 90000 20000",
                is_active=True,
            )
            db.add(root_org)
            db.flush()
        else:
            root_org.user_id = owner.id
            root_org.is_active = True
            db.add(root_org)
            db.flush()

        owner.organization_id = root_org.id
        db.add(owner)

        branch = (
            db.query(Organization)
            .filter(
                Organization.parent_organization_id == root_org.id,
                Organization.organization_name == "NeedMap Bengaluru Central Branch",
            )
            .first()
        )
        if branch is None:
            branch = Organization(
                user_id=owner.id,
                parent_organization_id=root_org.id,
                organization_name="NeedMap Bengaluru Central Branch",
                branch_location="Bengaluru Central",
                is_branch=True,
                address="Indiranagar, Bengaluru, Karnataka",
                phone="+91 90000 20001",
                is_active=True,
            )
            db.add(branch)
            db.flush()
        else:
            branch.user_id = owner.id
            branch.parent_organization_id = root_org.id
            branch.is_branch = True
            branch.branch_location = "Bengaluru Central"
            branch.address = "Indiranagar, Bengaluru, Karnataka"
            branch.is_active = True
            db.add(branch)
            db.flush()

        admin = upsert_user(db, ADMIN_EMAIL, "Phase 2 Branch Admin", ADMIN_PASSWORD, UserRole.ADMIN)
        admin.organization_id = root_org.id
        admin.managed_branch_id = branch.id
        admin.phone = "+91 90000 20002"
        admin.latitude = BENGALURU_LAT
        admin.longitude = BENGALURU_LNG
        admin.city = "Bengaluru"
        admin.state = "Karnataka"
        db.add(admin)

        volunteer_user = upsert_user(db, VOLUNTEER_EMAIL, "Phase 2 Volunteer", VOLUNTEER_PASSWORD, UserRole.VOLUNTEER)
        volunteer_user.organization_id = branch.id
        volunteer_user.phone = "+91 90000 20003"
        volunteer_user.latitude = 12.9784
        volunteer_user.longitude = 77.6408
        volunteer_user.radius_km = 15
        volunteer_user.colony = "Indiranagar"
        volunteer_user.city = "Bengaluru"
        volunteer_user.state = "Karnataka"
        db.add(volunteer_user)
        db.flush()

        volunteer = db.query(Volunteer).filter(Volunteer.user_id == volunteer_user.id).first()
        if volunteer is None:
            volunteer = Volunteer(
                user_id=volunteer_user.id,
                organization_id=branch.id,
                availability=True,
                rating=4.7,
                verified=True,
                tasks_completed=12,
                active_tasks=0,
                is_active=True,
            )
            db.add(volunteer)
            db.flush()
        else:
            volunteer.organization_id = branch.id
            volunteer.availability = True
            volunteer.rating = 4.7
            volunteer.verified = True
            volunteer.tasks_completed = max(volunteer.tasks_completed or 0, 12)
            volunteer.active_tasks = 0
            volunteer.is_active = True
            db.add(volunteer)
            db.flush()

        ensure_skill(db, volunteer, "medical first aid", Proficiency.EXPERT)
        ensure_skill(db, volunteer, "food logistics", Proficiency.EXPERT)
        ensure_skill(db, volunteer, "community coordination", Proficiency.INTERMEDIATE)

        db.commit()
        print("Phase 2 realtime demo data is ready.")
        print(f"Admin: {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
        print(f"Volunteer: {VOLUNTEER_EMAIL} / {VOLUNTEER_PASSWORD}")
        print(f"Branch organization_id for need creation: {branch.id}")
        print("Test need: title='Urgent first aid and food support', category='health', urgency='high', address='Indiranagar, Bengaluru, Karnataka', lat=12.9784, lng=77.6408")
    finally:
        db.close()


if __name__ == "__main__":
    main()
