"""What-If Simulator (Phase 14).

Applies hypothetical inputs on top of the current station state and re-runs
the exact same deterministic Safe Operating Capacity engine used for real
operation. Nothing here mutates the real, persisted station state - every
service call below either reads current state or produces a standalone copy.
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.config import get_settings
from app.decision_engine.capacity import calculate_safe_operating_capacity
from app.decision_engine.fsm import latency_ms_for, operation_mode_for, validate_state
from app.digital_twin.state import build_digital_twin_state
from app.schemas.connectivity import ConnectivityStatusOut
from app.schemas.environment import LiveEnvironment, Station
from app.schemas.station import DigitalTwinState, LimitingFactor, SafeOperatingCapacity, SimulateRequest
from app.services import energy_service, logistics_service


def run_simulation(station: Station, request: SimulateRequest, db: Optional[Session] = None) -> tuple[DigitalTwinState, DigitalTwinState]:
    current_state = build_digital_twin_state(station, db)

    environment = current_state.environment.model_copy()
    if request.temperature_c is not None:
        environment.temperature_c = request.temperature_c
    if request.wind_speed_knots is not None:
        environment.wind_speed_knots = request.wind_speed_knots
    if request.humidity_percent is not None:
        environment.humidity_percent = request.humidity_percent
    if request.pressure_mbar is not None:
        environment.pressure_mbar = request.pressure_mbar

    energy = current_state.energy.model_copy()
    if request.available_power_kw is not None:
        energy = energy_service.set_available_power(station, request.available_power_kw)
    if request.critical_load_kw is not None:
        energy.critical_load_kw = request.critical_load_kw

    logistics = current_state.logistics.model_copy()
    if request.fuel_level_percent is not None:
        logistics = logistics_service.set_fuel_level(station, request.fuel_level_percent)

    connectivity = current_state.connectivity.model_copy()
    if request.connectivity is not None:
        state = validate_state(request.connectivity)
        connectivity = ConnectivityStatusOut(
            station=station,
            timestamp=datetime.now(timezone.utc).isoformat(),
            state=state,
            operation_mode=operation_mode_for(state),
            latency_ms=latency_ms_for(state),
        )

    settings = get_settings()
    result = calculate_safe_operating_capacity(
        environment=environment,
        energy=energy,
        logistics=logistics,
        infrastructure=current_state.infrastructure,
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

    simulated_state = DigitalTwinState(
        station=station,
        environment=environment,
        infrastructure=current_state.infrastructure,
        energy=energy,
        logistics=logistics,
        connectivity=connectivity,
        safe_operating_capacity=capacity,
    )
    return current_state, simulated_state
