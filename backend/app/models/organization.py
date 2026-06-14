from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.core.database import Base


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

    def __repr__(self):
        return f"<Organization {self.organization_name}>"
