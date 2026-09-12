"""Deterministic Safe Operating Capacity engine.

No machine learning, no randomness. The capacity is the outcome of rule
evaluation, constraint checks and risk scoring across the four domains
(Environment, Energy, Logistics, Infrastructure). The overall safe capacity is
bounded by the weakest ("limiting") domain, mirroring how a real operations
envelope works: you can't out-perform your worst constraint.
"""

from dataclasses import dataclass, field

from app.config import Settings
from app.schemas.energy import EnergyState
from app.schemas.environment import LiveEnvironment
from app.schemas.infrastructure import InfrastructureState
from app.schemas.logistics import LogisticsState


def _clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


@dataclass
class DomainScore:
    domain: str
    score: float
    reason: str


@dataclass
class CapacityResult:
    safe_capacity_percent: int
    risk_level: str
    limiting_factors: list[DomainScore] = field(default_factory=list)
    recommended_action: str = ""
    domain_scores: dict[str, float] = field(default_factory=dict)


def score_environment(environment: LiveEnvironment, settings: Settings) -> DomainScore:
    score = 100.0
    reasons: list[str] = []

    if environment.wind_speed_knots > settings.wind_speed_limit_knots:
        excess = environment.wind_speed_knots - settings.wind_speed_limit_knots
        score -= min(60.0, excess * 3.0)
        reasons.append(
            f"Wind speed {environment.wind_speed_knots} kt exceeds the {settings.wind_speed_limit_knots} kt limit"
        )

    if environment.temperature_c < settings.temp_low_limit_c:
        excess = settings.temp_low_limit_c - environment.temperature_c
        score -= min(50.0, excess * 4.0)
        reasons.append(
            f"Temperature {environment.temperature_c}°C is below the {settings.temp_low_limit_c}°C limit"
        )
    elif environment.temperature_c > settings.temp_high_limit_c:
        excess = environment.temperature_c - settings.temp_high_limit_c
        score -= min(50.0, excess * 4.0)
        reasons.append(
            f"Temperature {environment.temperature_c}°C is above the {settings.temp_high_limit_c}°C limit"
        )

    if environment.status == "STALE":
        score -= 5.0
        reasons.append("Environmental feed is STALE (NCPOR unreachable)")

    if not reasons:
        reasons.append("Wind and temperature within operating bands")

    return DomainScore(domain="Environment", score=_clamp(score), reason="; ".join(reasons))


def score_energy(energy: EnergyState, settings: Settings) -> DomainScore:
    margin = energy.available_power_kw - energy.critical_load_kw
    required_margin = settings.critical_load_margin_kw

    if margin < 0:
        score = 20.0
        reason = (
            f"Available power {energy.available_power_kw} kW is below the critical load "
            f"{energy.critical_load_kw} kW"
        )
    elif margin < required_margin:
        deficit_ratio = (required_margin - margin) / required_margin
        score = _clamp(90.0 - deficit_ratio * 40.0)
        reason = f"Critical load leaves only a {round(margin, 1)} kW margin (below the {required_margin} kW target)"
    else:
        score = _clamp(100.0 - max(0.0, (energy.non_critical_load_kw / max(energy.available_power_kw, 1)) * 15.0))
        reason = f"Critical load leaves a stable {round(margin, 1)} kW margin"

    return DomainScore(domain="Energy", score=_clamp(score), reason=reason)


def score_logistics(logistics: LogisticsState, settings: Settings) -> DomainScore:
    fuel = logistics.fuel_stock_percent
    # The station's own configured safety reserve is authoritative; the
    # settings threshold is only a fallback for stations with no configured value.
    reserve = logistics.safety_reserve_percent or settings.fuel_safety_reserve_percent
    buffer = settings.fuel_warning_buffer_percent

    if fuel <= reserve:
        score = 25.0
        reason = f"Fuel stock {fuel}% has reached the {reserve}% safety reserve"
    elif fuel <= reserve + buffer:
        proximity = (fuel - reserve) / buffer
        score = _clamp(25.0 + proximity * 35.0)
        reason = f"Fuel stock {fuel}% is approaching the {reserve}% safety reserve"
    else:
        score = _clamp(60.0 + min(40.0, (logistics.remaining_operational_days / 30.0) * 40.0))
        reason = f"{logistics.remaining_operational_days} days runway with {reserve}% reserve protected"

    return DomainScore(domain="Logistics", score=_clamp(score), reason=reason)


def score_infrastructure(infrastructure: InfrastructureState, settings: Settings) -> DomainScore:
    if infrastructure.critical_systems_nominal < infrastructure.critical_systems_total:
        missing = infrastructure.critical_systems_total - infrastructure.critical_systems_nominal
        score = _clamp(30.0 - missing * 5.0)
        reason = f"{missing} critical system(s) not nominal"
    else:
        equipment_flags = infrastructure.equipment_total - infrastructure.equipment_nominal
        score = _clamp(100.0 - equipment_flags * 5.0, low=70.0)
        reason = "All critical systems nominal" + (
            f"; {equipment_flags} equipment service flag(s)" if equipment_flags else ""
        )

    return DomainScore(domain="Infrastructure", score=_clamp(score), reason=reason)


def _risk_level(overall: float) -> str:
    if overall >= 85:
        return "LOW"
    if overall >= 65:
        return "MODERATE"
    if overall >= 40:
        return "HIGH"
    return "CRITICAL"


_RECOMMENDED_ACTION_BY_DOMAIN = {
    "Energy": "Reduce non-critical loads",
    "Logistics": "Protect minimum fuel reserve",
    "Environment": "Reduce non-essential operations",
    "Infrastructure": "Reduce non-essential operations",
}


def calculate_safe_operating_capacity(
    environment: LiveEnvironment,
    energy: EnergyState,
    logistics: LogisticsState,
    infrastructure: InfrastructureState,
    settings: Settings,
) -> CapacityResult:
    scores = [
        score_environment(environment, settings),
        score_energy(energy, settings),
        score_logistics(logistics, settings),
        score_infrastructure(infrastructure, settings),
    ]

    overall = min(s.score for s in scores)
    safe_capacity_percent = round(overall)
    risk_level = _risk_level(overall)

    limiting_factors = sorted(
        [s for s in scores if s.score < 85.0], key=lambda s: s.score
    )
    if not limiting_factors:
        limiting_factors = sorted(scores, key=lambda s: s.score)[:1]

    lowest_domain = limiting_factors[0].domain
    if risk_level in ("LOW",):
        recommended_action = "Continue current operating plan"
    else:
        recommended_action = _RECOMMENDED_ACTION_BY_DOMAIN.get(lowest_domain, "Reduce non-essential operations")
        if lowest_domain == "Energy" and energy.available_power_kw < energy.critical_load_kw:
            recommended_action = "Prioritize essential energy usage"

    return CapacityResult(
        safe_capacity_percent=safe_capacity_percent,
        risk_level=risk_level,
        limiting_factors=limiting_factors,
        recommended_action=recommended_action,
        domain_scores={s.domain: s.score for s in scores},
    )
