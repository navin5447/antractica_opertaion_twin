from app.decision_engine.bounded_autonomy import APPROVED_ACTIONS, select_action
from app.decision_engine.capacity import DomainScore, CapacityResult


def make_result(risk_level: str, lowest_domain: str) -> CapacityResult:
    return CapacityResult(
        safe_capacity_percent=50,
        risk_level=risk_level,
        limiting_factors=[DomainScore(domain=lowest_domain, score=40, reason="test")],
        recommended_action="",
        domain_scores={lowest_domain: 40},
    )


class TestNoActionWhenLowRisk:
    def test_returns_none(self):
        result = make_result("LOW", "Energy")
        assert select_action(result, energy_available_kw=700, energy_critical_kw=400) is None


class TestApprovedActionsAreOnlyTheCatalog:
    def test_energy_shortfall_prioritizes_essential_energy(self):
        result = make_result("CRITICAL", "Energy")
        action = select_action(result, energy_available_kw=300, energy_critical_kw=400)
        assert action == APPROVED_ACTIONS["PRIORITIZE_ESSENTIAL_ENERGY"]

    def test_energy_tight_margin_reduces_non_critical_loads(self):
        result = make_result("HIGH", "Energy")
        action = select_action(result, energy_available_kw=420, energy_critical_kw=400)
        assert action == APPROVED_ACTIONS["REDUCE_NON_CRITICAL_LOADS"]

    def test_logistics_protects_fuel_reserve(self):
        result = make_result("HIGH", "Logistics")
        action = select_action(result, energy_available_kw=700, energy_critical_kw=400)
        assert action == APPROVED_ACTIONS["PROTECT_FUEL_RESERVE"]

    def test_environment_reduces_non_essential_operations(self):
        result = make_result("HIGH", "Environment")
        action = select_action(result, energy_available_kw=700, energy_critical_kw=400)
        assert action == APPROVED_ACTIONS["REDUCE_NON_ESSENTIAL_OPERATIONS"]

    def test_infrastructure_reduces_non_essential_operations(self):
        result = make_result("HIGH", "Infrastructure")
        action = select_action(result, energy_available_kw=700, energy_critical_kw=400)
        assert action == APPROVED_ACTIONS["REDUCE_NON_ESSENTIAL_OPERATIONS"]

    def test_action_always_comes_from_the_fixed_catalog(self):
        for domain in ("Energy", "Logistics", "Environment", "Infrastructure"):
            result = make_result("HIGH", domain)
            action = select_action(result, energy_available_kw=700, energy_critical_kw=400)
            assert action in APPROVED_ACTIONS.values()
