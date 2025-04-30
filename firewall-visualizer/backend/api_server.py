#!/usr/bin/env python3
import json
import logging
import argparse
from typing import Dict, List, Any, Optional
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from firewall_parser import FirewallParser

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("api_server.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("api_server")

class FirewallAPIHandler(BaseHTTPRequestHandler):
    """HTTP request handler for the Firewall API."""
    
    def __init__(self, *args, **kwargs):
        self.parser = FirewallParser()
        super().__init__(*args, **kwargs)
    
    def _set_headers(self, status_code: int = 200, content_type: str = 'application/json'):
        """Set response headers."""
        self.send_response(status_code)
        self.send_header('Content-type', content_type)
        self.send_header('Access-Control-Allow-Origin', '*')  # Allow CORS
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def _send_json_response(self, data: Any, status_code: int = 200):
        """Send a JSON response."""
        self._set_headers(status_code)
        self.wfile.write(json.dumps(data).encode())
    
    def do_OPTIONS(self):
        """Handle OPTIONS requests for CORS preflight."""
        self._set_headers()
    
    def do_GET(self):
        """Handle GET requests."""
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        
        try:
            if path == '/api/status':
                # Get firewall status
                status = self.parser.get_firewall_status()
                self._send_json_response(status)
            
            elif path == '/api/rules':
                # Get firewall rules
                rules = self.parser.get_firewall_rules()
                self._send_json_response(rules)
            
            elif path == '/api/logs':
                # Get firewall logs
                query = parse_qs(parsed_path.query)
                max_logs = int(query.get('max', ['100'])[0])
                logs = self.parser.get_firewall_logs(max_logs)
                self._send_json_response(logs)
            
            else:
                # Path not found
                self._send_json_response({"error": "Not found"}, 404)
        
        except Exception as e:
            logger.error(f"Error handling GET request: {e}")
            self._send_json_response({"error": str(e)}, 500)
    
    def do_POST(self):
        """Handle POST requests."""
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        
        try:
            data = json.loads(post_data.decode())
            parsed_path = urlparse(self.path)
            path = parsed_path.path
            
            if path == '/api/rules/toggle':
                # Toggle a rule
                rule_id = data.get('ruleId')
                if not rule_id:
                    self._send_json_response({"error": "Missing ruleId"}, 400)
                    return
                
                success = self.parser.toggle_rule(rule_id)
                self._send_json_response({"success": success})
            
            elif path == '/api/rules/delete':
                # Delete a rule
                rule_id = data.get('ruleId')
                if not rule_id:
                    self._send_json_response({"error": "Missing ruleId"}, 400)
                    return
                
                success = self.parser.delete_rule(rule_id)
                self._send_json_response({"success": success})
            
            elif path == '/api/rules/add':
                # Add a new rule
                rule = data.get('rule')
                if not rule:
                    self._send_json_response({"error": "Missing rule data"}, 400)
                    return
                
                success = self.parser.add_rule(rule)
                self._send_json_response({"success": success})
            
            else:
                # Path not found
                self._send_json_response({"error": "Not found"}, 404)
        
        except json.JSONDecodeError:
            self._send_json_response({"error": "Invalid JSON"}, 400)
        except Exception as e:
            logger.error(f"Error handling POST request: {e}")
            self._send_json_response({"error": str(e)}, 500)

def run_server(host: str = 'localhost', port: int = 8080):
    """Run the HTTP server."""
    server_address = (host, port)
    
    # Create a custom handler class with the parser
    handler_class = FirewallAPIHandler
    
    httpd = HTTPServer(server_address, handler_class)
    logger.info(f"Starting API server on {host}:{port}")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
    finally:
        httpd.server_close()
        logger.info("Server closed")

def main():
    """Main function to run the API server."""
    parser = argparse.ArgumentParser(description='Firewall API Server')
    parser.add_argument('--host', default='localhost', help='Host to bind to')
    parser.add_argument('--port', type=int, default=8080, help='Port to listen on')
    args = parser.parse_args()
    
    run_server(args.host, args.port)

if __name__ == "__main__":
    main()