from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import object_session, relationship
from app.core.database import Base
from app.models.enums import UserRole


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    parent_organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
    organization_name = Column(String(255), nullable=False)
    branch_location = Column(String(255), nullable=True)
    is_branch = Column(Boolean, default=False, nullable=False)
    address = Column(String(500), nullable=True)
    phone = Column(String(20), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    owner = relationship("User", foreign_keys=[user_id])
    parent = relationship("Organization", remote_side=[id], back_populates="branches")
    branches = relationship("Organization", back_populates="parent")
    needs = relationship("Need", back_populates="organization")
    volunteers = relationship("Volunteer", back_populates="organization")
    assignments = relationship("Assignment", back_populates="organization")

    @property
    def branch_admin_name(self):
        session = object_session(self)
        if session is None:
            return None

        from app.models.user import User

        admin = (
            session.query(User)
            .filter(
                User.role == UserRole.ADMIN,
                User.managed_branch_id == self.id,
                User.is_active.is_(True),
            )
            .order_by(User.created_at.asc())
            .first()
        )
        return admin.user_name if admin else None

    @property
    def branch_admin_email(self):
        session = object_session(self)
        if session is None:
            return None

        from app.models.user import User

        admin = (
            session.query(User)
            .filter(
                User.role == UserRole.ADMIN,
                User.managed_branch_id == self.id,
                User.is_active.is_(True),
            )
            .order_by(User.created_at.asc())
            .first()
        )
        return admin.email if admin else None

    def __repr__(self):
        return f"<Organization {self.organization_name}>"
