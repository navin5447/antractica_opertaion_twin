from fastapi import APIRouter, Depends

from app.api.deps import station_path
from app.schemas.environment import Station
from app.schemas.infrastructure import InfrastructureState
from app.services import infrastructure_service

router = APIRouter(prefix="/api/stations", tags=["infrastructure"])


@router.get("/{station}/infrastructure", response_model=InfrastructureState)
def get_infrastructure(station: Station = Depends(station_path)):
    return infrastructure_service.get_state(station)
