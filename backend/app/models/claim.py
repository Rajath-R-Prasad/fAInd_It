# Claim model for fAInd It
from sqlalchemy import (
    Column,
    String,
    Integer,
    DateTime,
    func,
)
from .base import Base


class Claim(Base):
    __tablename__ = "claims"

    id = Column(Integer, primary_key=True, index=True)
    status = Column(String(20), nullable=False, default="pending")  # pending, accepted, rejected
    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)

    report_id = Column(Integer, ForeignKey("reports.id"), nullable=False)
    claimant_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reported_owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    __table_args__ = (
        Index("ix_claims_report_id", "report_id"),
        Index("ix_claims_claimant_id", "claimant_id"),
        Index("ix_claims_reported_owner_id", "reported_owner_id"),
    )