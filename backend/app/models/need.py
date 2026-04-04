from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey, Enum, func
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.enums import NeedCategory, NeedUrgency, NeedStatus


class Need(Base):
    __tablename__ = "needs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(Enum(NeedCategory), nullable=False)
    urgency = Column(Enum(NeedUrgency), nullable=False, default=NeedUrgency.MEDIUM)
    status = Column(Enum(NeedStatus), nullable=False, default=NeedStatus.NEW)
    org_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    priority_score = Column(Float, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    address = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    organization = relationship("Organization", back_populates="needs")
    creator = relationship("User", back_populates="created_needs")
    sources = relationship("NeedSource", back_populates="need", cascade="all, delete-orphan")
    assignments = relationship("Assignment", back_populates="need", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Need {self.title} urgency={self.urgency.value}>"
