# Report model for fAInd It
from sqlalchemy import (
    Column,
    String,
    Text,
    String as StringType,
    Boolean,
    DateTime,
    func,
    ARRAY,
    Float,
)
from .base import Base


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String(10), nullable=False)  # "LOST" or "FOUND"
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=True)
    color = Column(String(50), nullable=True)
    location = Column(String(500), nullable=True)
    event_date = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)

    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Embeddings
    image_embedding = Column(ARRAY(Float), nullable=True)
    text_embedding = Column(ARRAY(Float), nullable=True)

    # Metadata similarity fields
    category_similarity = Column(Float, nullable=True)
    color_similarity = Column(Float, nullable=True)
    location_similarity = Column(Float, nullable=True)
    date_similarity = Column(Float, nullable=True)

    # Composite score
    final_score = Column(Float, nullable=True)

    is_active = Column(Boolean, default=True)

    __table_args__ = (
        Index("ix_reports_owner_id", "owner_id"),
        Index("ix_reports_type", "type"),
        Index("ix_reports_category", "category"),
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "type": self.type,
            "title": self.title,
            "description": self.description,
            "category": self.category,
            "color": self.color,
            "location": self.location,
            "event_date": self.event_date.isoformat() if self.event_date else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "image_url": f"/api/v1/uploads/{self.id}.jpg" if self.id else None,
        }