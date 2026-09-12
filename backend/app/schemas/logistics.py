from typing import Literal

from pydantic import BaseModel


class LogisticsState(BaseModel):
    station: Literal["Maitri", "Bharati"]
    timestamp: str
    fuel_stock_percent: float
    fuel_consumption_rate_percent_per_day: float
    safety_reserve_percent: float
    essential_supplies_percent: float
    remaining_operational_days: int
    source: Literal["SIMULATED"] = "SIMULATED"
