from datetime import datetime, timezone
from threading import Lock
from typing import Optional

from sqlalchemy.orm import Session

from app.models.logistics import LogisticsStatus as LogisticsModel
from app.schemas.environment import Station
from app.schemas.logistics import LogisticsState

_BASELINES: dict[Station, dict] = {
    "Maitri": {
        "fuel_stock_percent": 68.0,
        "fuel_consumption_rate_percent_per_day": 1.37,
        "safety_reserve_percent": 42.0,
        "essential_supplies_percent": 80.0,
    },
    "Bharati": {
        "fuel_stock_percent": 74.0,
        "fuel_consumption_rate_percent_per_day": 1.26,
        "safety_reserve_percent": 45.0,
        "essential_supplies_percent": 80.0,
    },
}

_lock = Lock()
_state: dict[Station, dict] = {k: dict(v) for k, v in _BASELINES.items()}


def _remaining_days(fuel_stock_percent: float, safety_reserve_percent: float, rate: float) -> int:
    usable = max(0.0, fuel_stock_percent - safety_reserve_percent)
    if rate <= 0:
        return 0
    return max(0, round(usable / rate))


def _persist(db: Session, station: Station, values: dict) -> None:
    db.add(LogisticsModel(station=station, **values))
    db.commit()


def get_state(station: Station) -> LogisticsState:
    with _lock:
        values = dict(_state[station])
    remaining_days = _remaining_days(
        values["fuel_stock_percent"], values["safety_reserve_percent"], values["fuel_consumption_rate_percent_per_day"]
    )
    return LogisticsState(
        station=station,
        timestamp=datetime.now(timezone.utc).isoformat(),
        remaining_operational_days=remaining_days,
        **values,
    )


def set_fuel_level(station: Station, fuel_stock_percent: float) -> LogisticsState:
    """Used by the What-If simulator for a hypothetical fuel level."""
    with _lock:
        values = dict(_state[station])
    values["fuel_stock_percent"] = fuel_stock_percent
    remaining_days = _remaining_days(
        values["fuel_stock_percent"], values["safety_reserve_percent"], values["fuel_consumption_rate_percent_per_day"]
    )
    return LogisticsState(
        station=station,
        timestamp=datetime.now(timezone.utc).isoformat(),
        remaining_operational_days=remaining_days,
        **values,
    )


def tick(station: Station, db: Optional[Session] = None) -> LogisticsState:
    state = get_state(station)
    if db is not None:
        try:
            _persist(
                db,
                station,
                {
                    "fuel_stock_percent": state.fuel_stock_percent,
                    "fuel_consumption_rate_percent_per_day": state.fuel_consumption_rate_percent_per_day,
                    "safety_reserve_percent": state.safety_reserve_percent,
                    "essential_supplies_percent": state.essential_supplies_percent,
                    "remaining_operational_days": state.remaining_operational_days,
                },
            )
        except Exception:  # noqa: BLE001
            db.rollback()
    return state
