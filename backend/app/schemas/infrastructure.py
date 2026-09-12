from typing import Literal

from pydantic import BaseModel


class InfrastructureState(BaseModel):
    station: Literal["Maitri", "Bharati"]
    timestamp: str
    buildings_nominal: int
    buildings_total: int
    utilities_nominal: int
    utilities_total: int
    equipment_nominal: int
    equipment_total: int
    critical_systems_nominal: int
    critical_systems_total: int
    source: Literal["SIMULATED"] = "SIMULATED"
