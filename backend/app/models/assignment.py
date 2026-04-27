from sqlalchemy import Column, Integer, Float, String, Text, DateTime, ForeignKey, Enum, func
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.enums import AssignmentStatus


class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    need_id = Column(Integer, ForeignKey("needs.id", ondelete="CASCADE"), nullable=False, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    volunteer_id = Column(Integer, ForeignKey("volunteers.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(
        Enum(AssignmentStatus, values_callable=lambda enum_cls: [member.value for member in enum_cls]),
        nullable=False,
        default=AssignmentStatus.PROPOSED,
    )
    match_score = Column(Float, nullable=True)
    assigned_at = Column(DateTime(timezone=True), server_default=func.now())
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    feedback = Column(Text, nullable=True)
    rating = Column(Float, nullable=True)

    # Relationships
    need = relationship("Need", back_populates="assignments")
    organization = relationship("Organization", back_populates="assignments")
    volunteer = relationship("Volunteer", back_populates="assignments")

    def __repr__(self):
        return f"<Assignment need={self.need_id} vol={self.volunteer_id} status={self.status.value}>"
