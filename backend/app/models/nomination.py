"""Nomination model — volunteers can nominate communities in need."""
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Nomination(Base):
    __tablename__ = "nominations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nominator_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    nominee_name: Mapped[str] = mapped_column(String(200), nullable=False)
    nominee_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    urgency: Mapped[str] = mapped_column(String(50), default="medium")
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    latitude: Mapped[float | None] = mapped_column(nullable=True)
    longitude: Mapped[float | None] = mapped_column(nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    converted_need_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("needs.id"), nullable=True)