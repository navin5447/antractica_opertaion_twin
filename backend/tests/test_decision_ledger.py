from app.decision_engine.bounded_autonomy import APPROVED_ACTIONS
from app.decision_engine.ledger_service import last_decision, list_decisions, record_decision


class TestRecordAndListDecisions:
    def test_recorded_decision_is_returned_in_ledger(self, db_session):
        entry = record_decision(
            db_session, "Maitri", connectivity_state="BLACKOUT", action=APPROVED_ACTIONS["PROTECT_FUEL_RESERVE"]
        )
        assert entry.station == "Maitri"
        assert entry.action == "Protect minimum fuel reserve"
        assert entry.outcome == "Safety reserve protected"

        rows = list_decisions(db_session, "Maitri")
        assert len(rows) == 1
        assert rows[0].id == entry.id

    def test_ledger_is_scoped_per_station(self, db_session):
        record_decision(db_session, "Maitri", "BLACKOUT", APPROVED_ACTIONS["PROTECT_FUEL_RESERVE"])
        record_decision(db_session, "Bharati", "BLACKOUT", APPROVED_ACTIONS["REDUCE_NON_CRITICAL_LOADS"])

        assert len(list_decisions(db_session, "Maitri")) == 1
        assert len(list_decisions(db_session, "Bharati")) == 1

    def test_last_decision_returns_most_recent(self, db_session):
        record_decision(db_session, "Maitri", "BLACKOUT", APPROVED_ACTIONS["PROTECT_FUEL_RESERVE"])
        record_decision(db_session, "Maitri", "BLACKOUT", APPROVED_ACTIONS["REDUCE_NON_CRITICAL_LOADS"])

        latest = last_decision(db_session, "Maitri")
        assert latest.action == "Reduce non-critical loads"

    def test_no_decisions_returns_empty_list(self, db_session):
        assert list_decisions(db_session, "Bharati") == []
        assert last_decision(db_session, "Bharati") is None
