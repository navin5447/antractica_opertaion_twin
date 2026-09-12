from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import station_path
from app.database import get_db
from app.schemas.environment import Station
from app.schemas.station import SimulateRequest, SimulateResponse
from app.simulator.whatif import run_simulation

router = APIRouter(prefix="/api/stations", tags=["simulation"])


@router.post("/{station}/simulate", response_model=SimulateResponse)
def simulate(body: SimulateRequest, station: Station = Depends(station_path), db: Session = Depends(get_db)):
    current_state, simulated_state = run_simulation(station, body, db)
    return SimulateResponse(station=station, current_state=current_state, simulated_state=simulated_state)
