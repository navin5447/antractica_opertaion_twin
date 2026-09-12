from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import station_path
from app.database import get_db
from app.decision_engine.ledger_service import list_decisions
from app.schemas.decision import DecisionEntry
from app.schemas.environment import Station

router = APIRouter(prefix="/api/stations", tags=["decisions"])


@router.get("/{station}/decisions", response_model=list[DecisionEntry])
def get_decisions(station: Station = Depends(station_path), db: Session = Depends(get_db), limit: int = 100):
    return list_decisions(db, station, limit=limit)
