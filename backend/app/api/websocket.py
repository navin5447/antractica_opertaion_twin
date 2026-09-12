import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.api.deps import VALID_STATIONS
from app.database import SessionLocal
from app.digital_twin.state import build_digital_twin_state
from app.services.websocket_manager import manager

logger = logging.getLogger("websocket_api")

router = APIRouter()


@router.websocket("/ws/stations/{station}")
async def station_updates(websocket: WebSocket, station: str):
    normalized = station.strip().capitalize()
    if normalized not in VALID_STATIONS:
        await websocket.close(code=1008)
        return

    await manager.connect(normalized, websocket)
    db = SessionLocal()
    try:
        # Send the current state immediately on connect.
        initial_state = build_digital_twin_state(normalized, db)
        await websocket.send_json(
            {"type": "digital_twin_update", "station": normalized, "state": initial_state.model_dump()}
        )
        while True:
            # The collector loop pushes updates; we only need to keep the
            # socket alive and drain any client pings/messages.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        db.close()
        manager.disconnect(normalized, websocket)
