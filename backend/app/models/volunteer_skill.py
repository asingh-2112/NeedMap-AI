from sqlalchemy import Column, Integer, String, ForeignKey, Enum
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.enums import Proficiency


class VolunteerSkill(Base):
    __tablename__ = "volunteer_skills"

    id = Column(Integer, primary_key=True, autoincrement=True)
    volunteer_id = Column(Integer, ForeignKey("volunteers.id", ondelete="CASCADE"), nullable=False, index=True)
    skill_name = Column(String(100), nullable=False)
    proficiency = Column(
        Enum(Proficiency, values_callable=lambda enum_cls: [member.value for member in enum_cls]),
        nullable=False,
        default=Proficiency.BEGINNER,
    )

    # Relationships
    volunteer = relationship("Volunteer", back_populates="skills")

    def __repr__(self):
        return f"<VolunteerSkill {self.skill_name} ({self.proficiency.value})>"
