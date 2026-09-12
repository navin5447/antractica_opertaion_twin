from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import station_path
from app.database import get_db
from app.digital_twin.state import run_autonomous_cycle
from app.schemas.connectivity import ConnectivityStatusOut, ConnectivityUpdateRequest
from app.schemas.environment import Station
from app.services import connectivity_service
from app.services.websocket_manager import manager

router = APIRouter(prefix="/api/stations", tags=["connectivity"])


@router.get("/{station}/connectivity", response_model=ConnectivityStatusOut)
def get_connectivity(station: Station = Depends(station_path)):
    return connectivity_service.get_state(station)


@router.post("/{station}/connectivity", response_model=ConnectivityStatusOut)
async def set_connectivity(
    body: ConnectivityUpdateRequest,
    station: Station = Depends(station_path),
    db: Session = Depends(get_db),
):
    status = connectivity_service.set_state(station, body.state, db)

    # Immediately evaluate bounded autonomy so a transition into BLACKOUT is
    # reflected in the Decision Ledger without waiting for the next collector tick.
    twin_state, decision = run_autonomous_cycle(station, db)
    payload = {"type": "digital_twin_update", "station": station, "state": twin_state.model_dump()}
    if decision is not None:
        payload["decision"] = decision.model_dump()
    await manager.broadcast(station, payload)

    return status
