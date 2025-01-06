import os
import time
import datetime
import requests
import sys
import shutil
import subprocess
import json
from typing import Dict, Any, Tuple, List
from supabase import create_client, Client

# Enable immediate output flushing
sys.stdout.reconfigure(line_buffering=True)

# These values will be replaced when downloading the script
SUPABASE_URL = "your-supabase-url"
SUPABASE_KEY = "your-supabase-key"
DEVICE_ID = "your-device-id"

class FileTracker:
    def __init__(self, file_path: str, repo_path: str):
        self.file_path = file_path
        self.repo_path = repo_path
        self.last_commit_sha = None
        self.last_update_time = 0

class DeviceManager:
    def __init__(self):
        # Initialize state variables
        self.device_id = DEVICE_ID
        self.online = False
        self.retry_count = 0
        self.max_retries = 3
        self.retry_delay = 5
        self.current_script_path = os.path.abspath(__file__)
        self.backup_dir = os.path.join(os.path.dirname(self.current_script_path), 'backups')
        os.makedirs(self.backup_dir, exist_ok=True)
        
        self.update_check_interval = 30  # seconds
        self.last_update_check = 0
        self.monitored_files: Dict[str, FileTracker] = {}
        
        # GitHub configuration
        self.github_token = None
        self.repo_url = None
        self.repo_branch = None
        self.repo_path = None
        
        # Initialize Supabase client
        try:
            self.supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
            print("Successfully connected to Supabase")
        except Exception as e:
            print(f"Failed to connect to Supabase: {e}")
            self.supabase_client = None

    def get_last_commit_sha(self) -> str:
        """Get the last known commit SHA from Supabase."""
        try:
            result = self.supabase_client.table('devices').select('last_commit_sha').eq('id', self.device_id).execute()
            if result.data:
                sha = result.data[0].get('last_commit_sha')
                if sha:
                    return sha
                print("No previous SHA found in Supabase")
            return None
        except Exception as e:
            if 'column "last_commit_sha" does not exist' in str(e):
                print("Note: last_commit_sha column needs to be added to devices table")
            else:
                print(f"Error getting last commit SHA: {e}")
            return None

    def update_last_commit_sha(self, sha: str) -> None:
        """Update the last known commit SHA in Supabase."""
        try:
            self.supabase_client.table('devices').update({
                'last_commit_sha': sha,
                'github_status': 'Up to date'
            }).eq('id', self.device_id).execute()
        except Exception as e:
            if 'column "last_commit_sha" does not exist' in str(e):
                print("Note: Please add last_commit_sha column to devices table")
            else:
                print(f"Error updating last commit SHA: {e}")

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
            self.repo_branch = device_info.get('repo_branch', 'main')
            self.repo_path = device_info.get('repo_path')
            
            if not self.repo_path:
                print("No repo_path specified in device configuration")
                return False
            
            # Update monitored files
            self.monitored_files.clear()
            abs_file_path = os.path.join(os.path.dirname(self.current_script_path), self.repo_path)
            self.monitored_files[self.repo_path] = FileTracker(abs_file_path, self.repo_path)
            print(f"Added file to monitor: {self.repo_path}")
            
            print("Device configuration fetched successfully:")
            print(f"- Repository URL: {self.repo_url}")
            print(f"- Repository Branch: {self.repo_branch}")
            print(f"- Repository Path: {self.repo_path}")
            print(f"- GitHub Token: {'Set' if self.github_token else 'Not Set'}")
            print("- Monitored Files:")
            for file_path, tracker in self.monitored_files.items():
                print(f"  * {file_path}")
            
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

    def parse_github_url(self, url: str) -> Tuple[str, str]:
        """Parse GitHub URL to get owner and repo."""
        parts = url.rstrip('/').split('/')
        if len(parts) < 2:
            raise ValueError("Invalid GitHub URL format")
        owner = parts[-2]
        repo = parts[-1].replace('.git', '')
        return owner, repo

    def check_github_updates(self) -> Dict[str, bool]:
        """Check for updates on GitHub."""
        updates = {}
        
        if not self.github_token or not self.repo_url:
            print("GitHub token or repo URL not set")
            return updates

        try:
            # Parse repository URL
            owner, repo = self.parse_github_url(self.repo_url)
            
            # Add headers to prevent caching
            headers = {
                'Authorization': f'Bearer {self.github_token}',
                'Accept': 'application/vnd.github.v3+json',
                'Cache-Control': 'no-cache',
                'If-None-Match': '',  # Ignore any ETags
                'If-Modified-Since': ''  # Ignore last-modified
            }
            
            print(f"\nFetching latest commit from GitHub...")
            print(f"Repository: {owner}/{repo}")
            print(f"Branch: {self.repo_branch}")
            
            # Get latest commits
            commits_url = f'https://api.github.com/repos/{owner}/{repo}/commits'
            print(f"Commits API URL: {commits_url}")
            commits_response = requests.get(commits_url, headers=headers)
            if commits_response.status_code == 200:
                commits = commits_response.json()[:5]  # Get last 5 commits
                print("\nLast 5 commits:")
                for commit in commits:
                    sha = commit['sha']
                    message = commit.get('commit', {}).get('message', '')
                    date = commit.get('commit', {}).get('committer', {}).get('date', '')
                    print(f"- {sha[:8]}: {message} ({date})")
            
            # Get latest commit
            commit_url = f'https://api.github.com/repos/{owner}/{repo}/commits/{self.repo_branch}'
            print(f"API URL: {commit_url}")
            response = requests.get(commit_url, headers=headers)

            if response.status_code != 200:
                print(f"Failed to fetch GitHub updates: {response.status_code}")
                print(f"Response content: {response.text}")
                return updates

            latest_commit = response.json()
            latest_sha = latest_commit['sha']
            print(f"Latest commit SHA: {latest_sha}")
            
            # Get last known SHA
            last_known_sha = self.get_last_commit_sha()
            print(f"Last known SHA: {last_known_sha}")
            
            # Check each monitored file
            for file_path, tracker in self.monitored_files.items():
                if last_known_sha != latest_sha:
                    print(f"New commit detected for {file_path}")
                    updates[file_path] = True
                    self.update_last_commit_sha(latest_sha)
                else:
                    print(f"No updates for {file_path}")
                    updates[file_path] = False
            
            return updates
            
        except Exception as e:
            print(f"Error checking GitHub updates: {e}")
            return updates

    def download_github_file(self, file_path: str) -> bool:
        """Download a file from GitHub."""
        if not self.github_token or not self.repo_url:
            print("GitHub token or repo URL not set")
            return False

        try:
            # Parse repository URL
            owner, repo = self.parse_github_url(self.repo_url)
            
            # Create API URL for the file
            api_url = f'https://api.github.com/repos/{owner}/{repo}/contents/{file_path}?ref={self.repo_branch}'
            
            # Add headers
            headers = {
                'Authorization': f'Bearer {self.github_token}',
                'Accept': 'application/vnd.github.v3.raw'
            }
            
            # Download file
            print(f"Downloading {file_path} from GitHub...")
            response = requests.get(api_url, headers=headers)
            
            if response.status_code != 200:
                print(f"Failed to download file: {response.status_code}")
                print(f"Response content: {response.text}")
                return False
            
            # Get the absolute path for the file
            tracker = self.monitored_files.get(file_path)
            if not tracker:
                print(f"No tracker found for {file_path}")
                return False
            
            abs_file_path = tracker.file_path
            
            # Create backup of existing file
            if os.path.exists(abs_file_path):
                backup_path = os.path.join(
                    self.backup_dir,
                    f"{os.path.basename(abs_file_path)}.{int(time.time())}.bak"
                )
                shutil.copy2(abs_file_path, backup_path)
                print(f"Created backup at {backup_path}")
            
            # Save the new file
            os.makedirs(os.path.dirname(abs_file_path), exist_ok=True)
            with open(abs_file_path, 'wb') as f:
                f.write(response.content)
            
            print(f"Successfully downloaded {file_path}")
            return True
            
        except Exception as e:
            print(f"Error downloading file: {e}")
            return False

    def run(self):
        """Main run loop for the device manager."""
        print("\nStarting device manager...")
        
        # Initial connection and configuration
        if not self.fetch_device_config():
            print("Failed to fetch initial device configuration")
            return
        
        self.update_connection_status(True)
        print("\nDevice manager started successfully")
        
        try:
            while True:
                current_time = time.time()
                
                # Check for updates periodically
                if current_time - self.last_update_check >= self.update_check_interval:
                    print("\nChecking for updates...")
                    updates = self.check_github_updates()
                    
                    # Download updated files
                    for file_path, needs_update in updates.items():
                        if needs_update:
                            print(f"\nUpdating {file_path}...")
                            if self.download_github_file(file_path):
                                print(f"Successfully updated {file_path}")
                            else:
                                print(f"Failed to update {file_path}")
                    
                    self.last_update_check = current_time
                
                # Sleep for a bit
                time.sleep(1)
                
        except KeyboardInterrupt:
            print("\nShutting down device manager...")
            self.update_connection_status(False)
            print("Goodbye!")
        except Exception as e:
            print(f"\nUnexpected error: {e}")
            self.update_connection_status(False)

def main():
    """Main entry point."""
    manager = DeviceManager()
    manager.run()

if __name__ == "__main__":
    main()
