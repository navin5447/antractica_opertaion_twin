from typing import Literal

from pydantic import BaseModel

Station = Literal["Maitri", "Bharati"]
EnvironmentStatus = Literal["LIVE", "STALE"]


class LiveEnvironment(BaseModel):
    station: Station
    timestamp: str
    temperature_c: float
    humidity_percent: float
    pressure_mbar: float
    wind_speed_knots: float
    source: Literal["NCPOR"] = "NCPOR"
    data_type: Literal["REAL"] = "REAL"
    status: EnvironmentStatus
    last_updated: str
