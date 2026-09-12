from fastapi import APIRouter, Depends

from app.api.deps import station_path
from app.schemas.environment import Station
from app.schemas.logistics import LogisticsState
from app.services import logistics_service

router = APIRouter(prefix="/api/stations", tags=["logistics"])


@router.get("/{station}/logistics", response_model=LogisticsState)
def get_logistics(station: Station = Depends(station_path)):
    return logistics_service.get_state(station)
