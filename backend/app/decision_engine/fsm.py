"""Deterministic connectivity finite state machine.

CONNECTED  -> HQ SUPERVISION            (HQ has full visibility and control)
DEGRADED   -> LOCAL ASSISTED OPERATION  (intermittent uplink, local cache used)
BLACKOUT   -> LOCAL AUTONOMOUS OPERATION (no uplink, bounded autonomy takes over)

There is no ML or scoring involved - the mapping is a fixed table, and every
state is reachable from every other state (a station can lose or regain
connectivity at any time).
"""

from typing import Literal

ConnectivityState = Literal["CONNECTED", "DEGRADED", "BLACKOUT"]

_VALID_STATES: tuple[ConnectivityState, ...] = ("CONNECTED", "DEGRADED", "BLACKOUT")

_OPERATION_MODE: dict[ConnectivityState, str] = {
    "CONNECTED": "HQ SUPERVISION",
    "DEGRADED": "LOCAL ASSISTED OPERATION",
    "BLACKOUT": "LOCAL AUTONOMOUS OPERATION",
}

_BASE_LATENCY_MS: dict[ConnectivityState, int] = {
    "CONNECTED": 42,
    "DEGRADED": 220,
    "BLACKOUT": 0,
}


class InvalidConnectivityState(ValueError):
    pass


def validate_state(state: str) -> ConnectivityState:
    if state not in _VALID_STATES:
        raise InvalidConnectivityState(f"Unknown connectivity state: {state!r}")
    return state  # type: ignore[return-value]


def operation_mode_for(state: ConnectivityState) -> str:
    return _OPERATION_MODE[validate_state(state)]


def latency_ms_for(state: ConnectivityState) -> int:
    return _BASE_LATENCY_MS[validate_state(state)]


def is_autonomous(state: ConnectivityState) -> bool:
    return validate_state(state) == "BLACKOUT"
