import os
import subprocess
from current_logger import Logger

class GitLabFileManager:
    def __init__(self, logger: Logger):
        self.logger = logger
        self.base_dir = os.path.dirname(os.path.abspath(__file__))
        self.clone_dir = os.path.join(self.base_dir, 'repo-clone')
        self.logger.log("GitLab File Manager initialized")

    def download_single_file(self, auth_url: str, repo_path: str, repo_branch: str) -> bool:
        """Download only the target file from the repository using sparse checkout."""
        try:
            self.logger.log(f"\nDownloading file: {repo_path}")
            self.logger.log(f"Clone directory: {self.clone_dir}")
            
            # Clean up existing directory
            if os.path.exists(self.clone_dir):
                self.logger.log("Removing existing clone directory")
                subprocess.run(['rm', '-rf', self.clone_dir])
            os.makedirs(self.clone_dir)
            self.logger.log("Created fresh clone directory")
            
            # Initialize git repo
            init_result = subprocess.run(['git', 'init'], cwd=self.clone_dir, capture_output=True, text=True)
            self.logger.log(f"Git init output: {init_result.stdout} {init_result.stderr}")
            
            # Enable sparse checkout
            sparse_result = subprocess.run(['git', 'config', 'core.sparseCheckout', 'true'], 
                         cwd=self.clone_dir, capture_output=True, text=True)
            self.logger.log(f"Sparse checkout config output: {sparse_result.stdout} {sparse_result.stderr}")
            
            # Set remote
            remote_result = subprocess.run(['git', 'remote', 'add', 'origin', auth_url], 
                         cwd=self.clone_dir, capture_output=True, text=True)
            self.logger.log(f"Add remote output: {remote_result.stdout} {remote_result.stderr}")
            
            # Configure sparse checkout to only get our file
            sparse_file = os.path.join(self.clone_dir, '.git', 'info', 'sparse-checkout')
            os.makedirs(os.path.dirname(sparse_file), exist_ok=True)
            with open(sparse_file, 'w') as f:
                f.write(repo_path)
            self.logger.log(f"Wrote sparse-checkout file with path: {repo_path}")
            
            self.logger.log("\nFetching file...")
            
            # Fetch only the specific branch
            fetch_result = subprocess.run(
                ['git', 'fetch', '--depth', '1', 'origin', repo_branch],
                cwd=self.clone_dir,
                capture_output=True,
                text=True
            )
            self.logger.log(f"Fetch output: {fetch_result.stdout} {fetch_result.stderr}")
            
            # Checkout the file
            checkout_result = subprocess.run(
                ['git', 'checkout', 'origin/' + repo_branch],
                cwd=self.clone_dir,
                capture_output=True,
                text=True
            )
            self.logger.log(f"Checkout output: {checkout_result.stdout} {checkout_result.stderr}")
            
            # Verify file was downloaded
            file_path = os.path.join(self.clone_dir, repo_path)
            if os.path.exists(file_path):
                size = os.path.getsize(file_path)
                self.logger.log(f"File downloaded successfully! Size: {size} bytes")
                return True
            else:
                self.logger.log(f"File not found after checkout: {file_path}")
                return False
                
        except Exception as e:
            self.logger.log(f"Error downloading file: {e}")
            return False

    def copy_file(self, source_path: str, dest_path: str) -> bool:
        """Copy the target file from clone to destination."""
        try:
            self.logger.log(f"\nCopying file from {source_path} to {dest_path}")
            
            if not os.path.exists(source_path):
                self.logger.log(f"Source file not found: {source_path}")
                return False
            
            # Create destination directory if it doesn't exist
            dest_dir = os.path.dirname(dest_path)
            self.logger.log(f"Creating destination directory: {dest_dir}")
            os.makedirs(dest_dir, exist_ok=True)
            
            # Copy the file
            copy_result = subprocess.run(['cp', source_path, dest_path], capture_output=True, text=True)
            if copy_result.returncode == 0:
                self.logger.log(f"File copied successfully to: {dest_path}")
                return True
            else:
                self.logger.log(f"Error copying file: {copy_result.stderr}")
                return False
            
        except Exception as e:
            self.logger.log(f"Error copying file: {e}")
            return False