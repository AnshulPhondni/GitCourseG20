#!/usr/bin/env python3
import os
import sys
import subprocess
import argparse
import logging
import json
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("setup")

def check_dependencies():
    """Check if required dependencies are installed."""
    logger.info("Checking dependencies...")
    
    # Check Python version
    python_version = sys.version_info
    if python_version.major < 3 or (python_version.major == 3 and python_version.minor < 7):
        logger.error("Python 3.7 or higher is required")
        return False
    
    # Check for required Python packages
    required_packages = ['websockets', 'asyncio']
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package)
        except ImportError:
            missing_packages.append(package)
    
    if missing_packages:
        logger.error(f"Missing Python packages: {', '.join(missing_packages)}")
        logger.info("Installing missing packages...")
        
        try:
            subprocess.run(
                [sys.executable, "-m", "pip", "install"] + missing_packages,
                check=True
            )
            logger.info("Packages installed successfully")
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to install packages: {e}")
            return False
    
    # Check for firewall tools
    firewall_tools = ['ufw', 'iptables']
    available_tools = []
    
    for tool in firewall_tools:
        try:
            result = subprocess.run(
                ["which", tool],
                capture_output=True,
                text=True,
                check=False
            )
            if result.returncode == 0:
                available_tools.append(tool)
        except Exception:
            pass
    
    if not available_tools:
        logger.warning("No supported firewall tools found (ufw, iptables)")
        logger.warning("The application may not work correctly without a supported firewall")
    else:
        logger.info(f"Found firewall tools: {', '.join(available_tools)}")
    
    return True

def create_config(config_path, host, api_port, ws_port):
    """Create a configuration file."""
    config = {
        "api_server": {
            "host": host,
            "port": api_port
        },
        "websocket_server": {
            "host": host,
            "port": ws_port
        },
        "log_paths": [
            "/var/log/ufw.log",
            "/var/log/syslog",
            "/var/log/kern.log"
        ],
        "max_logs": 1000,
        "refresh_interval": 5
    }
    
    try:
        with open(config_path, 'w') as f:
            json.dump(config, f, indent=2)
        logger.info(f"Configuration file created at {config_path}")
        return True
    except Exception as e:
        logger.error(f"Failed to create configuration file: {e}")
        return False

def create_systemd_service(service_path, install_dir):
    """Create systemd service files for the API and WebSocket servers."""
    api_service = f"""[Unit]
Description=Firewall Rule Visualizer API Server
After=network.target

[Service]
ExecStart={sys.executable} {install_dir}/api_server.py --config {install_dir}/config.json
WorkingDirectory={install_dir}
Restart=always
User=root

[Install]
WantedBy=multi-user.target
"""
    
    ws_service = f"""[Unit]
Description=Firewall Rule Visualizer WebSocket Server
After=network.target

[Service]
ExecStart={sys.executable} {install_dir}/websocket_server.py --config {install_dir}/config.json
WorkingDirectory={install_dir}
Restart=always
User=root

[Install]
WantedBy=multi-user.target
"""
    
    try:
        with open(f"{service_path}/firewall-visualizer-api.service", 'w') as f:
            f.write(api_service)
        
        with open(f"{service_path}/firewall-visualizer-ws.service", 'w') as f:
            f.write(ws_service)
        
        logger.info(f"Systemd service files created in {service_path}")
        return True
    except Exception as e:
        logger.error(f"Failed to create systemd service files: {e}")
        return False

def install_files(install_dir, current_dir):
    """Install the application files to the specified directory."""
    try:
        os.makedirs(install_dir, exist_ok=True)
        
        # Copy Python files
        for filename in ['firewall_parser.py', 'api_server.py', 'websocket_server.py']:
            src_path = os.path.join(current_dir, filename)
            dst_path = os.path.join(install_dir, filename)
            
            if os.path.exists(src_path):
                with open(src_path, 'r') as src_file:
                    content = src_file.read()
                
                with open(dst_path, 'w') as dst_file:
                    dst_file.write(content)
                
                # Make executable
                os.chmod(dst_path, 0o755)
            else:
                logger.error(f"Source file not found: {src_path}")
                return False
        
        logger.info(f"Files installed to {install_dir}")
        return True
    except Exception as e:
        logger.error(f"Failed to install files: {e}")
        return False

def main():
    """Main setup function."""
    parser = argparse.ArgumentParser(description='Firewall Rule Visualizer Setup')
    parser.add_argument('--install-dir', default='/opt/firewall-visualizer',
                        help='Installation directory')
    parser.add_argument('--host', default='0.0.0.0',
                        help='Host to bind servers to')
    parser.add_argument('--api-port', type=int, default=8080,
                        help='Port for the API server')
    parser.add_argument('--ws-port', type=int, default=8765,
                        help='Port for the WebSocket server')
    parser.add_argument('--systemd', action='store_true',
                        help='Create systemd service files')
    args = parser.parse_args()
    
    logger.info("Starting Firewall Rule Visualizer setup...")
    
    # Check dependencies
    if not check_dependencies():
        logger.error("Dependency check failed. Please install the required dependencies and try again.")
        return 1
    
    # Get the current directory
    current_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Install files
    if not install_files(args.install_dir, current_dir):
        logger.error("Failed to install files.")
        return 1
    
    # Create configuration
    config_path = os.path.join(args.install_dir, 'config.json')
    if not create_config(config_path, args.host, args.api_port, args.ws_port):
        logger.error("Failed to create configuration.")
        return 1
    
    # Create systemd service files if requested
    if args.systemd:
        service_path = '/etc/systemd/system'
        if not os.path.exists(service_path):
            logger.error(f"Systemd service directory not found: {service_path}")
            return 1
        
        if not create_systemd_service(service_path, args.install_dir):
            logger.error("Failed to create systemd service files.")
            return 1
        
        # Reload systemd
        try:
            subprocess.run(["systemctl", "daemon-reload"], check=True)
            logger.info("Systemd daemon reloaded")
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to reload systemd: {e}")
            return 1
        
        logger.info("To start the services, run:")
        logger.info("  sudo systemctl enable --now firewall-visualizer-api.service")
        logger.info("  sudo systemctl enable --now firewall-visualizer-ws.service")
    
    logger.info("Setup completed successfully!")
    logger.info(f"API server will run on http://{args.host}:{args.api_port}")
    logger.info(f"WebSocket server will run on ws://{args.host}:{args.ws_port}")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())