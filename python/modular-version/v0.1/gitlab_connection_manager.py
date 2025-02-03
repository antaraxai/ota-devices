from current_logger import Logger
from supabase import create_client, Client
from datetime import datetime

class GitLabConnectionManager:
    def __init__(self, logger: Logger):
        self.logger = logger
        self.supabase = None
        self.device_id = None
        self.device_token = None
        self.supabase_url = None
        self.supabase_key = None
        self.logger.log("GitLab Connection Manager initialized")

    def configure(self, supabase_url: str, supabase_key: str, device_id: str, device_token: str):
        """Configure Supabase connection settings."""
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.device_id = device_id
        self.device_token = device_token
        try:
            self.supabase = create_client(supabase_url, supabase_key)
            self.logger.log("Successfully connected to Supabase")
            return True
        except Exception as e:
            self.logger.log(f"Failed to connect to Supabase: {e}")
            return False

    def update_device_status(self, status: str, details: str = None) -> bool:
        """Update device status in Supabase."""
        try:
            if not self.supabase or not self.device_id:
                self.logger.log("Supabase client or device ID not configured")
                return False

            update_data = {
                'status': status,
                'updated_at': datetime.utcnow().isoformat()
            }
            if details:
                update_data['github_status'] = details

            self.supabase.table('devices').update(update_data).eq('id', self.device_id).execute()
            self.logger.log(f"Updated device status: {status} ({details if details else 'no details'})")
            return True

        except Exception as e:
            self.logger.log(f"Error updating device status: {e}")
            return False

    def get_device_config(self):
        """Get device configuration from Supabase."""
        try:
            if not self.supabase or not self.device_id:
                self.logger.log("Supabase client or device ID not configured")
                return None

            result = self.supabase.table('devices').select('*').eq('id', self.device_id).single().execute()
            if not result.data:
                self.logger.log(f"Device not found: {self.device_id}")
                return None

            self.logger.log("Successfully retrieved device configuration")
            return result.data

        except Exception as e:
            self.logger.log(f"Error getting device configuration: {e}")
            return None

    def update_commit_hash(self, commit_hash: str) -> bool:
        """Update the last known commit hash in Supabase."""
        try:
            if not self.supabase or not self.device_id:
                self.logger.log("Supabase client or device ID not configured")
                return False

            self.supabase.table('devices').update({
                'last_commit_sha': commit_hash,
                'updated_at': datetime.utcnow().isoformat(),
                'status': 'ONLINE'
            }).eq('id', self.device_id).execute()
            self.logger.log(f"Updated last commit hash: {commit_hash}")
            return True

        except Exception as e:
            self.logger.log(f"Error updating commit hash: {e}")
            return False