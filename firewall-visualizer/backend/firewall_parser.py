#!/usr/bin/env python3
import re
import json
import subprocess
import os
import time
import argparse
import logging
from datetime import datetime
from typing import Dict, List, Optional, Union, Any

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("firewall_parser.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("firewall_parser")

class FirewallParser:
    """
    A class to parse and process firewall rules and logs from Linux systems.
    Supports both UFW and iptables.
    """

    def __init__(self, config_path: str = None):
        """
        Initialize the FirewallParser with optional configuration.

        Args:
            config_path: Path to configuration file (optional)
        """
        self.config = self._load_config(config_path)
        self.firewall_type = self._detect_firewall_type()
        logger.info(f"Detected firewall type: {self.firewall_type}")

    def _load_config(self, config_path: Optional[str]) -> Dict[str, Any]:
        """Load configuration from file or use defaults."""
        default_config = {
            "log_paths": [
                "/var/log/ufw.log",
                "/var/log/syslog",
                "/var/log/kern.log"
            ],
            "max_logs": 1000,
            "refresh_interval": 5,
            "websocket_port": 8765
        }

        if not config_path or not os.path.exists(config_path):
            return default_config

        try:
            with open(config_path, 'r') as f:
                config = json.load(f)
                return {**default_config, **config}
        except Exception as e:
            logger.error(f"Error loading config: {e}")
            return default_config

    def _detect_firewall_type(self) -> str:
        """
        Detect which firewall is in use on the system.

        Returns:
            str: 'ufw', 'iptables', or 'unknown'
        """
        # Check for UFW
        try:
            result = subprocess.run(
                ["ufw", "status"],
                capture_output=True,
                text=True,
                check=False
            )
            if result.returncode == 0 and "Status: " in result.stdout:
                return "ufw"
        except FileNotFoundError:
            pass

        # Check for iptables
        try:
            result = subprocess.run(
                ["iptables", "-L"],
                capture_output=True,
                text=True,
                check=False
            )
            if result.returncode == 0:
                return "iptables"
        except FileNotFoundError:
            pass

        return "unknown"

    def get_firewall_status(self) -> Dict[str, Any]:
        """
        Get the current status of the firewall.

        Returns:
            Dict containing status information about the firewall
        """
        status = {
            "active": False,
            "type": self.firewall_type,
            "version": None,
            "defaultPolicy": None,
            "loggingEnabled": False
        }

        if self.firewall_type == "ufw":
            try:
                result = subprocess.run(
                    ["ufw", "status", "verbose"],
                    capture_output=True,
                    text=True,
                    check=False
                )

                if result.returncode == 0:
                    # Parse status
                    status_match = re.search(r"Status: (\w+)", result.stdout)
                    if status_match and status_match.group(1) == "active":
                        status["active"] = True

                    # Parse default policy
                    policy_match = re.search(r"Default: (\w+)", result.stdout)
                    if policy_match:
                        status["defaultPolicy"] = policy_match.group(1).lower()

                    # Parse logging
                    logging_match = re.search(r"Logging: (\w+)", result.stdout)
                    if logging_match and logging_match.group(1) != "off":
                        status["loggingEnabled"] = True

                    # Get version
                    version_result = subprocess.run(
                        ["ufw", "--version"],
                        capture_output=True,
                        text=True,
                        check=False
                    )
                    if version_result.returncode == 0:
                        version_match = re.search(r"ufw (\d+\.\d+\.\d+)", version_result.stdout)
                        if version_match:
                            status["version"] = version_match.group(1)
            except Exception as e:
                logger.error(f"Error getting UFW status: {e}")

        elif self.firewall_type == "iptables":
            try:
                result = subprocess.run(
                    ["iptables", "-L"],
                    capture_output=True,
                    text=True,
                    check=False
                )

                if result.returncode == 0:
                    chains = ["INPUT", "FORWARD", "OUTPUT"]
                    for chain in chains:
                        chain_match = re.search(rf"Chain {chain} .*policy (\w+)", result.stdout)
                        if chain_match:
                            status["active"] = True
                            if chain == "INPUT":
                                status["defaultPolicy"] = chain_match.group(1).lower()

                    if "LOG" in result.stdout:
                        status["loggingEnabled"] = True

                    version_result = subprocess.run(
                        ["iptables", "--version"],
                        capture_output=True,
                        text=True,
                        check=False
                    )
                    if version_result.returncode == 0:
                        version_match = re.search(r"v(\d+\.\d+\.\d+)", version_result.stdout)
                        if version_match:
                            status["version"] = version_match.group(1)
            except Exception as e:
                logger.error(f"Error getting iptables status: {e}")

        return status

    def get_firewall_rules(self) -> List[Dict[str, Any]]:
        """
        Get the current firewall rules.

        Returns:
            List of rule dictionaries
        """
        rules = []

        if self.firewall_type == "ufw":
            try:
                result = subprocess.run(
                    ["ufw", "status", "numbered"],
                    capture_output=True,
                    text=True,
                    check=False
                )

                if result.returncode == 0:
                    rule_pattern = r"\[\s*(\d+)\]\s+(ALLOW|DENY|LIMIT|REJECT)\s+(IN|OUT)\s+(\S+)(?:\s+(\S+))?(?:\s+from\s+(\S+))?(?:\s+to\s+(\S+))?(?:\s+port\s+(\S+))?"
                    for line in result.stdout.splitlines():
                        match = re.search(rule_pattern, line)
                        if match:
                            rule_id, action, direction, interface, protocol, source, dest, port = match.groups()
                            if action == "DENY" or action == "REJECT":
                                action = "BLOCK"
                            elif action == "LIMIT":
                                action = "ALLOW"
                            rule = {
                                "id": rule_id,
                                "action": action,
                                "sourceIP": source if source else "any",
                                "destinationIP": dest if dest else "any",
                                "port": port if port else "any",
                                "protocol": protocol if protocol else "any",
                                "priority": int(rule_id),
                                "enabled": True,
                                "description": f"UFW {direction.lower()} rule on {interface}"
                            }
                            rules.append(rule)
            except Exception as e:
                logger.error(f"Error getting UFW rules: {e}")

        elif self.firewall_type == "iptables":
            try:
                result = subprocess.run(
                    ["iptables-save"],
                    capture_output=True,
                    text=True,
                    check=False
                )

                if result.returncode == 0:
                    rule_id = 0
                    for line in result.stdout.splitlines():
                        if line.startswith("-A"):
                            rule_id += 1
                            parts = line.split()
                            action = "BLOCK"
                            source_ip = "any"
                            dest_ip = "any"
                            port = "any"
                            protocol = "any"

                            if "-j ACCEPT" in line:
                                action = "ALLOW"
                            src_idx = parts.index("-s") if "-s" in parts else -1
                            if src_idx != -1 and src_idx + 1 < len(parts):
                                source_ip = parts[src_idx + 1]
                            dst_idx = parts.index("-d") if "-d" in parts else -1
                            if dst_idx != -1 and dst_idx + 1 < len(parts):
                                dest_ip = parts[dst_idx + 1]
                            proto_idx = parts.index("-p") if "-p" in parts else -1
                            if proto_idx != -1 and proto_idx + 1 < len(parts):
                                protocol = parts[proto_idx + 1].upper()
                            dport_idx = parts.index("--dport") if "--dport" in parts else -1
                            if dport_idx != -1 and dport_idx + 1 < len(parts):
                                port = parts[dport_idx + 1]
                            rule = {
                                "id": str(rule_id),
                                "action": action,
                                "sourceIP": source_ip,
                                "destinationIP": dest_ip,
                                "port": port,
                                "protocol": protocol,
                                "priority": rule_id,
                                "enabled": True,
                                "description": f"iptables rule {rule_id}"
                            }
                            rules.append(rule)
            except Exception as e:
                logger.error(f"Error getting iptables rules: {e}")

        return rules

    def get_firewall_logs(self, max_logs: int = None) -> List[Dict[str, Any]]:
        """
        Parse firewall logs from system log files.

        Args:
            max_logs: Maximum number of logs to return

        Returns:
            List of log entry dictionaries
        """
        if max_logs is None:
            max_logs = self.config["max_logs"]

        logs = []
        log_paths = self.config["log_paths"]

        for log_path in log_paths:
            if not os.path.exists(log_path):
                continue

            try:
                result = subprocess.run(
                    ["tail", "-n", "1000", log_path],
                    capture_output=True,
                    text=True,
                    check=False
                )

                if result.returncode == 0:
                    log_content = result.stdout

                    if self.firewall_type == "ufw":
                        ufw_pattern = r"(\w+\s+\d+\s+\d+:\d+:\d+).*?UFW (\w+).*?IN=(\w+).*?SRC=(\S+).*?DST=(\S+).*?PROTO=(\w+)(?:.*?DPT=(\d+))?"
                        for match in re.finditer(ufw_pattern, log_content, re.MULTILINE):
                            timestamp_str, action, interface, src_ip, dst_ip, protocol, port = match.groups()
                            try:
                                timestamp = datetime.strptime(f"{datetime.now().year} {timestamp_str}", "%Y %b %d %H:%M:%S")
                                log_entry = {
                                    "timestamp": timestamp.isoformat(),
                                    "action": "ALLOW" if action == "ALLOW" else "BLOCK",
                                    "sourceIP": src_ip,
                                    "destinationIP": dst_ip,
                                    "port": port if port else None,
                                    "protocol": protocol,
                                    "interface": interface,
                                    "message": match.group(0)
                                }
                                logs.append(log_entry)
                            except Exception as e:
                                logger.error(f"Error parsing log timestamp: {e}")

                    elif self.firewall_type == "iptables":
                        iptables_pattern = r"(\w+\s+\d+\s+\d+:\d+:\d+).*?IN=(\w+).*?SRC=(\S+).*?DST=(\S+).*?PROTO=(\w+)(?:.*?DPT=(\d+))?.*?(\bACCEPT\b|\bDROP\b)"
                        for match in re.finditer(iptables_pattern, log_content, re.MULTILINE):
                            timestamp_str, interface, src_ip, dst_ip, protocol, port, action = match.groups()
                            try:
                                timestamp = datetime.strptime(f"{datetime.now().year} {timestamp_str}", "%Y %b %d %H:%M:%S")
                                log_entry = {
                                    "timestamp": timestamp.isoformat(),
                                    "action": "ALLOW" if action == "ACCEPT" else "BLOCK",
                                    "sourceIP": src_ip,
                                    "destinationIP": dst_ip,
                                    "port": port if port else None,
                                    "protocol": protocol,
                                    "interface": interface,
                                    "message": match.group(0)
                                }
                                logs.append(log_entry)
                            except Exception as e:
                                logger.error(f"Error parsing log timestamp: {e}")
            except Exception as e:
                logger.error(f"Error reading log file {log_path}: {e}")

        logs.sort(key=lambda x: x["timestamp"], reverse=True)
        return logs[:max_logs]

    def toggle_rule(self, rule_id: str) -> bool:
        """
        Enable or disable a firewall rule.

        Args:
            rule_id: ID of the rule to toggle

        Returns:
            bool: Success or failure
        """
        if self.firewall_type == "ufw":
            try:
                status_result = subprocess.run(
                    ["ufw", "status", "numbered"],
                    capture_output=True,
                    text=True,
                    check=False
                )

                if status_result.returncode != 0:
                    logger.error("Failed to get UFW status")
                    return False

                rule_pattern = rf"\[\s*{rule_id}\]\s+(ALLOW|DENY|LIMIT|REJECT)"
                match = re.search(rule_pattern, status_result.stdout)

                if not match:
                    logger.error(f"Rule {rule_id} not found")
                    return False

                delete_result = subprocess.run(
                    ["sudo", "ufw", "delete", rule_id],
                    capture_output=True,
                    text=True,
                    check=False
                )

                if delete_result.returncode != 0:
                    logger.error(f"Failed to delete rule {rule_id}")
                    return False

                logger.info(f"Successfully toggled rule {rule_id}")
                return True

            except Exception as e:
                logger.error(f"Error toggling UFW rule: {e}")
                return False

        elif self.firewall_type == "iptables":
            try:
                rules = self.get_firewall_rules()
                target_rule = None

                for rule in rules:
                    if rule["id"] == rule_id:
                        target_rule = rule
                        break

                if not target_rule:
                    logger.error(f"Rule {rule_id} not found")
                    return False

                chain = "INPUT"

                delete_result = subprocess.run(
                    ["sudo", "iptables", "-D", chain, rule_id],
                    capture_output=True,
                    text=True,
                    check=False
                )

                if delete_result.returncode != 0:
                    logger.error(f"Failed to delete iptables rule {rule_id}")
                    return False

                logger.info(f"Successfully toggled rule {rule_id}")
                return True

            except Exception as e:
                logger.error(f"Error toggling iptables rule: {e}")
                return False

        return False

    def delete_rule(self, rule_id: str) -> bool:
        """
        Delete a firewall rule.

        Args:
            rule_id: ID of the rule to delete

        Returns:
            bool: Success or failure
        """
        if self.firewall_type == "ufw":
            try:
                result = subprocess.run(
                    ["sudo", "ufw", "delete", rule_id],
                    capture_output=True,
                    text=True,
                    check=False
                )

                if result.returncode != 0:
                    logger.error(f"Failed to delete UFW rule {rule_id}")
                    return False

                logger.info(f"Successfully deleted rule {rule_id}")
                return True

            except Exception as e:
                logger.error(f"Error deleting UFW rule: {e}")
                return False

        elif self.firewall_type == "iptables":
            try:
                chain = "INPUT"

                result = subprocess.run(
                    ["sudo", "iptables", "-D", chain, rule_id],
                    capture_output=True,
                    text=True,
                    check=False
                )

                if result.returncode != 0:
                    logger.error(f"Failed to delete iptables rule {rule_id}")
                    return False

                save_result = subprocess.run(
                    ["sudo", "iptables-save"],
                    capture_output=True,
                    text=True,
                    check=False
                )

                if save_result.returncode != 0:
                    logger.warning("Failed to save iptables rules")

                logger.info(f"Successfully deleted rule {rule_id}")
                return True

            except Exception as e:
                logger.error(f"Error deleting iptables rule: {e}")
                return False

        return False

    def add_rule(self, rule: Dict[str, Any]) -> bool:
        """
        Add a new firewall rule.

        Args:
            rule: Dictionary containing rule details

        Returns:
            bool: Success or failure
        """
        if self.firewall_type == "ufw":
            try:
                cmd = ["sudo", "ufw"]

                if rule.get("action") == "ALLOW":
                    cmd.append("allow")
                else:
                    cmd.append("deny")

                if rule.get("port") and rule.get("port") != "any":
                    cmd.append(rule["port"])
                    if rule.get("protocol") and rule.get("protocol") != "any":
                        cmd.append("proto")
                        cmd.append(rule["protocol"].lower())

                if rule.get("sourceIP") and rule.get("sourceIP") != "any":
                    cmd.append("from")
                    cmd.append(rule["sourceIP"])

                if rule.get("destinationIP") and rule.get("destinationIP") != "any":
                    cmd.append("to")
                    cmd.append(rule["destinationIP"])

                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    check=False
                )

                if result.returncode != 0:
                    logger.error(f"Failed to add UFW rule: {result.stderr}")
                    return False

                logger.info("Successfully added new UFW rule")
                return True

            except Exception as e:
                logger.error(f"Error adding UFW rule: {e}")
                return False

        elif self.firewall_type == "iptables":
            try:
                cmd = ["sudo", "iptables", "-A", "INPUT"]

                if rule.get("sourceIP") and rule.get("sourceIP") != "any":
                    cmd.extend(["-s", rule["sourceIP"]])

                if rule.get("destinationIP") and rule.get("destinationIP") != "any":
                    cmd.extend(["-d", rule["destinationIP"]])

                if rule.get("protocol") and rule.get("protocol") != "any":
                    cmd.extend(["-p", rule["protocol"].lower()])

                if rule.get("port") and rule.get("port") != "any":
                    cmd.extend(["--dport", rule["port"]])

                if rule.get("action") == "ALLOW":
                    cmd.extend(["-j", "ACCEPT"])
                else:
                    cmd.extend(["-j", "DROP"])

                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    check=False
                )

                if result.returncode != 0:
                    logger.error(f"Failed to add iptables rule: {result.stderr}")
                    return False

                save_result = subprocess.run(
                    ["sudo", "iptables-save"],
                    capture_output=True,
                    text=True,
                    check=False
                )

                if save_result.returncode != 0:
                    logger.warning("Failed to save iptables rules")

                logger.info("Successfully added new iptables rule")
                return True

            except Exception as e:
                logger.error(f"Error adding iptables rule: {e}")
                return False

        return False

def main():
    """Main function to run the parser as a standalone script."""
    parser = argparse.ArgumentParser(description='Firewall Rule Parser')
    parser.add_argument('--config', help='Path to configuration file')
    parser.add_argument('--action', choices=['status', 'rules', 'logs'], default='status',
                        help='Action to perform')
    parser.add_argument('--output', help='Output file path (default: stdout)')
    args = parser.parse_args()

    fw_parser = FirewallParser(args.config)

    # Perform the requested action
    if args.action == 'status':
        result = fw_parser.get_firewall_status()
    elif args.action == 'rules':
        result = fw_parser.get_firewall_rules()
    elif args.action == 'logs':
        result = fw_parser.get_firewall_logs()

    # Output the result
    output_json = json.dumps(result, indent=2)
    if args.output:
        with open(args.output, 'w') as f:
            f.write(output_json)
    else:
        print(output_json)

if __name__ == "__main__":
    main()
