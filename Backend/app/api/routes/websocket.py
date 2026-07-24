from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import logging
from app.utils.websocket_manager import WebSocketManager

logger = logging.getLogger(__name__)


router = APIRouter(tags=["websocket"])
ws_manager = WebSocketManager()


@router.websocket("/ws/{execution_id}")
async def websocket_endpoint(websocket: WebSocket, execution_id: str):
    """
    WebSocket endpoint for live execution updates
    Connect to this endpoint to receive real-time logs and status updates
    """
    logger.info(f"WebSocket connection attempt for execution: {execution_id}")
    await ws_manager.connect(websocket, execution_id)
    
    try:
        # Send initial connection message
        await ws_manager.send_message(execution_id, {
            "type": "status",
            "data": {
                "status": "connected",
                "message": f"Connected to execution {execution_id}"
            }
        })
        
        # Keep connection alive and handle incoming messages
        while True:
            # Wait for any messages from client (optional, for ping/pong)
            data = await websocket.receive_text()
            
            # Echo back if needed (for heartbeat)
            if data == "ping":
                await websocket.send_text("pong")
                logger.debug(f"[{execution_id}] Heartbeat ping/pong")
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for execution: {execution_id}")
        ws_manager.disconnect(websocket, execution_id)
    except Exception as e:
        logger.error(f"WebSocket error for execution {execution_id}: {str(e)}")
        ws_manager.disconnect(websocket, execution_id)
