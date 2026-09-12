from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import station_path
from app.database import get_db
from app.schemas.environment import LiveEnvironment, Station
from app.services import environment_service

router = APIRouter(prefix="/api/stations", tags=["environment"])


@router.get("/{station}/environment/live", response_model=LiveEnvironment)
def get_environment_live(station: Station = Depends(station_path), db: Session = Depends(get_db)):
    return environment_service.get_live(station, db)
