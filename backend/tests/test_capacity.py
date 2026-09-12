from app.config import Settings
from app.decision_engine.capacity import calculate_safe_operating_capacity
from app.schemas.energy import EnergyState
from app.schemas.environment import LiveEnvironment
from app.schemas.infrastructure import InfrastructureState
from app.schemas.logistics import LogisticsState

SETTINGS = Settings()


def make_environment(**overrides) -> LiveEnvironment:
    base = dict(
        station="Maitri",
        timestamp="2026-01-01T00:00:00+00:00",
        temperature_c=-18.6,
        humidity_percent=64,
        pressure_mbar=982,
        wind_speed_knots=19,
        status="LIVE",
        last_updated="2026-01-01T00:00:00+00:00",
    )
    base.update(overrides)
    return LiveEnvironment(**base)


def make_energy(**overrides) -> EnergyState:
    base = dict(
        station="Maitri",
        timestamp="2026-01-01T00:00:00+00:00",
        generator_output_kw=740,
        total_consumption_kw=626,
        critical_load_kw=402,
        non_critical_load_kw=224,
        available_power_kw=724,
        generator_status="ONLINE",
    )
    base.update(overrides)
    return EnergyState(**base)


def make_logistics(**overrides) -> LogisticsState:
    base = dict(
        station="Maitri",
        timestamp="2026-01-01T00:00:00+00:00",
        fuel_stock_percent=68,
        fuel_consumption_rate_percent_per_day=3.1,
        safety_reserve_percent=42,
        essential_supplies_percent=80,
        remaining_operational_days=19,
    )
    base.update(overrides)
    return LogisticsState(**base)


def make_infrastructure(**overrides) -> InfrastructureState:
    base = dict(
        station="Maitri",
        timestamp="2026-01-01T00:00:00+00:00",
        buildings_nominal=12,
        buildings_total=12,
        utilities_nominal=8,
        utilities_total=8,
        equipment_nominal=31,
        equipment_total=33,
        critical_systems_nominal=6,
        critical_systems_total=6,
    )
    base.update(overrides)
    return InfrastructureState(**base)


class TestBaselineIsSafe:
    def test_nominal_state_is_low_risk(self):
        result = calculate_safe_operating_capacity(
            make_environment(), make_energy(), make_logistics(), make_infrastructure(), SETTINGS
        )
        assert result.risk_level == "LOW"
        assert result.safe_capacity_percent >= 85
        assert result.recommended_action == "Continue current operating plan"


class TestEnergyConstraint:
    def test_power_below_critical_load_is_high_risk_energy(self):
        result = calculate_safe_operating_capacity(
            make_environment(),
            make_energy(available_power_kw=300, critical_load_kw=402),
            make_logistics(),
            make_infrastructure(),
            SETTINGS,
        )
        assert result.limiting_factors[0].domain == "Energy"
        assert result.risk_level in ("HIGH", "CRITICAL")
        assert result.recommended_action == "Prioritize essential energy usage"

    def test_tight_margin_recommends_reducing_non_critical_loads(self):
        result = calculate_safe_operating_capacity(
            make_environment(),
            make_energy(available_power_kw=420, critical_load_kw=402),
            make_logistics(),
            make_infrastructure(),
            SETTINGS,
        )
        assert result.limiting_factors[0].domain == "Energy"
        assert result.recommended_action == "Reduce non-critical loads"


class TestFuelReserveConstraint:
    def test_fuel_at_reserve_is_logistics_risk(self):
        result = calculate_safe_operating_capacity(
            make_environment(),
            make_energy(),
            make_logistics(fuel_stock_percent=40, safety_reserve_percent=42, remaining_operational_days=0),
            make_infrastructure(),
            SETTINGS,
        )
        assert result.limiting_factors[0].domain == "Logistics"
        assert result.recommended_action == "Protect minimum fuel reserve"

    def test_fuel_well_above_reserve_is_not_limiting(self):
        result = calculate_safe_operating_capacity(
            make_environment(),
            make_energy(),
            make_logistics(fuel_stock_percent=95, remaining_operational_days=30),
            make_infrastructure(),
            SETTINGS,
        )
        assert result.risk_level == "LOW"


class TestEnvironmentalRisk:
    def test_high_wind_exceeds_limit_lowers_capacity(self):
        result = calculate_safe_operating_capacity(
            make_environment(wind_speed_knots=45),
            make_energy(),
            make_logistics(),
            make_infrastructure(),
            SETTINGS,
        )
        assert result.limiting_factors[0].domain == "Environment"
        assert result.recommended_action == "Reduce non-essential operations"

    def test_extreme_cold_lowers_capacity(self):
        result = calculate_safe_operating_capacity(
            make_environment(temperature_c=-50),
            make_energy(),
            make_logistics(),
            make_infrastructure(),
            SETTINGS,
        )
        assert result.limiting_factors[0].domain == "Environment"


class TestInfrastructureRisk:
    def test_critical_system_down_is_high_risk(self):
        result = calculate_safe_operating_capacity(
            make_environment(),
            make_energy(),
            make_logistics(),
            make_infrastructure(critical_systems_nominal=5, critical_systems_total=6),
            SETTINGS,
        )
        assert result.limiting_factors[0].domain == "Infrastructure"
        assert result.risk_level in ("HIGH", "CRITICAL")


class TestOverallIsWeakestDomain:
    def test_overall_capacity_never_exceeds_the_lowest_domain_score(self):
        result = calculate_safe_operating_capacity(
            make_environment(wind_speed_knots=45),
            make_energy(available_power_kw=300, critical_load_kw=402),
            make_logistics(),
            make_infrastructure(),
            SETTINGS,
        )
        assert result.safe_capacity_percent <= min(result.domain_scores.values()) + 1
