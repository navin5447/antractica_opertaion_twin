import pytest

from app.decision_engine.fsm import InvalidConnectivityState, is_autonomous, latency_ms_for, operation_mode_for, validate_state


class TestConnectedState:
    def test_maps_to_hq_supervision(self):
        assert operation_mode_for("CONNECTED") == "HQ SUPERVISION"
        assert is_autonomous("CONNECTED") is False


class TestDegradedState:
    def test_maps_to_local_assisted_operation(self):
        assert operation_mode_for("DEGRADED") == "LOCAL ASSISTED OPERATION"
        assert is_autonomous("DEGRADED") is False
        assert latency_ms_for("DEGRADED") > latency_ms_for("CONNECTED")


class TestBlackoutState:
    def test_maps_to_local_autonomous_operation(self):
        assert operation_mode_for("BLACKOUT") == "LOCAL AUTONOMOUS OPERATION"
        assert is_autonomous("BLACKOUT") is True


class TestInvalidState:
    def test_unknown_state_is_rejected(self):
        with pytest.raises(InvalidConnectivityState):
            validate_state("OFFLINE")
