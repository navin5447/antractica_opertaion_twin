from unittest.mock import patch

import pytest

from app.collectors.ncpor import NCPORReading
from app.schemas.station import SimulateRequest
from app.services import energy_service, environment_service, logistics_service
from app.simulator.whatif import run_simulation


@pytest.fixture(autouse=True)
def _seed_environment():
    reading = NCPORReading(
        station="Maitri",
        timestamp="2026-01-01T00:00:00+00:00",
        temperature_c=-18.6,
        humidity_percent=64,
        pressure_mbar=982,
        wind_speed_knots=19,
    )
    with patch("app.services.environment_service.fetch_station_live", return_value=reading):
        environment_service.collect_station("Maitri")
    yield


class TestSimulationDoesNotMutateRealState:
    def test_simulated_inputs_do_not_persist(self, db_session):
        before_energy = energy_service.get_state("Maitri")
        before_logistics = logistics_service.get_state("Maitri")

        request = SimulateRequest(wind_speed_knots=55, available_power_kw=100, fuel_level_percent=5)
        run_simulation("Maitri", request, db_session)

        after_energy = energy_service.get_state("Maitri")
        after_logistics = logistics_service.get_state("Maitri")

        assert after_energy.available_power_kw == before_energy.available_power_kw
        assert after_logistics.fuel_stock_percent == before_logistics.fuel_stock_percent


class TestSimulationReflectsOverrides:
    def test_extreme_wind_and_low_fuel_lower_capacity(self, db_session):
        request = SimulateRequest(wind_speed_knots=55, fuel_level_percent=5, connectivity="BLACKOUT")
        current_state, simulated_state = run_simulation("Maitri", request, db_session)

        assert simulated_state.safe_operating_capacity.safe_capacity_percent < current_state.safe_operating_capacity.safe_capacity_percent
        assert simulated_state.connectivity.state == "BLACKOUT"
        assert simulated_state.environment.wind_speed_knots == 55
        assert simulated_state.logistics.fuel_stock_percent == 5

    def test_response_includes_both_states(self, db_session):
        request = SimulateRequest(temperature_c=-20)
        current_state, simulated_state = run_simulation("Maitri", request, db_session)
        assert current_state.station == "Maitri"
        assert simulated_state.station == "Maitri"
        assert simulated_state.environment.temperature_c == -20
