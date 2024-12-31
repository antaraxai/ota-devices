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

# Only these base credentials are needed to connect to Supabase
SUPABASE_URL = "https://hdodriygzudamnqqbluy.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhkb2RyaXlnenVkYW1ucXFibHV5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyMzcxMTA2OCwiZXhwIjoyMDM5Mjg3MDY4fQ.yNnuOxXhJDSVrcG2X59lEVFdwiKgAOC1kHHL5EMrxsk"
DEVICE_ID = "2128b869-301a-4d10-95c3-a8c8759f5f75"

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
            commit_message = latest_commit.get('commit', {}).get('message', '')
            commit_date = latest_commit.get('commit', {}).get('committer', {}).get('date', '')
            print(f"\nLatest commit details:")
            print(f"SHA: {latest_sha}")
            print(f"Message: {commit_message}")
            print(f"Date: {commit_date}")

            # Check each monitored file
            for file_path, tracker in self.monitored_files.items():
                print(f"\nChecking {file_path}")
                last_sha = self.get_last_commit_sha()
                print(f"Last known SHA from Supabase: {last_sha}")
                print(f"Current GitHub SHA: {latest_sha}")
                
                # Always download and check content
                timestamp = int(time.time())  # Add timestamp to bypass cache
                # Get file content through GitHub API instead of raw URL
                api_url = f'https://api.github.com/repos/{owner}/{repo}/contents/{tracker.repo_path}?ref={self.repo_branch}&t={timestamp}'
                headers = {
                    'Authorization': f'Bearer {self.github_token}',
                    'Accept': 'application/vnd.github.v3+json',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
                print(f"\nFetching content from GitHub API...")
                print(f"URL: {api_url}")
                response = requests.get(api_url, headers=headers)
                
                if response.status_code != 200:
                    print(f"Failed to fetch file: {response.status_code}")
                    print(f"Response content: {response.text}")
                    continue
                
                try:
                    content_data = response.json()
                    import base64
                    github_content = base64.b64decode(content_data['content']).decode('utf-8')
                    
                    try:
                        with open(tracker.file_path, 'r', encoding='utf-8') as f:
                            local_content = f.read()
                        
                        # Normalize line endings
                        github_content = github_content.replace('\r\n', '\n')
                        local_content = local_content.replace('\r\n', '\n')
                        
                        print("\nLocal content:")
                        print("--------------")
                        print(local_content)
                        print("\nGitHub content:")
                        print("--------------")
                        print(github_content)
                        print("\nContent lengths:")
                        print(f"Local: {len(local_content)} characters")
                        print(f"GitHub: {len(github_content)} characters")
                        
                        if github_content != local_content:
                            print("\nContent is different!")
                            local_lines = local_content.splitlines()
                            github_lines = github_content.splitlines()
                            
                            if len(local_lines) != len(github_lines):
                                print(f"Different number of lines: Local ({len(local_lines)}) vs GitHub ({len(github_lines)})")
                            
                            for i, (local_line, github_line) in enumerate(zip(local_lines, github_lines)):
                                if local_line != github_line:
                                    print(f"\nDifference at line {i+1}:")
                                    print(f"Local:  {local_line}")
                                    print(f"GitHub: {github_line}")
                            
                            # Show any extra lines
                            if len(local_lines) < len(github_lines):
                                print("\nExtra lines in GitHub version:")
                                for i in range(len(local_lines), len(github_lines)):
                                    print(f"Line {i+1}: {github_lines[i]}")
                            elif len(local_lines) > len(github_lines):
                                print("\nExtra lines in local version:")
                                for i in range(len(github_lines), len(local_lines)):
                                    print(f"Line {i+1}: {local_lines[i]}")
                            
                            print("\nUpdating file with GitHub content...")
                            with open(tracker.file_path, 'w', encoding='utf-8') as f:
                                f.write(github_content)
                            self.update_last_commit_sha(latest_sha)
                            print("File updated successfully")
                        else:
                            print("Content is identical, no update needed")
                            
                    except Exception as e:
                        print(f"Error checking file content: {e}")
                        continue

                except Exception as e:
                    print(f"Error fetching file content: {e}")
                    continue

        except Exception as e:
            print(f"Error checking for updates: {e}")
            import traceback
            traceback.print_exc()
        
        return updates

    def check_for_updates(self):
        """Check if it's time to look for updates"""
        current_time = time.time()
        if current_time - self.last_update_check >= self.update_check_interval:
            print("Checking for updates...")
            updates = self.check_github_updates()
            for file_path, has_update in updates.items():
                if has_update:
                    owner, repo = self.parse_github_url(self.repo_url)
                    tracker = self.monitored_files[file_path]
                    self.perform_update(owner, repo, tracker, updates[file_path])
            self.last_update_check = current_time

def main():
    """Main execution function"""
    try:
        device_manager = DeviceManager()
        if not device_manager.fetch_device_config():
            print("Failed to fetch device configuration")
            sys.exit(1)
        while True:
            try:
                device_manager.update_connection_status(True)
                device_manager.check_for_updates()  # Check for updates periodically
                time.sleep(30)  # Main loop interval matches update check interval
                
            except Exception as e:
                print(f"Error in main loop: {e}")
                time.sleep(30)  # Wait before retrying
                
    except Exception as e:
        print(f"Error in main: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
