from current_logger import Logger
from datetime import datetime

class GitLabConnectionManager:
    def __init__(self, logger: Logger):
        self.logger = logger
        self.device_id = None
        self.device_token = None
        self.device_config = None
        self.logger.log("GitLab Connection Manager initialized")

    def configure(self, supabase_url: str, supabase_key: str, device_id: str, device_token: str):
        """Configure connection settings."""
        self.device_id = device_id
        self.device_token = device_token
        self.device_config = {
            'repo_url': 'https://gitlab.com/reka-dev/underground/antara',
            'repo_branch': 'main',
            'device_id': device_id,
            'device_token': device_token
        }
        return True

    def update_device_status(self, status: str, details: str = None) -> bool:
        """Update device status."""
        try:
            if not self.device_id:
                self.logger.log("Device ID not configured")
                return False

            self.logger.log(f"Device status: {status} ({details if details else 'no details'})")
            return True

        except Exception as e:
            self.logger.log(f"Error updating device status: {e}")
            return False

    def get_device_config(self):
        """Get device configuration."""
        try:
            if not self.device_id:
                self.logger.log("Device ID not configured")
                return None

            self.logger.log("Successfully retrieved device configuration")
            return self.device_config

        except Exception as e:
            self.logger.log(f"Error getting device configuration: {e}")
            return None

    def update_commit_hash(self, commit_hash: str) -> bool:
        """Update the last known commit hash."""
        try:
            if not self.device_id:
                self.logger.log("Device ID not configured")
                return False

            self.logger.log(f"Updated last commit hash: {commit_hash}")
            return True

        except Exception as e:
            self.logger.log(f"Error updating commit hash: {e}")
            return False