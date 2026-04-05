from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, func
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.enums import SourceType


class NeedSource(Base):
    __tablename__ = "need_sources"

    id = Column(Integer, primary_key=True, autoincrement=True)
    need_id = Column(Integer, ForeignKey("needs.id", ondelete="CASCADE"), nullable=False, index=True)
    source_type = Column(
        Enum(SourceType, values_callable=lambda enum_cls: [member.value for member in enum_cls]),
        nullable=False,
    )
    location = Column(String(100), nullable=True)
    multimedia_txt = Column(String(500), nullable=True)
    ai_extraction = Column(String(500), nullable=True)
    processed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    need = relationship("Need", back_populates="sources")

    def __repr__(self):
        return f"<NeedSource {self.source_type.value} for need={self.need_id}>"
