from datetime import datetime, timezone
from threading import Lock
from typing import Optional

from sqlalchemy.orm import Session

from app.decision_engine.fsm import ConnectivityState, latency_ms_for, operation_mode_for, validate_state
from app.models.connectivity import ConnectivityStatus as ConnectivityModel
from app.schemas.connectivity import ConnectivityStatusOut
from app.schemas.environment import Station

_BASE_LATENCY_MS: dict[Station, int] = {"Maitri": 42, "Bharati": 58}

_lock = Lock()
_state: dict[Station, ConnectivityState] = {"Maitri": "CONNECTED", "Bharati": "CONNECTED"}


def _persist(db: Session, station: Station, out: ConnectivityStatusOut) -> None:
    db.add(
        ConnectivityModel(
            station=station,
            state=out.state,
            operation_mode=out.operation_mode,
            latency_ms=out.latency_ms,
        )
    )
    db.commit()


def get_state(station: Station) -> ConnectivityStatusOut:
    with _lock:
        state = _state[station]
    latency = _BASE_LATENCY_MS[station] if state == "CONNECTED" else latency_ms_for(state)
    return ConnectivityStatusOut(
        station=station,
        timestamp=datetime.now(timezone.utc).isoformat(),
        state=state,
        operation_mode=operation_mode_for(state),
        latency_ms=latency,
    )


def set_state(station: Station, state: str, db: Optional[Session] = None) -> ConnectivityStatusOut:
    validated = validate_state(state)
    with _lock:
        _state[station] = validated
    out = get_state(station)
    if db is not None:
        try:
            _persist(db, station, out)
        except Exception:  # noqa: BLE001
            db.rollback()
    return out
