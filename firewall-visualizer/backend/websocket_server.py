#!/usr/bin/env python3
import asyncio
import json
import logging
import websockets
import argparse
import signal
import time
from datetime import datetime
from typing import Dict, List, Set, Any
from firewall_parser import FirewallParser

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("websocket_server.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("websocket_server")

class FirewallWebSocketServer:
    """
    WebSocket server that provides real-time updates about firewall status,
    rules, and logs to connected clients.
    """
    
    def __init__(self, host: str = "localhost", port: int = 8765, config_path: str = None):
        """
        Initialize the WebSocket server.
        
        Args:
            host: Host address to bind to
            port: Port to listen on
            config_path: Path to configuration file for FirewallParser
        """
        self.host = host
        self.port = port
        self.clients: Set[websockets.WebSocketServerProtocol] = set()
        self.parser = FirewallParser(config_path)
        self.running = False
        self.last_status = None
        self.last_rules = None
        self.last_logs = []
        self.last_update_time = 0
        
        # Set up signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)
    
    def signal_handler(self, sig, frame):
        """Handle termination signals for graceful shutdown."""
        logger.info(f"Received signal {sig}, shutting down...")
        self.running = False
        asyncio.get_event_loop().stop()
    
    async def register(self, websocket: websockets.WebSocketServerProtocol):
        """Register a new client connection."""
        self.clients.add(websocket)
        logger.info(f"New client connected. Total clients: {len(self.clients)}")
        
        # Send initial data to the new client
        await self.send_initial_data(websocket)
    
    async def unregister(self, websocket: websockets.WebSocketServerProtocol):
        """Unregister a client connection."""
        self.clients.remove(websocket)
        logger.info(f"Client disconnected. Remaining clients: {len(self.clients)}")
    
    async def send_to_clients(self, message: Dict[str, Any]):
        """Send a message to all connected clients."""
        if not self.clients:
            return
        
        message_json = json.dumps(message)
        await asyncio.gather(
            *[client.send(message_json) for client in self.clients],
            return_exceptions=True
        )
    
    async def send_initial_data(self, websocket: websockets.WebSocketServerProtocol):
        """Send initial firewall data to a newly connected client."""
        try:
            # Send status
            status = self.parser.get_firewall_status()
            await websocket.send(json.dumps({
                "type": "status",
                "data": status
            }))
            
            # Send rules
            rules = self.parser.get_firewall_rules()
            await websocket.send(json.dumps({
                "type": "rules",
                "data": rules
            }))
            
            # Send logs
            logs = self.parser.get_firewall_logs(100)  # Send last 100 logs
            await websocket.send(json.dumps({
                "type": "logs",
                "data": logs
            }))
            
            logger.info(f"Sent initial data to client")
        except Exception as e:
            logger.error(f"Error sending initial data: {e}")
    
    async def handle_client_message(self, websocket: websockets.WebSocketServerProtocol, message: str):
        """Handle incoming messages from clients."""
        try:
            data = json.loads(message)
            command = data.get("command")
            
            if command == "toggle_rule":
                rule_id = data.get("ruleId")
                if rule_id:
                    success = self.parser.toggle_rule(rule_id)
                    await websocket.send(json.dumps({
                        "type": "command_result",
                        "command": "toggle_rule",
                        "success": success,
                        "ruleId": rule_id
                    }))
                    
                    # If successful, send updated rules to all clients
                    if success:
                        rules = self.parser.get_firewall_rules()
                        await self.send_to_clients({
                            "type": "rules",
                            "data": rules
                        })
            
            elif command == "delete_rule":
                rule_id = data.get("ruleId")
                if rule_id:
                    success = self.parser.delete_rule(rule_id)
                    await websocket.send(json.dumps({
                        "type": "command_result",
                        "command": "delete_rule",
                        "success": success,
                        "ruleId": rule_id
                    }))
                    
                    # If successful, send updated rules to all clients
                    if success:
                        rules = self.parser.get_firewall_rules()
                        await self.send_to_clients({
                            "type": "rules",
                            "data": rules
                        })
            
            elif command == "add_rule":
                rule = data.get("rule")
                if rule:
                    success = self.parser.add_rule(rule)
                    await websocket.send(json.dumps({
                        "type": "command_result",
                        "command": "add_rule",
                        "success": success
                    }))
                    
                    # If successful, send updated rules to all clients
                    if success:
                        rules = self.parser.get_firewall_rules()
                        await self.send_to_clients({
                            "type": "rules",
                            "data": rules
                        })
            
            elif command == "refresh":
                # Force refresh all data
                status = self.parser.get_firewall_status()
                rules = self.parser.get_firewall_rules()
                logs = self.parser.get_firewall_logs(100)
                
                await websocket.send(json.dumps({
                    "type": "status",
                    "data": status
                }))
                
                await websocket.send(json.dumps({
                    "type": "rules",
                    "data": rules
                }))
                
                await websocket.send(json.dumps({
                    "type": "logs",
                    "data": logs
                }))
        
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON received: {message}")
        except Exception as e:
            logger.error(f"Error handling client message: {e}")
    
    async def handle_connection(self, websocket: websockets.WebSocketServerProtocol, path: str):
        """Handle a client connection."""
        await self.register(websocket)
        try:
            async for message in websocket:
                await self.handle_client_message(websocket, message)
        except websockets.exceptions.ConnectionClosed:
            logger.info("Client connection closed")
        finally:
            await self.unregister(websocket)
    
    async def update_loop(self):
        """Periodically check for updates and send them to clients."""
        self.running = True
        while self.running:
            try:
                current_time = time.time()
                
                # Only check for updates if we have clients and enough time has passed
                if self.clients and (current_time - self.last_update_time) >= 5:  # Check every 5 seconds
                    self.last_update_time = current_time
                    
                    # Check for status changes
                    status = self.parser.get_firewall_status()
                    if status != self.last_status:
                        self.last_status = status
                        await self.send_to_clients({
                            "type": "status",
                            "data": status
                        })
                    
                    # Check for rule changes
                    rules = self.parser.get_firewall_rules()
                    if rules != self.last_rules:
                        self.last_rules = rules
                        await self.send_to_clients({
                            "type": "rules",
                            "data": rules
                        })
                    
                    # Check for new logs
                    logs = self.parser.get_firewall_logs(20)  # Get last 20 logs
                    
                    # Find new logs that weren't in the last batch
                    if logs and self.last_logs:
                        last_log_time = datetime.fromisoformat(self.last_logs[0]["timestamp"])
                        new_logs = []
                        
                        for log in logs:
                            log_time = datetime.fromisoformat(log["timestamp"])
                            if log_time > last_log_time:
                                new_logs.append(log)
                        
                        if new_logs:
                            self.last_logs = logs
                            await self.send_to_clients({
                                "type": "logs",
                                "data": new_logs
                            })
                    else:
                        self.last_logs = logs
                
                await asyncio.sleep(1)
            except Exception as e:
                logger.error(f"Error in update loop: {e}")
                await asyncio.sleep(5)  # Wait longer if there was an error
    
    async def start_server(self):
        """Start the WebSocket server."""
        server = await websockets.serve(
            self.handle_connection,
            self.host,
            self.port
        )
        
        logger.info(f"WebSocket server started on {self.host}:{self.port}")
        
        # Start the update loop
        asyncio.create_task(self.update_loop())
        
        # Keep the server running
        await server.wait_closed()

def main():
    """Main function to run the WebSocket server."""
    parser = argparse.ArgumentParser(description='Firewall WebSocket Server')
    parser.add_argument('--host', default='localhost', help='Host to bind to')
    parser.add_argument('--port', type=int, default=8765, help='Port to listen on')
    parser.add_argument('--config', help='Path to configuration file')
    args = parser.parse_args()
    
    server = FirewallWebSocketServer(args.host, args.port, args.config)
    
    # Start the server
    asyncio.run(server.start_server())

if __name__ == "__main__":
    main()