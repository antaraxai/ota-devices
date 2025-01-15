import os
import time
import subprocess
from urllib.parse import urlparse, urlunparse
from datetime import datetime
from supabase import create_client, Client

# Supabase configuration
SUPABASE_URL = "https://hdodriygzudamnqqbluy.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhkb2RyaXlnenVkYW1ucXFibHV5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyMzcxMTA2OCwiZXhwIjoyMDM5Mjg3MDY4fQ.yNnuOxXhJDSVrcG2X59lEVFdwiKgAOC1kHHL5EMrxsk"

# Device configuration - These will be replaced when downloading
DEVICE_ID = "DEVICE_ID"
DEVICE_TOKEN = "DEVICE_TOKEN"

class GitLabMonitor:
    def __init__(self):
        """Initialize the GitLab monitor with device configuration."""
        try:
            # Initialize Supabase client
            self.supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

            # Get device configuration from Supabase
            print("\nFetching device configuration...")
            result = self.supabase.table('devices').select('*').eq('id', DEVICE_ID).single().execute()
            
            # Check if we got any data
            if not result.data:
                raise Exception(f"Device not found: {DEVICE_ID}")

            # Extract device configuration
            device = result.data
            self.device_id = device.get('id')
            self.repo_url = device.get('repo_url')
            self.repo_branch = device.get('repo_branch', 'main')
            self.gitlab_token = device.get('github_token')
            self.gitlab_username = device.get('github_username')
            self.repo_path = device.get('repo_path', 'src/templates/index.html')
            self.check_interval = device.get('check_interval', 10)  # seconds between checks
            
            # Local path setup
            self.current_script_path = os.path.abspath(__file__)
            self.base_dir = os.path.dirname(self.current_script_path)
            self.clone_dir = os.path.join(self.base_dir, 'repo-clone')
            self.local_path = os.path.join(self.base_dir, self.repo_path)
            self.last_commit_file = os.path.join(self.base_dir, '.last_commit')
            
            print("Device configuration loaded from Supabase:")
            print(f"- Device ID: {self.device_id}")
            print(f"- Repository URL: {self.repo_url}")
            print(f"- Branch: {self.repo_branch}")
            print(f"- File path: {self.repo_path}")
            print(f"- Clone directory: {self.clone_dir}")
            print(f"- Local path: {self.local_path}")
            print(f"- Check interval: {self.check_interval} seconds")
            print(f"- Username: {self.gitlab_username}")
            print(f"- Token: {'[HIDDEN]' if self.gitlab_token else 'Not Set'}")

        except Exception as e:
            print(f"Error initializing device: {e}")
            self.update_device_status('ERROR', f"Initialization failed: {str(e)}")
            raise
        
    def get_or_create_device_id(self):
        """Get existing device ID from Supabase or create a new one."""
        try:
            # Try to find existing device by hostname
            result = self.supabase.table('devices').select('id').eq('hostname', socket.gethostname()).execute()
            devices = result.data
            
            if devices:
                # Device exists, return its ID
                return devices[0]['id']
            else:
                # Create new device
                new_device_id = str(uuid.uuid4())
                self.supabase.table('devices').insert({
                    'id': new_device_id,
                    'hostname': socket.gethostname(),
                    'status': 'INITIALIZING',
                    'created_at': datetime.utcnow().isoformat(),
                    'updated_at': datetime.utcnow().isoformat()
                }).execute()
                return new_device_id
                
        except Exception as e:
            print(f"Error getting/creating device ID: {e}")
            return None

    def update_device_status(self, status: str, details: str = None):
        """Update device status in Supabase."""
        try:
            # Always update status and timestamp
            update_data = {
                'status': status,
                'updated_at': datetime.utcnow().isoformat()
            }
                
            self.supabase.table('devices').update(update_data).eq('id', self.device_id).execute()
            print(f"Updated device status: {status} ({details if details else 'no details'})")
        except Exception as e:
            print(f"Error updating device status: {e}")

    def create_git_url_with_auth(self):
        """Create a Git URL with authentication embedded."""
        parsed = urlparse(self.repo_url)
        auth_url = parsed._replace(
            netloc=f"{self.gitlab_username}:{self.gitlab_token}@{parsed.netloc}"
        )
        return urlunparse(auth_url)

    def get_latest_commit_hash(self):
        """Get the latest commit hash for the target file."""
        try:
            auth_url = self.create_git_url_with_auth()
            
            # Use git ls-tree to get the latest commit hash for the specific file
            result = subprocess.run(
                ['git', 'ls-remote', auth_url, f'refs/heads/{self.repo_branch}'],
                capture_output=True,
                text=True
            )
            
            if result.returncode != 0:
                print(f"Error getting branch commit: {result.stderr}")
                return None

            # Get the branch commit hash
            branch_commit = result.stdout.split()[0]

            # Create a temporary directory for git operations
            temp_dir = os.path.join(self.base_dir, 'temp-git')
            if os.path.exists(temp_dir):
                subprocess.run(['rm', '-rf', temp_dir])
            os.makedirs(temp_dir)

            try:
                # Initialize git repo
                subprocess.run(['git', 'init'], cwd=temp_dir, capture_output=True)
                subprocess.run(['git', 'remote', 'add', 'origin', auth_url], cwd=temp_dir, capture_output=True)
                
                # Fetch the specific commit
                fetch_result = subprocess.run(
                    ['git', 'fetch', '--depth', '1', 'origin', branch_commit],
                    cwd=temp_dir,
                    capture_output=True,
                    text=True
                )
                
                if fetch_result.returncode != 0:
                    print(f"Error fetching commit: {fetch_result.stderr}")
                    return None

                # Get the commit hash for the specific file
                file_log = subprocess.run(
                    ['git', 'log', '-1', '--format=%H', branch_commit, '--', self.repo_path],
                    cwd=temp_dir,
                    capture_output=True,
                    text=True
                )

                if file_log.returncode == 0 and file_log.stdout:
                    return file_log.stdout.strip()
                else:
                    print(f"Error getting file commit: {file_log.stderr}")
                    return None

            finally:
                # Clean up
                subprocess.run(['rm', '-rf', temp_dir])
                
        except Exception as e:
            print(f"Error checking for updates: {e}")
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
                'updated_at': datetime.utcnow().isoformat(),
                'status': 'ONLINE'
            }).eq('id', self.device_id).execute()
        except Exception as e:
            print(f"Error saving commit hash: {e}")

    def download_single_file(self):
        """Download only the target file from the repository using sparse checkout."""
        try:
            auth_url = self.create_git_url_with_auth()
            
            print(f"\nDownloading file: {self.repo_path}")
            print(f"Clone directory: {self.clone_dir}")
            
            # Clean up existing directory
            if os.path.exists(self.clone_dir):
                print("Removing existing clone directory")
                subprocess.run(['rm', '-rf', self.clone_dir])
            os.makedirs(self.clone_dir)
            print("Created fresh clone directory")
            
            # Initialize git repo
            init_result = subprocess.run(['git', 'init'], cwd=self.clone_dir, capture_output=True, text=True)
            print("Git init output:", init_result.stdout, init_result.stderr)
            
            # Enable sparse checkout
            sparse_result = subprocess.run(['git', 'config', 'core.sparseCheckout', 'true'], 
                         cwd=self.clone_dir, capture_output=True, text=True)
            print("Sparse checkout config output:", sparse_result.stdout, sparse_result.stderr)
            
            # Set remote
            remote_result = subprocess.run(['git', 'remote', 'add', 'origin', auth_url], 
                         cwd=self.clone_dir, capture_output=True, text=True)
            print("Add remote output:", remote_result.stdout, remote_result.stderr)
            
            # Configure sparse checkout to only get our file
            sparse_file = os.path.join(self.clone_dir, '.git', 'info', 'sparse-checkout')
            os.makedirs(os.path.dirname(sparse_file), exist_ok=True)
            with open(sparse_file, 'w') as f:
                f.write(self.repo_path)
            print(f"Wrote sparse-checkout file with path: {self.repo_path}")
            
            print("\nFetching file...")
            
            # Fetch only the specific branch
            fetch_result = subprocess.run(
                ['git', 'fetch', '--depth', '1', 'origin', self.repo_branch],
                cwd=self.clone_dir,
                capture_output=True,
                text=True
            )
            print("Fetch output:", fetch_result.stdout, fetch_result.stderr)
            
            # Checkout the file
            checkout_result = subprocess.run(
                ['git', 'checkout', 'origin/' + self.repo_branch],
                cwd=self.clone_dir,
                capture_output=True,
                text=True
            )
            print("Checkout output:", checkout_result.stdout, checkout_result.stderr)
            
            # Verify file was downloaded
            file_path = os.path.join(self.clone_dir, self.repo_path)
            if os.path.exists(file_path):
                size = os.path.getsize(file_path)
                print(f"File downloaded successfully! Size: {size} bytes")
                print(f"File contents:")
                with open(file_path, 'r') as f:
                    print(f.read())
                
                # Show directory structure
                print("\nContents of clone directory:")
                for root, dirs, files in os.walk(os.path.join(self.clone_dir, os.path.dirname(self.repo_path))):
                    level = root.replace(self.clone_dir, '').count(os.sep)
                    indent = ' ' * 4 * level
                    print(f"{indent}{os.path.basename(root)}/")
                    subindent = ' ' * 4 * (level + 1)
                    for f in files:
                        size = os.path.getsize(os.path.join(root, f))
                        print(f"{subindent}{f} ({size} bytes)")
                
                return True
            else:
                print(f"File not found after checkout: {file_path}")
                print("Contents of clone directory:")
                subprocess.run(['ls', '-la', self.clone_dir], capture_output=True, text=True)
                return False
                
        except Exception as e:
            print(f"Error downloading file: {e}")
            return False

    def copy_file(self):
        """Copy the target file from clone to destination."""
        try:
            source_path = os.path.join(self.clone_dir, self.repo_path)
            print(f"\nCopying file from {source_path} to {self.local_path}")
            
            if not os.path.exists(source_path):
                print(f"Source file not found: {source_path}")
                return False
            
            # Create destination directory if it doesn't exist
            dest_dir = os.path.dirname(self.local_path)
            print(f"Creating destination directory: {dest_dir}")
            os.makedirs(dest_dir, exist_ok=True)
            
            # Copy the file
            copy_result = subprocess.run(['cp', source_path, self.local_path], capture_output=True, text=True)
            if copy_result.returncode == 0:
                print(f"File copied successfully to: {self.local_path}")
                print("New file contents:")
                with open(self.local_path, 'r') as f:
                    print(f.read())
                return True
            else:
                print(f"Error copying file: {copy_result.stderr}")
                return False
            
        except Exception as e:
            print(f"Error copying file: {e}")
            return False

    def check_and_update(self):
        """Check for updates and download if necessary."""
        try:
            print("\nChecking for updates...")
            latest_commit = self.get_latest_commit_hash()
            if not latest_commit:
                self.update_device_status('ERROR', 'Failed to get latest commit hash')
                return False

            last_commit = self.get_last_known_commit()
            
            if latest_commit != last_commit:
                print(f"\nNew commit detected: {latest_commit}")
                print("Downloading updated file...")
                
                self.update_device_status('UPDATING', 'Downloading updates')
                if self.download_single_file() and self.copy_file():
                    self.save_last_commit(latest_commit)
                    self.update_device_status('ONLINE', 'Update successful')
                    print("Update successful!")
                    return True
                else:
                    self.update_device_status('ERROR', 'Failed to download or copy file')
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
        print("\nStarting GitLab file monitor...")
        self.update_device_status('ONLINE', 'Monitor started')
        
        while True:
            self.check_and_update()
            time.sleep(self.check_interval)

def main():
    monitor = GitLabMonitor()
    monitor.monitor()

if __name__ == '__main__':
    main()
