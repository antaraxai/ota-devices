import os
import time
import datetime
import requests
import sys
import shutil
import subprocess
from typing import Dict, Any, Tuple
from supabase import create_client, Client

# Only these base credentials are needed to connect to Supabase
SUPABASE_URL = "{{SUPABASE_URL}}"
SUPABASE_KEY = "{{SUPABASE_KEY}}"
DEVICE_ID = "{{DEVICE_ID}}"

class DeviceManager:
    def __init__(self):
        # Initialize state variables
        self.device_id = DEVICE_ID
        self.online = False
        self.retry_count = 0
        self.max_retries = 3
        self.retry_delay = 5
        self.last_commit_sha = None
        self.current_script_path = os.path.abspath(__file__)
        
        # Device configuration (will be fetched from Supabase)
        self.github_token = None
        self.repo_url = None
        self.repo_path = None
        self.repo_branch = None
        
        # Initialize Supabase client
        try:
            if not all([SUPABASE_URL, SUPABASE_KEY, DEVICE_ID]):
                raise ValueError("Missing required configuration: SUPABASE_URL, SUPABASE_KEY, or DEVICE_ID")
                
            if "{{" in SUPABASE_URL or "}}" in SUPABASE_URL:
                raise ValueError("SUPABASE_URL has not been properly configured")
                
            self.supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
            print("Successfully connected to Supabase")
            
            # Create backup directory if it doesn't exist
            self.backup_dir = os.path.join(os.path.dirname(self.current_script_path), 'backups')
            os.makedirs(self.backup_dir, exist_ok=True)
            
            # Fetch device configuration from Supabase
            if not self.fetch_device_config():
                raise ValueError("Failed to fetch device configuration from Supabase")
                
        except Exception as e:
            print(f"Failed to initialize Supabase client: {e}")
            raise

    def fetch_device_config(self) -> bool:
        """Fetch device configuration from Supabase"""
        try:
            print(f"Fetching configuration for device {self.device_id}...")
            result = self.supabase_client.table('devices').select('*').eq('id', self.device_id).execute()
            
            if not result.data:
                print(f"No device found with ID {self.device_id}")
                return False
            
            device_info = result.data[0]
            
            # Update device configuration
            self.github_token = device_info.get('github_token')
            self.repo_url = device_info.get('repo_url')
            self.repo_path = device_info.get('repo_path')
            self.repo_branch = device_info.get('repo_branch', 'main')
            
            # Check if an update has been requested by the user
            if device_info.get('github_status') == 'updating':
                print("Update requested from dashboard")
                repo_parts = self.repo_url.split('/')
                if len(repo_parts) >= 2:
                    owner = repo_parts[-2]
                    repo = repo_parts[-1]
                    if self.last_commit_sha:
                        self.perform_update(owner, repo, self.repo_path, self.last_commit_sha)
                    else:
                        print("No update available - checking for updates first")
                        self.check_github_updates()
            
            print("Device configuration fetched successfully:")
            print(f"- Repository URL: {self.repo_url}")
            print(f"- Repository Path: {self.repo_path}")
            print(f"- Repository Branch: {self.repo_branch}")
            print(f"- GitHub Token: {'Set' if self.github_token else 'Not Set'}")
            
            return True
            
        except Exception as e:
            print(f"Error fetching device configuration: {e}")
            return False

    def update_connection_status(self, status: bool) -> bool:
        """Update device online status in Supabase"""
        try:
            device_data = {
                'status': 'online' if status else 'offline',  
                'updated_at': datetime.datetime.now().isoformat()
            }
            
            self.supabase_client.table('devices').update(device_data).eq('id', self.device_id).execute()
            self.online = status
            return True
            
        except Exception as e:
            print(f"Failed to update connection status: {e}")
            return False

    def update_github_status(self, status: str) -> bool:
        """Update GitHub status in Supabase"""
        try:
            device_data = {
                'github_status': status,
                'updated_at': datetime.datetime.now().isoformat()
            }
            self.supabase_client.table('devices').update(device_data).eq('id', self.device_id).execute()
            return True
        except Exception as e:
            print(f"Failed to update GitHub status: {e}")
            return False

    def download_update(self, owner: str, repo: str, path: str, sha: str) -> Tuple[bool, str]:
        """Download the updated script from GitHub"""
        try:
            # Get the file content from GitHub
            headers = {'Authorization': f'token {self.github_token}'}
            url = f'https://api.github.com/repos/{owner}/{repo}/contents/{path}'
            params = {'ref': sha}
            
            response = requests.get(url, headers=headers, params=params)
            if response.status_code != 200:
                return False, f"Failed to download update: {response.status_code}"
            
            content = response.json()
            if 'content' not in content:
                return False, "No content found in response"
            
            # Decode content (it's base64 encoded)
            import base64
            script_content = base64.b64decode(content['content']).decode('utf-8')
            
            # Create backup of current script
            timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
            backup_path = os.path.join(self.backup_dir, f'device_script_backup_{timestamp}.py')
            shutil.copy2(self.current_script_path, backup_path)
            print(f"Created backup at: {backup_path}")
            
            # Write new content to a temporary file
            temp_path = f"{self.current_script_path}.new"
            with open(temp_path, 'w') as f:
                f.write(script_content)
            
            # Replace current script with new version
            os.replace(temp_path, self.current_script_path)
            print("Successfully updated script")
            return True, backup_path
            
        except Exception as e:
            return False, str(e)

    def restart_script(self):
        """Restart the current script"""
        try:
            print("Restarting script...")
            self.update_connection_status(False)  # Set status to offline before restart
            python = sys.executable
            os.execl(python, python, self.current_script_path)
        except Exception as e:
            print(f"Failed to restart script: {e}")

    def perform_update(self, owner: str, repo: str, path: str, sha: str) -> bool:
        """Perform the update process"""
        try:
            # Update status to in progress
            self.update_github_status('Update In Progress')
            
            # Download and install update
            success, message = self.download_update(owner, repo, path, sha)
            if not success:
                print(f"Update failed: {message}")
                self.update_github_status('Update Failed')
                return False
            
            print("Update downloaded successfully, restarting...")
            self.update_github_status('Up to Date')
            self.restart_script()
            return True
            
        except Exception as e:
            print(f"Error during update: {e}")
            self.update_github_status('Update Failed')
            return False

    def check_github_updates(self):
        """Check for updates in the GitHub repository"""
        try:
            if not all([self.github_token, self.repo_url, self.repo_path]):
                print("Missing GitHub configuration")
                return

            # Extract owner and repo from repo_url (format: https://github.com/owner/repo)
            repo_parts = self.repo_url.split('/')
            if len(repo_parts) < 2:
                print("Invalid repo URL format")
                return
                
            owner = repo_parts[-2]
            repo = repo_parts[-1]

            # Get the latest commit
            headers = {'Authorization': f'token {self.github_token}'}
            url = f'https://api.github.com/repos/{owner}/{repo}/commits'
            params = {'sha': self.repo_branch, 'path': self.repo_path}
            
            response = requests.get(url, headers=headers, params=params)
            
            if response.status_code == 200:
                latest_commit = response.json()[0]
                latest_sha = latest_commit['sha']
                
                if self.last_commit_sha is None:
                    self.last_commit_sha = latest_sha
                    print("Initial GitHub commit SHA stored")
                    self.update_github_status('Up to Date')
                elif self.last_commit_sha != latest_sha:
                    print("New update available!")
                    self.last_commit_sha = latest_sha
                    self.update_github_status('Update Available')
                else:
                    print("No updates available")
                    self.update_github_status('Up to Date')
            else:
                print(f"Failed to check for updates: {response.status_code}")
                self.update_github_status('Error')
                
        except Exception as e:
            print(f"Error checking for updates: {e}")
            self.update_github_status('Error')

    def start(self):
        """Start the device manager"""
        try:
            # First, establish connection and update status
            if not self.update_connection_status(True):
                print("Failed to establish connection")
                return False

            print("Successfully connected to dashboard")
            
            # Then start the main loop
            while True:
                try:
                    # Refresh device configuration
                    self.fetch_device_config()
                    
                    # Check for GitHub updates
                    self.check_github_updates()
                    
                    # Sleep for a minute before next check
                    time.sleep(60)
                    
                except KeyboardInterrupt:
                    print("\nShutting down...")
                    self.update_connection_status(False)
                    break
                except Exception as e:
                    print(f"Error in main loop: {e}")
                    time.sleep(5)  # Wait before retrying
                    
        except Exception as e:
            print(f"Error starting device manager: {e}")
            return False
            
        return True

def main():
    """Main execution function"""
    try:
        device_manager = DeviceManager()
        if not device_manager.start():
            sys.exit(1)
    except Exception as e:
        print(f"Error in main: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
