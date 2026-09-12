import asyncio
import logging

from app.config import get_settings
from app.database import SessionLocal
from app.digital_twin.state import run_autonomous_cycle
from app.services import energy_service, environment_service, infrastructure_service, logistics_service
from app.services.websocket_manager import manager

logger = logging.getLogger("collector_loop")

STATIONS = ("Maitri", "Bharati")

_task: asyncio.Task | None = None


async def _run_cycle_for_station(station: str) -> None:
    db = SessionLocal()
    try:
        # 1-2. Fetch + validate real NCPOR environment (falls back to STALE
        # internally and never raises for a plain fetch failure).
        environment_service.collect_station(station, db)

        # Simulated domains still get a persisted snapshot each cycle.
        infrastructure_service.tick(station, db)
        energy_service.tick(station, db)
        logistics_service.tick(station, db)

        # Blackout bounded-autonomy evaluation + decision ledger.
        twin_state, decision = run_autonomous_cycle(station, db)

        payload = {"type": "digital_twin_update", "station": station, "state": twin_state.model_dump()}
        if decision is not None:
            payload["decision"] = decision.model_dump()
        await manager.broadcast(station, payload)
    except Exception:  # noqa: BLE001 - the collector must never crash the server
        logger.exception("Collector cycle failed for %s", station)
    finally:
        db.close()


async def _loop() -> None:
    settings = get_settings()
    while True:
        for station in STATIONS:
            await _run_cycle_for_station(station)
        await asyncio.sleep(settings.ncpor_refresh_interval)


def start() -> None:
    global _task
    if _task is None:
        _task = asyncio.create_task(_loop())


def stop() -> None:
    global _task
    if _task is not None:
        _task.cancel()
        _task = None
