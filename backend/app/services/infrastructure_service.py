from datetime import datetime, timezone
from threading import Lock
from typing import Optional

from sqlalchemy.orm import Session

from app.models.infrastructure import InfrastructureStatus as InfrastructureModel
from app.schemas.environment import Station
from app.schemas.infrastructure import InfrastructureState

_BASELINES: dict[Station, dict] = {
    "Maitri": {
        "buildings_nominal": 12,
        "buildings_total": 12,
        "utilities_nominal": 8,
        "utilities_total": 8,
        "equipment_nominal": 31,
        "equipment_total": 33,
        "critical_systems_nominal": 6,
        "critical_systems_total": 6,
    },
    "Bharati": {
        "buildings_nominal": 9,
        "buildings_total": 9,
        "utilities_nominal": 8,
        "utilities_total": 8,
        "equipment_nominal": 29,
        "equipment_total": 31,
        "critical_systems_nominal": 6,
        "critical_systems_total": 6,
    },
}

_lock = Lock()
_state: dict[Station, dict] = {k: dict(v) for k, v in _BASELINES.items()}


def _persist(db: Session, station: Station, values: dict) -> None:
    db.add(InfrastructureModel(station=station, **values))
    db.commit()


def get_state(station: Station) -> InfrastructureState:
    with _lock:
        values = dict(_state[station])
    return InfrastructureState(
        station=station, timestamp=datetime.now(timezone.utc).isoformat(), **values
    )


def tick(station: Station, db: Optional[Session] = None) -> InfrastructureState:
    """Advance the simulated infrastructure snapshot and optionally persist it."""
    state = get_state(station)
    if db is not None:
        try:
            _persist(
                db,
                station,
                {
                    "buildings_nominal": state.buildings_nominal,
                    "buildings_total": state.buildings_total,
                    "utilities_nominal": state.utilities_nominal,
                    "utilities_total": state.utilities_total,
                    "equipment_nominal": state.equipment_nominal,
                    "equipment_total": state.equipment_total,
                    "critical_systems_nominal": state.critical_systems_nominal,
                    "critical_systems_total": state.critical_systems_total,
                },
            )
        except Exception:  # noqa: BLE001
            db.rollback()
    return state
