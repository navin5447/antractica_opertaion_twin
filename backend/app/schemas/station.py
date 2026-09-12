from typing import Literal, Optional

from pydantic import BaseModel

from app.schemas.connectivity import ConnectivityState, ConnectivityStatusOut
from app.schemas.energy import EnergyState
from app.schemas.environment import LiveEnvironment
from app.schemas.infrastructure import InfrastructureState
from app.schemas.logistics import LogisticsState

Station = Literal["Maitri", "Bharati"]
RiskLevel = Literal["LOW", "MODERATE", "HIGH", "CRITICAL"]


class LimitingFactor(BaseModel):
    domain: str
    score: float
    reason: str


class SafeOperatingCapacity(BaseModel):
    safe_capacity_percent: int
    risk_level: RiskLevel
    limiting_factors: list[LimitingFactor]
    recommended_action: str
    domain_scores: dict[str, float]


class StationState(BaseModel):
    station: Station
    environment: LiveEnvironment
    infrastructure: InfrastructureState
    energy: EnergyState
    logistics: LogisticsState
    connectivity: ConnectivityStatusOut


class DigitalTwinState(StationState):
    safe_operating_capacity: SafeOperatingCapacity


class SimulateRequest(BaseModel):
    temperature_c: Optional[float] = None
    wind_speed_knots: Optional[float] = None
    humidity_percent: Optional[float] = None
    pressure_mbar: Optional[float] = None
    available_power_kw: Optional[float] = None
    critical_load_kw: Optional[float] = None
    fuel_level_percent: Optional[float] = None
    connectivity: Optional[ConnectivityState] = None


class SimulateResponse(BaseModel):
    station: Station
    current_state: DigitalTwinState
    simulated_state: DigitalTwinState
