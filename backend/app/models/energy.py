from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class EnergyStatus(Base):
    __tablename__ = "energy_status"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    station: Mapped[str] = mapped_column(String(16), index=True, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
    generator_output_kw: Mapped[float] = mapped_column(Float, nullable=False)
    total_consumption_kw: Mapped[float] = mapped_column(Float, nullable=False)
    critical_load_kw: Mapped[float] = mapped_column(Float, nullable=False)
    non_critical_load_kw: Mapped[float] = mapped_column(Float, nullable=False)
    available_power_kw: Mapped[float] = mapped_column(Float, nullable=False)
    generator_status: Mapped[str] = mapped_column(String(16), default="ONLINE")
    source: Mapped[str] = mapped_column(String(16), default="SIMULATED")
