from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class InfrastructureStatus(Base):
    __tablename__ = "infrastructure_status"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    station: Mapped[str] = mapped_column(String(16), index=True, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
    buildings_nominal: Mapped[int] = mapped_column(Integer, nullable=False)
    buildings_total: Mapped[int] = mapped_column(Integer, nullable=False)
    utilities_nominal: Mapped[int] = mapped_column(Integer, nullable=False)
    utilities_total: Mapped[int] = mapped_column(Integer, nullable=False)
    equipment_nominal: Mapped[int] = mapped_column(Integer, nullable=False)
    equipment_total: Mapped[int] = mapped_column(Integer, nullable=False)
    critical_systems_nominal: Mapped[int] = mapped_column(Integer, nullable=False)
    critical_systems_total: Mapped[int] = mapped_column(Integer, nullable=False)
    source: Mapped[str] = mapped_column(String(16), default="SIMULATED")
