from sqlalchemy import Column, Integer, Float, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.database import Base


class Volunteer(Base):
    __tablename__ = "volunteers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True, index=True)
    availability = Column(Boolean, default=True)
    rating = Column(Float, nullable=True)
    tasks_completed = Column(Integer, default=0)
    active_tasks = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    verified = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_seen_timestamp = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    user = relationship("User", back_populates="volunteer_profile")
    organization = relationship("Organization", back_populates="volunteers")
    skills = relationship("VolunteerSkill", back_populates="volunteer", cascade="all, delete-orphan")
    assignments = relationship("Assignment", back_populates="volunteer")

    def __repr__(self):
        return f"<Volunteer user_id={self.user_id} rating={self.rating}>"
