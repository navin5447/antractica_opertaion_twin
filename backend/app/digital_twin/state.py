"""Aggregates the four domains into a single Digital Twin state per station,
and drives the bounded-autonomy blackout cycle (Phase 12)."""

from typing import Optional

from sqlalchemy.orm import Session

from app.config import get_settings
from app.decision_engine.bounded_autonomy import select_action
from app.decision_engine.capacity import calculate_safe_operating_capacity
from app.decision_engine.ledger_service import last_decision, record_decision
from app.schemas.decision import DecisionEntry
from app.schemas.environment import Station
from app.schemas.station import DigitalTwinState, LimitingFactor, SafeOperatingCapacity, StationState
from app.services import connectivity_service, energy_service, environment_service, infrastructure_service, logistics_service


def build_station_state(station: Station, db: Optional[Session] = None) -> StationState:
    return StationState(
        station=station,
        environment=environment_service.get_live(station, db),
        infrastructure=infrastructure_service.get_state(station),
        energy=energy_service.get_state(station),
        logistics=logistics_service.get_state(station),
        connectivity=connectivity_service.get_state(station),
    )


def build_digital_twin_state(station: Station, db: Optional[Session] = None) -> DigitalTwinState:
    state = build_station_state(station, db)
    settings = get_settings()
    result = calculate_safe_operating_capacity(
        environment=state.environment,
        energy=state.energy,
        logistics=state.logistics,
        infrastructure=state.infrastructure,
        settings=settings,
    )
    capacity = SafeOperatingCapacity(
        safe_capacity_percent=result.safe_capacity_percent,
        risk_level=result.risk_level,
        limiting_factors=[
            LimitingFactor(domain=f.domain, score=f.score, reason=f.reason) for f in result.limiting_factors
        ],
        recommended_action=result.recommended_action,
        domain_scores=result.domain_scores,
    )
    return DigitalTwinState(**state.model_dump(), safe_operating_capacity=capacity)


def run_autonomous_cycle(station: Station, db: Session) -> tuple[DigitalTwinState, Optional[DecisionEntry]]:
    """Phase 12 blackout operation: evaluate the full station state and, if the
    station is in BLACKOUT and a pre-approved action is warranted, execute
    (simulate) it and record it in the Decision Ledger. No physical control is
    performed - this is a software prototype decision record only.
    """
    twin_state = build_digital_twin_state(station, db)
    if twin_state.connectivity.state != "BLACKOUT":
        return twin_state, None

    settings = get_settings()
    capacity_result = calculate_safe_operating_capacity(
        environment=twin_state.environment,
        energy=twin_state.energy,
        logistics=twin_state.logistics,
        infrastructure=twin_state.infrastructure,
        settings=settings,
    )
    action = select_action(
        capacity_result,
        energy_available_kw=twin_state.energy.available_power_kw,
        energy_critical_kw=twin_state.energy.critical_load_kw,
    )
    if action is None:
        return twin_state, None

    previous = last_decision(db, station)
    if previous is not None and previous.action == action.action and previous.connectivity_state == "BLACKOUT":
        # Avoid flooding the ledger with an identical repeated decision every
        # collector cycle - only record when the situation actually changes.
        return twin_state, None

    entry = record_decision(db, station, connectivity_state="BLACKOUT", action=action)
    return twin_state, entry
