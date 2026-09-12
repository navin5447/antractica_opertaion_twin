from typing import Literal

from pydantic import BaseModel

ConnectivityState = Literal["CONNECTED", "DEGRADED", "BLACKOUT"]


class ConnectivityStatusOut(BaseModel):
    station: Literal["Maitri", "Bharati"]
    timestamp: str
    state: ConnectivityState
    operation_mode: str
    latency_ms: int
    source: Literal["SIMULATED"] = "SIMULATED"


class ConnectivityUpdateRequest(BaseModel):
    state: ConnectivityState
