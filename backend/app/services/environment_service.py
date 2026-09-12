import logging
import time
from datetime import datetime, timezone
from threading import Lock
from typing import Optional

from sqlalchemy.orm import Session

from app.collectors.ncpor import NCPORFetchError, NCPORParseError, NCPORReading, fetch_station_live
from app.config import get_settings
from app.models.environment import EnvironmentReading
from app.schemas.environment import LiveEnvironment, Station

logger = logging.getLogger("environment_service")

_lock = Lock()
_last_good: dict[str, NCPORReading] = {}
_fetched_at_monotonic: dict[str, float] = {}


def _persist(db: Session, reading: NCPORReading) -> None:
    db.add(
        EnvironmentReading(
            station=reading.station,
            timestamp=datetime.fromisoformat(reading.timestamp),
            temperature_c=reading.temperature_c,
            humidity_percent=reading.humidity_percent,
            pressure_mbar=reading.pressure_mbar,
            wind_speed_knots=reading.wind_speed_knots,
            source=reading.source,
            data_type=reading.data_type,
        )
    )
    db.commit()


def _to_schema(reading: NCPORReading, status: str, last_updated: str) -> LiveEnvironment:
    return LiveEnvironment(
        station=reading.station,
        timestamp=reading.timestamp,
        temperature_c=reading.temperature_c,
        humidity_percent=reading.humidity_percent,
        pressure_mbar=reading.pressure_mbar,
        wind_speed_knots=reading.wind_speed_knots,
        status=status,
        last_updated=last_updated,
    )


def collect_station(station: Station, db: Optional[Session] = None) -> LiveEnvironment:
    """Fetch a fresh NCPOR reading, persist it, and update the in-memory cache.

    On any fetch/parse failure, the error is logged and the previous
    successful reading is returned marked STALE. The server never crashes
    because NCPOR is unreachable.
    """
    try:
        reading = fetch_station_live(station)
    except (NCPORFetchError, NCPORParseError) as exc:
        logger.error("NCPOR collection failed for %s: %s", station, exc)
        with _lock:
            previous = _last_good.get(station)
        if previous is None:
            raise
        return _to_schema(previous, status="STALE", last_updated=previous.timestamp)

    with _lock:
        _last_good[station] = reading
        _fetched_at_monotonic[station] = time.monotonic()

    if db is not None:
        try:
            _persist(db, reading)
        except Exception:  # noqa: BLE001 - persistence must never break collection
            logger.exception("Failed to persist NCPOR reading for %s", station)
            db.rollback()

    return _to_schema(reading, status="LIVE", last_updated=reading.timestamp)


def get_cached(station: Station) -> Optional[LiveEnvironment]:
    with _lock:
        reading = _last_good.get(station)
    if reading is None:
        return None
    return _to_schema(reading, status="STALE", last_updated=reading.timestamp)


def get_live(station: Station, db: Optional[Session] = None) -> LiveEnvironment:
    """Return the freshest available reading, collecting one if needed.

    A cached reading younger than 2x the refresh interval is served as LIVE
    without blocking on a fresh HTTP round-trip; the background collector
    keeps it warm. An older (or missing) cache triggers a synchronous
    collection attempt, which itself degrades to STALE on failure.
    """
    settings = get_settings()
    with _lock:
        cached = _last_good.get(station)
        fetched_at = _fetched_at_monotonic.get(station)
    if cached is not None and fetched_at is not None:
        age = time.monotonic() - fetched_at
        if age <= settings.ncpor_refresh_interval * 2:
            return _to_schema(cached, status="LIVE", last_updated=cached.timestamp)
    return collect_station(station, db)
