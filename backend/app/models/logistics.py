from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class LogisticsStatus(Base):
    __tablename__ = "logistics_status"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    station: Mapped[str] = mapped_column(String(16), index=True, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
    fuel_stock_percent: Mapped[float] = mapped_column(Float, nullable=False)
    fuel_consumption_rate_percent_per_day: Mapped[float] = mapped_column(Float, nullable=False)
    safety_reserve_percent: Mapped[float] = mapped_column(Float, nullable=False)
    essential_supplies_percent: Mapped[float] = mapped_column(Float, nullable=False)
    remaining_operational_days: Mapped[int] = mapped_column(Integer, nullable=False)
    source: Mapped[str] = mapped_column(String(16), default="SIMULATED")
