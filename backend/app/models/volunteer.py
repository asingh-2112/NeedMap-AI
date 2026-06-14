from sqlalchemy import Column, Integer, Float, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Volunteer(Base):
    __tablename__ = "volunteers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True, index=True)
    availability = Column(Boolean, default=True, nullable=False)
    rating = Column(Float, nullable=True)
    tasks_completed = Column(Integer, default=0, nullable=False)
    active_tasks = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    verified = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_seen = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    user = relationship("User", back_populates="volunteer_profile")
    organization = relationship("Organization", back_populates="volunteers")
    skills = relationship("VolunteerSkill", back_populates="volunteer", cascade="all, delete-orphan")
    assignments = relationship("Assignment", back_populates="volunteer")

    @property
    def user_name(self):
        return self.user.user_name if self.user else None

    @property
    def email(self):
        return self.user.email if self.user else None

    @property
    def phone(self):
        return self.user.phone if self.user else None

    @property
    def latitude(self):
        return self.user.latitude if self.user else None

    @property
    def longitude(self):
        return self.user.longitude if self.user else None

    @property
    def colony(self):
        return self.user.colony if self.user else None

    @property
    def city(self):
        return self.user.city if self.user else None

    def __repr__(self):
        return f"<Volunteer user_id={self.user_id} rating={self.rating}>"
