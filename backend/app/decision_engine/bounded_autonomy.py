"""Bounded autonomy: a fixed catalog of pre-approved actions.

The system must never invent an action. Every autonomous decision maps onto
exactly one of these four entries, selected deterministically from the Safe
Operating Capacity evaluation - never at random and never by a model.
"""

from dataclasses import dataclass

from app.decision_engine.capacity import CapacityResult


@dataclass(frozen=True)
class ApprovedAction:
    trigger: str
    rule: str
    action: str
    safety_limit: str
    outcome: str


APPROVED_ACTIONS: dict[str, ApprovedAction] = {
    "REDUCE_NON_CRITICAL_LOADS": ApprovedAction(
        trigger="Available power below threshold",
        rule="Protect critical loads",
        action="Reduce non-critical loads",
        safety_limit="Critical load must remain supplied",
        outcome="Critical operations maintained",
    ),
    "PRIORITIZE_ESSENTIAL_ENERGY": ApprovedAction(
        trigger="Available power below required critical load",
        rule="Prioritize essential systems",
        action="Prioritize essential energy usage",
        safety_limit="Critical load must remain supplied",
        outcome="Essential systems kept online",
    ),
    "PROTECT_FUEL_RESERVE": ApprovedAction(
        trigger="Fuel stock approaching or at safety reserve",
        rule="Protect minimum fuel reserve",
        action="Protect minimum fuel reserve",
        safety_limit="Fuel stock must not fall below the safety reserve",
        outcome="Safety reserve protected",
    ),
    "REDUCE_NON_ESSENTIAL_OPERATIONS": ApprovedAction(
        trigger="Environmental or infrastructure risk elevated",
        rule="Recalculate safe operating capacity",
        action="Reduce non-essential operations",
        safety_limit="Critical systems must remain within operating limits",
        outcome="Operating envelope restored to a safe bound",
    ),
}


def select_action(capacity: CapacityResult, energy_available_kw: float, energy_critical_kw: float) -> ApprovedAction | None:
    """Deterministically pick the single pre-approved action for the current
    Safe Operating Capacity result, or None if no action is warranted."""
    if capacity.risk_level == "LOW":
        return None

    lowest = capacity.limiting_factors[0]

    if lowest.domain == "Energy":
        if energy_available_kw < energy_critical_kw:
            return APPROVED_ACTIONS["PRIORITIZE_ESSENTIAL_ENERGY"]
        return APPROVED_ACTIONS["REDUCE_NON_CRITICAL_LOADS"]

    if lowest.domain == "Logistics":
        return APPROVED_ACTIONS["PROTECT_FUEL_RESERVE"]

    # Environment or Infrastructure
    return APPROVED_ACTIONS["REDUCE_NON_ESSENTIAL_OPERATIONS"]
