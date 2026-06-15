"""SQLAlchemy models for GeneSmith parts database."""

from __future__ import annotations

from sqlalchemy import String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class GeneticPart(Base):
    """iGEM / Anderson genetic part stored in the parts library."""

    __tablename__ = "genetic_parts"

    part_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    part_type: Mapped[str] = mapped_column(String(32), index=True)
    name: Mapped[str] = mapped_column(String(255))
    sequence: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text, default="")
    source: Mapped[str] = mapped_column(String(64), default="")
    pdb_id: Mapped[str | None] = mapped_column(String(16), nullable=True)
    uniprot_id: Mapped[str | None] = mapped_column(String(16), nullable=True)

    def __repr__(self) -> str:
        return f"<GeneticPart {self.part_id} ({self.part_type})>"
