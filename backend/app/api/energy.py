from fastapi import APIRouter, Depends

from app.api.deps import station_path
from app.schemas.energy import EnergyState
from app.schemas.environment import Station
from app.services import energy_service

router = APIRouter(prefix="/api/stations", tags=["energy"])


@router.get("/{station}/energy", response_model=EnergyState)
def get_energy(station: Station = Depends(station_path)):
    return energy_service.get_state(station)
