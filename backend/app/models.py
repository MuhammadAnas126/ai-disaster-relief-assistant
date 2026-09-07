"""SQLAlchemy table declarations used for PostgreSQL startup initialization."""
from datetime import datetime

from sqlalchemy import Boolean, Integer, String, Text, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    location: Mapped[str | None] = mapped_column(String)
    coordinates: Mapped[str | None] = mapped_column(String)
    affected: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    trapped: Mapped[str] = mapped_column(String, nullable=False, default="no")
    damage: Mapped[str] = mapped_column(String, nullable=False, default="minor")
    ai_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    severity_level: Mapped[str] = mapped_column(String, nullable=False, default="medium")
    status: Mapped[str] = mapped_column(String, nullable=False, default="open")
    reported_by: Mapped[str | None] = mapped_column(String)
    is_guest_report: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    evidence_ids: Mapped[str | None] = mapped_column(Text)


class Evidence(Base):
    __tablename__ = "evidence"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    case_id: Mapped[str | None] = mapped_column(String)
    image_path: Mapped[str] = mapped_column(String, nullable=False)
    disaster_type: Mapped[str | None] = mapped_column(String)
    victim_status: Mapped[str | None] = mapped_column(String)
    confidence: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    hazards: Mapped[str | None] = mapped_column(Text)
    timestamp: Mapped[datetime] = mapped_column(TIMESTAMP, nullable=False)
    media_type: Mapped[str] = mapped_column(String, nullable=False, default="image")
    thumbnail_path: Mapped[str | None] = mapped_column(String)
    source: Mapped[str] = mapped_column(String, nullable=False, default="upload")
    location: Mapped[str | None] = mapped_column(String)
    trapped: Mapped[str | None] = mapped_column(String)
    people_affected: Mapped[int | None] = mapped_column(Integer)