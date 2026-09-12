from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import station_path
from app.database import get_db
from app.digital_twin.state import build_digital_twin_state, build_station_state
from app.schemas.environment import Station
from app.schemas.station import DigitalTwinState, StationState

router = APIRouter(prefix="/api/stations", tags=["stations"])

STATIONS = [
    {"id": "Maitri", "name": "Maitri", "region": "Schirmacher Oasis", "coords": "70°45′S / 11°44′E"},
    {"id": "Bharati", "name": "Bharati", "region": "Larsemann Hills", "coords": "69°24′S / 76°11′E"},
]


@router.get("")
def list_stations():
    return {"stations": STATIONS}


@router.get("/{station}/state", response_model=StationState)
def get_station_state(station: Station = Depends(station_path), db: Session = Depends(get_db)):
    return build_station_state(station, db)


@router.get("/{station}/digital-twin", response_model=DigitalTwinState)
def get_digital_twin(station: Station = Depends(station_path), db: Session = Depends(get_db)):
    return build_digital_twin_state(station, db)
