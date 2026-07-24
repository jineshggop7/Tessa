from fastapi import WebSocket
from typing import Dict, Set
from datetime import datetime
import json
import logging

logger = logging.getLogger(__name__)


class WebSocketManager:
    """Manager for WebSocket connections - Singleton Pattern"""
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(WebSocketManager, cls).__new__(cls)
            cls._instance.active_connections = {}
            cls._instance.message_buffer = {}  # Buffer for messages before connection
            logger.info("WebSocketManager singleton instance created")
        return cls._instance
    
    def __init__(self):
        # Store active connections: execution_id -> set of websockets
        if not hasattr(self, 'active_connections'):
            self.active_connections: Dict[str, Set[WebSocket]] = {}
            self.message_buffer: Dict[str, list] = {}  # execution_id -> list of messages
    
    async def connect(self, websocket: WebSocket, execution_id: str):
        """Accept and register a new WebSocket connection"""
        await websocket.accept()
        
        if execution_id not in self.active_connections:
            self.active_connections[execution_id] = set()
        
        self.active_connections[execution_id].add(websocket)
        logger.info(f"WebSocket connected for execution: {execution_id}, total connections: {len(self.active_connections[execution_id])}")
        
        # Send any buffered messages
        if execution_id in self.message_buffer and self.message_buffer[execution_id]:
            logger.info(f"Sending {len(self.message_buffer[execution_id])} buffered messages for {execution_id}")
            for buffered_message in self.message_buffer[execution_id]:
                try:
                    await websocket.send_text(json.dumps(buffered_message))
                except Exception as e:
                    logger.error(f"Error sending buffered message: {str(e)}")
            # Clear buffer after sending
            self.message_buffer[execution_id] = []
    
    def disconnect(self, websocket: WebSocket, execution_id: str):
        """Remove a WebSocket connection"""
        if execution_id in self.active_connections:
            self.active_connections[execution_id].discard(websocket)
            logger.info(f"WebSocket disconnected for execution: {execution_id}, remaining: {len(self.active_connections[execution_id])}")
            
            # Clean up empty sets
            if not self.active_connections[execution_id]:
                del self.active_connections[execution_id]
                logger.debug(f"Removed empty connection set for execution: {execution_id}")
                
                # Don't clean buffer immediately - keep it for potential reconnection
                # Buffer will be cleaned when execution completes or after timeout
    
    async def send_message(self, execution_id: str, message: dict):
        """Send message to all connected clients for an execution"""
        # Add timestamp if not present
        if "timestamp" not in message:
            message["timestamp"] = datetime.utcnow().isoformat()
        
        if execution_id not in self.active_connections or not self.active_connections[execution_id]:
            # No active connections - buffer the message
            if execution_id not in self.message_buffer:
                self.message_buffer[execution_id] = []
            
            self.message_buffer[execution_id].append(message)
            logger.debug(f"Buffered message for execution {execution_id} (no active connections). Buffer size: {len(self.message_buffer[execution_id])}")
            
            # Limit buffer size to prevent memory issues (keep last 100 messages)
            if len(self.message_buffer[execution_id]) > 100:
                self.message_buffer[execution_id] = self.message_buffer[execution_id][-100:]
            return
        
        # Convert to JSON
        message_json = json.dumps(message)
        logger.debug(f"[{execution_id}] Sending WebSocket message type: {message.get('type')} to {len(self.active_connections[execution_id])} clients")
        
        # Send to all connected clients
        disconnected = set()
        for websocket in self.active_connections[execution_id]:
            try:
                await websocket.send_text(message_json)
            except Exception as e:
                logger.warning(f"[{execution_id}] Failed to send message to WebSocket: {str(e)}")
                # Mark for removal if sending fails
                disconnected.add(websocket)
        
        # Remove disconnected clients
        for websocket in disconnected:
            self.disconnect(websocket, execution_id)
    
    async def broadcast(self, message: dict):
        """Broadcast message to all connected clients"""
        if "timestamp" not in message:
            message["timestamp"] = datetime.utcnow().isoformat()
        
        message_json = json.dumps(message)
        
        for execution_id in list(self.active_connections.keys()):
            disconnected = set()
            for websocket in self.active_connections[execution_id]:
                try:
                    await websocket.send_text(message_json)
                except Exception:
                    disconnected.add(websocket)
            
            for websocket in disconnected:
                self.disconnect(websocket, execution_id)
