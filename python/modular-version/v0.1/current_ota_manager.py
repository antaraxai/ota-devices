# OTA Manager
from current_logger import Logger
import requests
import json
import os

class OTAManager:
    def __init__(self, logger: Logger):
        self.logger = logger
        self.server_url = "http://localhost:8000"  # Default server URL
        self.current_version = "1.0.0"
        self.logger.log("OTA Manager initialized")

    def check_for_updates(self):
        self.logger.log("Checking for updates...")
        try:
            response = requests.get(f"{self.server_url}/updates")
            if response.status_code == 200:
                updates = response.json()
                available_updates = {}
                for file, info in updates.items():
                    if self._is_update_needed(file, info.get('version', '0.0.0')):
                        available_updates[file] = True
                        self.logger.log(f"Update available for {file}")
                return available_updates
            else:
                self.logger.log(f"Failed to check updates. Status code: {response.status_code}")
                return {}
        except Exception as e:
            self.logger.log(f"Error checking for updates: {e}")
            return {}

    def _is_update_needed(self, file: str, server_version: str) -> bool:
        try:
            if not os.path.exists(file):
                return True
            current_version = self._get_file_version(file)
            return self._compare_versions(current_version, server_version) < 0
        except Exception as e:
            self.logger.log(f"Error comparing versions for {file}: {e}")
            return False

    def _get_file_version(self, file: str) -> str:
        try:
            with open(file, 'r') as f:
                content = f.read()
                # Look for version information in the file
                # This is a simple implementation and can be enhanced
                return "1.0.0"  # Default version
        except Exception:
            return "0.0.0"

    def _compare_versions(self, version1: str, version2: str) -> int:
        v1_parts = [int(x) for x in version1.split('.')]
        v2_parts = [int(x) for x in version2.split('.')]
        for i in range(max(len(v1_parts), len(v2_parts))):
            v1 = v1_parts[i] if i < len(v1_parts) else 0
            v2 = v2_parts[i] if i < len(v2_parts) else 0
            if v1 < v2:
                return -1
            elif v1 > v2:
                return 1
        return 0