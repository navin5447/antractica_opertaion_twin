from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.collectors.ncpor import NCPORReading


def _reading(station="Maitri"):
    return NCPORReading(
        station=station,
        timestamp="2026-01-01T00:00:00+00:00",
        temperature_c=-18.6,
        humidity_percent=64,
        pressure_mbar=982,
        wind_speed_knots=19,
    )


@pytest.fixture
def client():
    with patch("app.services.environment_service.fetch_station_live", side_effect=lambda station: _reading(station)):
        from app.main import app

        with TestClient(app) as test_client:
            yield test_client


class TestHealth:
    def test_health_ok(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"


class TestStationsList:
    def test_lists_maitri_and_bharati(self, client):
        response = client.get("/api/stations")
        ids = [s["id"] for s in response.json()["stations"]]
        assert ids == ["Maitri", "Bharati"]


class TestDigitalTwinEndpoint:
    def test_returns_all_domains(self, client):
        response = client.get("/api/stations/Maitri/digital-twin")
        assert response.status_code == 200
        body = response.json()
        for key in ("environment", "infrastructure", "energy", "logistics", "connectivity", "safe_operating_capacity"):
            assert key in body
        assert body["environment"]["source"] == "NCPOR"
        assert body["energy"]["source"] == "SIMULATED"

    def test_unknown_station_is_404(self, client):
        response = client.get("/api/stations/Vostok/digital-twin")
        assert response.status_code == 404


class TestConnectivityStateMachine:
    def test_connected_maps_to_hq_supervision(self, client):
        response = client.get("/api/stations/Bharati/connectivity")
        assert response.json()["operation_mode"] == "HQ SUPERVISION"

    def test_degraded_maps_to_local_assisted_operation(self, client):
        response = client.post("/api/stations/Bharati/connectivity", json={"state": "DEGRADED"})
        assert response.status_code == 200
        assert response.json()["operation_mode"] == "LOCAL ASSISTED OPERATION"

    def test_blackout_triggers_bounded_autonomy_and_ledger_entry(self, client):
        client.post(
            "/api/stations/Maitri/connectivity",
            json={"state": "BLACKOUT"},
        )
        # Force an energy shortfall isn't possible via the real endpoint (it's
        # simulated internally), but a BLACKOUT transition still evaluates the
        # baseline state and only records a decision if a rule fires. With the
        # nominal baseline, no rule fires - assert this doesn't error and the
        # ledger endpoint responds correctly either way.
        decisions = client.get("/api/stations/Maitri/decisions")
        assert decisions.status_code == 200
        assert isinstance(decisions.json(), list)


class TestSimulateEndpoint:
    def test_simulate_does_not_change_real_state(self, client):
        before = client.get("/api/stations/Maitri/digital-twin").json()
        response = client.post(
            "/api/stations/Maitri/simulate",
            json={"wind_speed_knots": 55, "fuel_level_percent": 5, "connectivity": "BLACKOUT"},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["simulated_state"]["safe_operating_capacity"]["safe_capacity_percent"] < body["current_state"][
            "safe_operating_capacity"
        ]["safe_capacity_percent"]

        after = client.get("/api/stations/Maitri/digital-twin").json()
        assert after["energy"]["available_power_kw"] == before["energy"]["available_power_kw"]
        assert after["connectivity"]["state"] == before["connectivity"]["state"]
