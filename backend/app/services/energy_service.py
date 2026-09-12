from datetime import datetime, timezone
from threading import Lock
from typing import Optional

from sqlalchemy.orm import Session

from app.models.energy import EnergyStatus as EnergyModel
from app.schemas.energy import EnergyState
from app.schemas.environment import Station

_BASELINES: dict[Station, dict] = {
    "Maitri": {
        "critical_load_kw": 402.0,
        "non_critical_load_kw": 224.0,
        "available_power_kw": 724.0,
        "generator_status": "ONLINE",
    },
    "Bharati": {
        "critical_load_kw": 388.0,
        "non_critical_load_kw": 216.0,
        "available_power_kw": 648.0,
        "generator_status": "ONLINE",
    },
}

_lock = Lock()
_state: dict[Station, dict] = {k: dict(v) for k, v in _BASELINES.items()}


def _derive(values: dict) -> dict:
    total_consumption_kw = values["critical_load_kw"] + values["non_critical_load_kw"]
    generator_output_kw = round(values["available_power_kw"] + total_consumption_kw * 0.02, 2)
    return {**values, "total_consumption_kw": round(total_consumption_kw, 2), "generator_output_kw": generator_output_kw}


def _persist(db: Session, station: Station, values: dict) -> None:
    db.add(EnergyModel(station=station, **values))
    db.commit()


def get_state(station: Station) -> EnergyState:
    with _lock:
        values = _derive(dict(_state[station]))
    return EnergyState(station=station, timestamp=datetime.now(timezone.utc).isoformat(), **values)


def set_available_power(station: Station, available_power_kw: float) -> EnergyState:
    """Used by the What-If simulator to evaluate a hypothetical energy state
    without mutating the real simulated station state."""
    with _lock:
        values = dict(_state[station])
    values["available_power_kw"] = available_power_kw
    values = _derive(values)
    return EnergyState(station=station, timestamp=datetime.now(timezone.utc).isoformat(), **values)


def tick(station: Station, db: Optional[Session] = None) -> EnergyState:
    state = get_state(station)
    if db is not None:
        try:
            _persist(
                db,
                station,
                {
                    "generator_output_kw": state.generator_output_kw,
                    "total_consumption_kw": state.total_consumption_kw,
                    "critical_load_kw": state.critical_load_kw,
                    "non_critical_load_kw": state.non_critical_load_kw,
                    "available_power_kw": state.available_power_kw,
                    "generator_status": state.generator_status,
                },
            )
        except Exception:  # noqa: BLE001
            db.rollback()
    return state
