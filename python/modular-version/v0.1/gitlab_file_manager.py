import os
import subprocess
import shutil
from current_logger import Logger

class GitLabFileManager:
    def __init__(self, logger: Logger):
        self.logger = logger
        self.base_dir = os.path.dirname(os.path.abspath(__file__))
        self.clone_dir = os.path.join(self.base_dir, 'repo-clone')
        self.logger.log("GitLab File Manager initialized")

    def download_single_file(self, auth_url: str, repo_path: str, repo_branch: str, work_dir: str) -> bool:
        """Download only the target file from the repository using sparse checkout."""
        try:
            self.logger.log(f"\nDownloading file: {repo_path}")
            
            # Create a temporary directory for sparse checkout
            temp_dir = os.path.join(work_dir, '.temp-git')
            if os.path.exists(temp_dir):
                subprocess.run(['rm', '-rf', temp_dir])
            os.makedirs(temp_dir)

            try:
                # Initialize git repo
                subprocess.run(['git', 'init'], cwd=temp_dir, capture_output=True, check=True)
                subprocess.run(['git', 'remote', 'add', 'origin', auth_url],
                             cwd=temp_dir, capture_output=True, check=True)

                # Configure sparse checkout
                subprocess.run(['git', 'config', 'core.sparseCheckout', 'true'],
                             cwd=temp_dir, capture_output=True, check=True)

                # Set sparse checkout path
                sparse_checkout_file = os.path.join(temp_dir, '.git', 'info', 'sparse-checkout')
                os.makedirs(os.path.dirname(sparse_checkout_file), exist_ok=True)
                with open(sparse_checkout_file, 'w') as f:
                    f.write(repo_path)

                # Fetch and checkout file
                subprocess.run(['git', 'fetch', '--depth', '1', 'origin', repo_branch],
                             cwd=temp_dir, capture_output=True, check=True)
                subprocess.run(['git', 'checkout', 'FETCH_HEAD'],
                             cwd=temp_dir, capture_output=True, check=True)

                # Create parent directory if it doesn't exist
                dest_dir = os.path.join(work_dir, os.path.dirname(repo_path))
                os.makedirs(dest_dir, exist_ok=True)

                # Move file to destination
                source_path = os.path.join(temp_dir, repo_path)
                dest_path = os.path.join(work_dir, repo_path)
                shutil.move(source_path, dest_path)

                self.logger.log(f"Successfully downloaded {repo_path}")
                return True

            finally:
                # Clean up temporary directory
                if os.path.exists(temp_dir):
                    shutil.rmtree(temp_dir)

        except Exception as e:
            self.logger.log(f"Error downloading file {repo_path}: {e}")
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