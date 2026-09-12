from fastapi import HTTPException, Path

from app.schemas.environment import Station

VALID_STATIONS = ("Maitri", "Bharati")


def station_path(station: str = Path(..., description="Maitri or Bharati")) -> Station:
    normalized = station.strip().capitalize()
    if normalized not in VALID_STATIONS:
        raise HTTPException(status_code=404, detail=f"Unknown station '{station}'. Expected one of {VALID_STATIONS}.")
    return normalized  # type: ignore[return-value]
