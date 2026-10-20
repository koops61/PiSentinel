import asyncio
import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from typing import Optional

from app.core.security import decode_access_token
from app.services.attack_monitor import attack_monitor
from app.routers.system import get_system_telemetry

logger = logging.getLogger("pisentinel.ws")

router = APIRouter(prefix="/api/ws", tags=["WebSockets"])

@router.websocket("/telemetry")
async def websocket_telemetry_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None)
):
    # Verify token
    auth_token = token
    if not auth_token:
        # Check cookies
        auth_token = websocket.cookies.get("access_token")

    if not auth_token or not decode_access_token(auth_token):
        logger.warning("WebSocket connection rejected: invalid or missing auth token")
        await websocket.close(code=1008)
        return

    await websocket.accept()
    logger.info("WebSocket client connected.")

    queue = asyncio.Queue()
    await attack_monitor.register_subscriber(queue)

    telemetry_interval = 2.0  # send system stats every 2 seconds

    async def send_telemetry_loop():
        try:
            while True:
                # Fetch fresh system telemetry
                stats = get_system_telemetry(user={"role": "admin"})
                await websocket.send_text(json.dumps({
                    "type": "telemetry",
                    "data": stats
                }))
                await asyncio.sleep(telemetry_interval)
        except (WebSocketDisconnect, asyncio.CancelledError):
            pass
        except Exception as e:
            logger.debug(f"Telemetry stream loop exception: {e}")

    async def forward_events_loop():
        try:
            while True:
                event = await queue.get()
                await websocket.send_text(json.dumps(event))
        except (WebSocketDisconnect, asyncio.CancelledError):
            pass
        except Exception as e:
            logger.debug(f"Forward event loop exception: {e}")

    telemetry_task = asyncio.create_task(send_telemetry_loop())
    events_task = asyncio.create_task(forward_events_loop())

    try:
        # Keep connection open and receive potential client messages
        while True:
            data = await websocket.receive_text()
            # Handle client ping
            try:
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
            except Exception:
                pass
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected.")
    finally:
        telemetry_task.cancel()
        events_task.cancel()
        attack_monitor.unregister_subscriber(queue)
