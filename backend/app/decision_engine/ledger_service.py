from sqlalchemy.orm import Session

from app.decision_engine.bounded_autonomy import ApprovedAction
from app.models.decision import DecisionLedger
from app.schemas.decision import DecisionEntry
from app.schemas.environment import Station


def _to_schema(row: DecisionLedger) -> DecisionEntry:
    return DecisionEntry(
        id=row.id,
        station=row.station,
        timestamp=row.timestamp.isoformat(),
        connectivity_state=row.connectivity_state,
        trigger=row.trigger,
        rule=row.rule,
        action=row.action,
        safety_limit=row.safety_limit,
        outcome=row.outcome,
        status=row.status,
    )


def record_decision(
    db: Session,
    station: Station,
    connectivity_state: str,
    action: ApprovedAction,
    status: str = "AUTO",
) -> DecisionEntry:
    row = DecisionLedger(
        station=station,
        connectivity_state=connectivity_state,
        trigger=action.trigger,
        rule=action.rule,
        action=action.action,
        safety_limit=action.safety_limit,
        outcome=action.outcome,
        status=status,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_schema(row)


def list_decisions(db: Session, station: Station, limit: int = 100) -> list[DecisionEntry]:
    rows = (
        db.query(DecisionLedger)
        .filter(DecisionLedger.station == station)
        .order_by(DecisionLedger.timestamp.desc(), DecisionLedger.id.desc())
        .limit(limit)
        .all()
    )
    return [_to_schema(row) for row in rows]


def last_decision(db: Session, station: Station) -> DecisionEntry | None:
    row = (
        db.query(DecisionLedger)
        .filter(DecisionLedger.station == station)
        .order_by(DecisionLedger.timestamp.desc(), DecisionLedger.id.desc())
        .first()
    )
    return _to_schema(row) if row else None
