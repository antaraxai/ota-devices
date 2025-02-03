import os
import time
import requests
from datetime import datetime
from supabase import create_client, Client

# Supabase configuration
SUPABASE_URL = "your-supabase-url"
SUPABASE_KEY = "your-supabase-key"
DEVICE_ID = "your-device-id"
DEVICE_TOKEN = "your-device-token"

# GitHub configuration
REPO_URL = "your-repo-url"
REPO_BRANCH = "your-repo-branch"
REPO_PATH = "your-repo-path"
GITHUB_TOKEN = "your-github-token"
GITHUB_USERNAME = "your-github-username"
API_URL = "your-api-url"

class GitHubMonitor:
    def __init__(self):
        # Initialize Supabase client
        self.supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        # GitHub configuration
        self.repo_url = REPO_URL.replace('https://github.com/', '')  # Extract owner/repo
        self.repo_branch = REPO_BRANCH
        self.repo_path = REPO_PATH
        self.github_token = GITHUB_TOKEN
        self.check_interval = 10  # seconds between checks
        
        # Local path setup
        self.current_script_path = os.path.abspath(__file__)
        self.base_dir = os.path.dirname(self.current_script_path)
        self.local_path = os.path.join(self.base_dir, os.path.basename(self.repo_path))
        self.last_commit_file = os.path.join(self.base_dir, '.last_commit')
        
        print("Configuration:")
        print(f"- Repository: {self.repo_url}")
        print(f"- Branch: {self.repo_branch}")
        print(f"- File path: {self.repo_path}")
        print(f"- Local path: {self.local_path}")
        print(f"- Check interval: {self.check_interval} seconds")

    def update_device_status(self, status: str, details: str = None):
        """Update device status in Supabase."""
        try:
            data = {
                'status': status,
                'updated_at': datetime.utcnow().isoformat(),
            }
            if details:
                data['github_status'] = details

            self.supabase.table('devices').update(data).eq('id', DEVICE_ID).execute()
        except Exception as e:
            print(f"Error updating device status: {e}")

    def get_github_headers(self):
        """Get headers for GitHub API requests."""
        return {
            'Authorization': f'token {self.github_token}',
            'Accept': 'application/vnd.github.v3+json'
        }

    def get_latest_commit_hash(self):
        """Get the latest commit hash for the target file."""
        try:
            # Get the latest commit for the file
            url = f'https://api.github.com/repos/{self.repo_url}/commits'
            params = {
                'path': self.repo_path,
                'sha': self.repo_branch,
                'per_page': 1
            }
            
            response = requests.get(url, headers=self.get_github_headers(), params=params)
            response.raise_for_status()
            
            commits = response.json()
            if commits:
                return commits[0]['sha']
            return None
            
        except Exception as e:
            print(f"Error getting latest commit: {e}")
            return None

    def get_last_known_commit(self):
        """Get the last known commit hash from local file."""
        try:
            if os.path.exists(self.last_commit_file):
                with open(self.last_commit_file, 'r') as f:
                    return f.read().strip()
            return None
        except Exception as e:
            print(f"Error reading last commit: {e}")
            return None

    def save_last_commit(self, commit_hash):
        """Save the latest commit hash to local file."""
        try:
            with open(self.last_commit_file, 'w') as f:
                f.write(commit_hash)
            
            # Update last commit in Supabase
            self.supabase.table('devices').update({
                'last_commit_sha': commit_hash,
                'updated_at': datetime.utcnow().isoformat()
            }).eq('id', DEVICE_ID).execute()
        except Exception as e:
            print(f"Error saving commit hash: {e}")

    def download_file(self):
        """Download the target file from GitHub."""
        try:
            # Get file content from GitHub
            url = f'https://api.github.com/repos/{self.repo_url}/contents/{self.repo_path}'
            params = {'ref': self.repo_branch}
            
            response = requests.get(url, headers=self.get_github_headers(), params=params)
            response.raise_for_status()
            
            content = response.json()
            if 'content' not in content:
                raise Exception('No content found in response')
            
            # Create directory if it doesn't exist
            os.makedirs(os.path.dirname(self.local_path), exist_ok=True)
            
            # Download and save file
            download_url = content['download_url']
            response = requests.get(download_url)
            response.raise_for_status()
            
            with open(self.local_path, 'wb') as f:
                f.write(response.content)
                
            return True
            
        except Exception as e:
            print(f"Error downloading file: {e}")
            return False

    def check_and_update(self):
        """Check for updates and download if necessary."""
        try:
            self.update_device_status('ONLINE', 'Checking for updates')
            latest_commit = self.get_latest_commit_hash()
            if not latest_commit:
                self.update_device_status('ERROR', 'Failed to get latest commit hash')
                return False

            last_commit = self.get_last_known_commit()
            
            if latest_commit != last_commit:
                print(f"\nNew commit detected: {latest_commit}")
                print("Downloading updated file...")
                
                self.update_device_status('UPDATING', 'Downloading updates')
                if self.download_file():
                    self.save_last_commit(latest_commit)
                    self.update_device_status('ONLINE', 'Update successful')
                    print("Update successful!")
                    return True
                else:
                    self.update_device_status('ERROR', 'Failed to download file')
                    print("Update failed!")
                    return False
            else:
                print("\nNo updates found.")
                self.update_device_status('ONLINE', 'No updates needed')
                return True
                
        except Exception as e:
            print(f"Error in check_and_update: {e}")
            self.update_device_status('ERROR', str(e))
            return False

    def monitor(self):
        """Continuously monitor for changes."""
        print("\nStarting GitHub file monitor...")
        self.update_device_status('ONLINE', 'Monitor started')
        
        while True:
            self.check_and_update()
            time.sleep(self.check_interval)

def main():
    monitor = GitHubMonitor()
    monitor.monitor()

if __name__ == '__main__':
    main()
