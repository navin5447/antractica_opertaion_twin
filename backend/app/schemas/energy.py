from typing import Literal

from pydantic import BaseModel


class EnergyState(BaseModel):
    station: Literal["Maitri", "Bharati"]
    timestamp: str
    generator_output_kw: float
    total_consumption_kw: float
    critical_load_kw: float
    non_critical_load_kw: float
    available_power_kw: float
    generator_status: str
    source: Literal["SIMULATED"] = "SIMULATED"
