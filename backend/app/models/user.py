from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, Enum, ForeignKey, func
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.enums import UserRole


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.VOLUNTEER)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
    phone = Column(String(20), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    radius_km = Column(Float, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_seen = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    volunteer_profile = relationship("Volunteer", back_populates="user", uselist=False)
    created_needs = relationship("Need", back_populates="creator")

    def __repr__(self):
        return f"<User {self.email} role={self.role.value}>"
