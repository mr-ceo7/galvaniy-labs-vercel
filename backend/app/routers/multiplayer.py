"""Galvaniy Labs Backend — Multiplayer WebSocket Router."""

import logging
from typing import Dict, List, Any
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(prefix="/ws/multiplayer", tags=["multiplayer"])
logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        # room_id -> list of WebSockets
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room_id: str):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = []
        self.active_connections[room_id].append(websocket)
        logger.info(f"Client connected to room {room_id}. Total: {len(self.active_connections[room_id])}")

    def disconnect(self, websocket: WebSocket, room_id: str):
        if room_id in self.active_connections:
            if websocket in self.active_connections[room_id]:
                self.active_connections[room_id].remove(websocket)
            if len(self.active_connections[room_id]) == 0:
                del self.active_connections[room_id]
        logger.info(f"Client disconnected from room {room_id}.")

    async def broadcast(self, message: str, room_id: str, sender: WebSocket):
        """Broadcasts a message to all clients in a room EXCEPT the sender."""
        if room_id in self.active_connections:
            for connection in self.active_connections[room_id]:
                if connection != sender:
                    try:
                        await connection.send_text(message)
                    except Exception as e:
                        logger.error(f"Error broadcasting to client in room {room_id}: {e}")

manager = ConnectionManager()

@router.websocket("/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    await manager.connect(websocket, room_id)
    try:
        while True:
            data = await websocket.receive_text()
            # We expect data to be a JSON string representing a lab action.
            # E.g. {"type": "start_simulation", "senderId": "..."}
            
            # Broadcast the exact same message to others in the room
            await manager.broadcast(data, room_id, websocket)
            
    except WebSocketDisconnect:
        manager.disconnect(websocket, room_id)
    except Exception as e:
        logger.error(f"WebSocket error in room {room_id}: {e}")
        manager.disconnect(websocket, room_id)
