import os
import time
import subprocess
from urllib.parse import urlparse, urlunparse
from datetime import datetime

class GitLabMonitor:
    def __init__(self):
        # Hardcoded values for testing
        self.gitlab_username = 'gitlab+deploy-token-6867370'
        self.gitlab_token = 'gldt-kcGncapSUAPx9BPW4cxC'
        self.repo_url = 'https://gitlab.com/reka-dev/underground/antara'
        self.repo_branch = 'main'
        self.repo_path = 'src/templates/index.html'
        self.check_interval = 10  # seconds between checks
        
        # Local path setup
        self.current_script_path = os.path.abspath(__file__)
        self.base_dir = os.path.dirname(self.current_script_path)
        self.clone_dir = os.path.join(self.base_dir, 'repo-clone')
        self.local_path = os.path.join(self.base_dir, self.repo_path)
        self.last_commit_file = os.path.join(self.base_dir, '.last_commit')
        
        print("Configuration:")
        print(f"- Repository URL: {self.repo_url}")
        print(f"- Branch: {self.repo_branch}")
        print(f"- File path: {self.repo_path}")
        print(f"- Clone directory: {self.clone_dir}")
        print(f"- Local path: {self.local_path}")
        print(f"- Check interval: {self.check_interval} seconds")
        print(f"- Username: {self.gitlab_username}")
        print(f"- Token: {'[HIDDEN]' if self.gitlab_token else 'Not Set'}")

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
            
            # Use git ls-remote to get the latest commit hash
            result = subprocess.run(
                ['git', 'ls-remote', auth_url, self.repo_branch],
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0 and result.stdout:
                # Extract commit hash from output
                commit_hash = result.stdout.split()[0]
                return commit_hash
            else:
                print(f"Error getting commit hash: {result.stderr}")
                return None
                
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
        except Exception as e:
            print(f"Error saving commit hash: {e}")

    def download_single_file(self):
        """Download only the target file from the repository using sparse checkout."""
        try:
            auth_url = self.create_git_url_with_auth()
            
            print(f"\nDownloading file: {self.repo_path}")
            
            # Clean up existing directory
            if os.path.exists(self.clone_dir):
                subprocess.run(['rm', '-rf', self.clone_dir])
            os.makedirs(self.clone_dir)
            
            # Initialize git repo
            subprocess.run(['git', 'init'], cwd=self.clone_dir, capture_output=True)
            
            # Enable sparse checkout
            subprocess.run(['git', 'config', 'core.sparseCheckout', 'true'], 
                         cwd=self.clone_dir, capture_output=True)
            
            # Set remote
            subprocess.run(['git', 'remote', 'add', 'origin', auth_url], 
                         cwd=self.clone_dir, capture_output=True)
            
            # Configure sparse checkout to only get our file
            sparse_file = os.path.join(self.clone_dir, '.git', 'info', 'sparse-checkout')
            os.makedirs(os.path.dirname(sparse_file), exist_ok=True)
            with open(sparse_file, 'w') as f:
                f.write(self.repo_path)
            
            print("\nFetching file...")
            
            # Fetch only the specific branch
            result = subprocess.run(
                ['git', 'fetch', '--depth', '1', 'origin', self.repo_branch],
                cwd=self.clone_dir,
                capture_output=True,
                text=True
            )
            
            if result.stderr:
                print("Fetch output:", result.stderr)
            
            # Checkout the file
            result = subprocess.run(
                ['git', 'checkout', 'origin/' + self.repo_branch],
                cwd=self.clone_dir,
                capture_output=True,
                text=True
            )
            
            if result.stderr:
                print("Checkout output:", result.stderr)
            
            # Verify file was downloaded
            file_path = os.path.join(self.clone_dir, self.repo_path)
            if os.path.exists(file_path):
                size = os.path.getsize(file_path)
                print(f"File downloaded successfully! Size: {size} bytes")
                
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
                return False
                
        except Exception as e:
            print(f"Error downloading file: {e}")
            return False

    def copy_file(self):
        """Copy the target file from clone to destination."""
        try:
            source_path = os.path.join(self.clone_dir, self.repo_path)
            
            if not os.path.exists(source_path):
                print(f"\nSource file not found: {source_path}")
                return False
            
            # Create destination directory if it doesn't exist
            os.makedirs(os.path.dirname(self.local_path), exist_ok=True)
            
            # Read source file
            with open(source_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # Write to destination
            with open(self.local_path, 'w', encoding='utf-8') as f:
                f.write(content)
                
            print(f"\nFile updated successfully!")
            print(f"Source: {source_path}")
            print(f"Destination: {self.local_path}")
            print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            
            return True
            
        except Exception as e:
            print(f"Error copying file: {e}")
            return False
        
        finally:
            # Clean up clone directory
            if os.path.exists(self.clone_dir):
                print(f"\nCleaning up clone directory: {self.clone_dir}")
                subprocess.run(['rm', '-rf', self.clone_dir])

    def check_and_update(self):
        """Check for updates and download if necessary."""
        try:
            latest_commit = self.get_latest_commit_hash()
            last_known_commit = self.get_last_known_commit()
            
            if not latest_commit:
                print("Could not get latest commit hash")
                return False
            
            if latest_commit != last_known_commit:
                print(f"\nChanges detected!")
                print(f"Previous commit: {last_known_commit or 'None'}")
                print(f"New commit: {latest_commit}")
                
                if self.download_single_file():
                    if self.copy_file():
                        self.save_last_commit(latest_commit)
                        return True
            else:
                print(f"\nNo changes detected at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
                
            return False
            
        except Exception as e:
            print(f"Error checking for updates: {e}")
            return False

    def monitor(self):
        """Continuously monitor for changes."""
        print("\nStarting file monitor...")
        print(f"Checking for changes every {self.check_interval} seconds")
        print("Press Ctrl+C to stop")
        
        try:
            while True:
                self.check_and_update()
                time.sleep(self.check_interval)
                
        except KeyboardInterrupt:
            print("\nMonitor stopped by user")
        except Exception as e:
            print(f"Monitor error: {e}")
        finally:
            # Clean up
            if os.path.exists(self.clone_dir):
                subprocess.run(['rm', '-rf', self.clone_dir])

def main():
    # Create monitor instance
    monitor = GitLabMonitor()
    
    # Start monitoring
    monitor.monitor()

if __name__ == '__main__':
    main()
