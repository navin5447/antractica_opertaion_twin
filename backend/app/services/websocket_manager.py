import logging

from fastapi import WebSocket

logger = logging.getLogger("websocket_manager")


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = {}

    async def connect(self, station: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.setdefault(station, set()).add(websocket)

    def disconnect(self, station: str, websocket: WebSocket) -> None:
        self._connections.get(station, set()).discard(websocket)

    async def broadcast(self, station: str, payload: dict) -> None:
        dead: list[WebSocket] = []
        for websocket in self._connections.get(station, set()):
            try:
                await websocket.send_json(payload)
            except Exception:  # noqa: BLE001
                dead.append(websocket)
        for websocket in dead:
            self.disconnect(station, websocket)


manager = ConnectionManager()
