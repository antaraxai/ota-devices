import os
import subprocess
from urllib.parse import urlparse, urlunparse
from datetime import datetime
from current_logger import Logger

class GitLabOTAManager:
    def __init__(self, logger: Logger):
        self.logger = logger
        self.repo_url = None
        self.repo_branch = None
        self.gitlab_token = None
        self.gitlab_username = None
        self.repo_paths = ['src/templates/index.html', 'src/templates/style.css', 'src/templates/script.js']
        self.check_interval = 10  # seconds between checks
        self.base_dir = os.path.dirname(os.path.abspath(__file__))
        self.clone_dir = os.path.join(self.base_dir, 'repo-clone')
        self.last_commit_file = os.path.join(self.base_dir, '.last_commit')
        self.logger.log("GitLab OTA Manager initialized")

    def configure(self, repo_url: str, repo_branch: str, gitlab_token: str,
                gitlab_username: str, repo_paths: list = None, check_interval: int = 10):
        """Configure GitLab repository settings."""
        self.repo_url = repo_url
        self.repo_branch = repo_branch
        self.gitlab_token = gitlab_token
        self.gitlab_username = gitlab_username
        self.repo_paths = repo_paths or self.repo_paths
        self.check_interval = check_interval
        self.logger.log("GitLab OTA Manager configured")

    def create_git_url_with_auth(self):
        """Create a Git URL with authentication embedded."""
        try:
            if not self.repo_url or not self.gitlab_username or not self.gitlab_token:
                self.logger.log("Missing required credentials for Git URL")
                return None

            # Parse the URL and add token
            parsed = urlparse(self.repo_url)
            # Always use oauth2 token authentication
            if parsed.netloc == 'gitlab.com':
                # For gitlab.com, use oauth2 token in URL
                final_url = f"https://oauth2:{self.gitlab_token}@gitlab.com/{'/'.join(parsed.path.split('/')[1:])}"
            else:
                # For self-hosted GitLab, also use oauth2 token
                auth_netloc = f"oauth2:{self.gitlab_token}@{parsed.netloc}"
                auth_url = parsed._replace(netloc=auth_netloc)
                final_url = urlunparse(auth_url)
            self.logger.log(f"Created authenticated URL (credentials hidden)")
            return final_url

        except Exception as e:
            self.logger.log(f"Error creating authenticated URL: {e}")
            return None

    def get_latest_commit_hash(self):
        """Get the latest commit hash for the target file."""
        try:
            auth_url = self.create_git_url_with_auth()
            if not auth_url:
                self.logger.log("Failed to create authenticated URL")
                return None
            
            result = subprocess.run(
                ['git', 'ls-remote', auth_url, f'refs/heads/{self.repo_branch}'],
                capture_output=True,
                text=True
            )
            
            if result.returncode != 0:
                self.logger.log(f"Error getting branch commit: {result.stderr}")
                return None

            branch_commit = result.stdout.split()[0]
            temp_dir = os.path.join(self.base_dir, 'temp-git')
            if os.path.exists(temp_dir):
                subprocess.run(['rm', '-rf', temp_dir])
            os.makedirs(temp_dir)

            try:
                subprocess.run(['git', 'init'], cwd=temp_dir, capture_output=True)
                subprocess.run(['git', 'remote', 'add', 'origin', auth_url],
                             cwd=temp_dir, capture_output=True)
                
                fetch_result = subprocess.run(
                    ['git', 'fetch', '--depth', '1', 'origin', branch_commit],
                    cwd=temp_dir,
                    capture_output=True,
                    text=True
                )
                
                if fetch_result.returncode != 0:
                    self.logger.log(f"Error fetching commit: {fetch_result.stderr}")
                    return None

                # Get latest commit for all files
                file_log = subprocess.run(
                    ['git', 'log', '-1', '--format=%H', branch_commit, '--'] + self.repo_paths,
                    cwd=temp_dir,
                    capture_output=True,
                    text=True
                )

                if file_log.returncode == 0 and file_log.stdout:
                    return file_log.stdout.strip()
                else:
                    self.logger.log(f"Error getting file commit: {file_log.stderr}")
                    return None

            finally:
                subprocess.run(['rm', '-rf', temp_dir])
                
        except Exception as e:
            self.logger.log(f"Error checking for updates: {e}")
            return None

    def get_last_known_commit(self):
        """Get the last known commit hash from local file."""
        try:
            if os.path.exists(self.last_commit_file):
                with open(self.last_commit_file, 'r') as f:
                    return f.read().strip()
            return None
        except Exception as e:
            self.logger.log(f"Error reading last commit: {e}")
            return None

    def save_last_commit(self, commit_hash):
        """Save the latest commit hash to local file."""
        try:
            with open(self.last_commit_file, 'w') as f:
                f.write(commit_hash)
            self.logger.log(f"Saved last commit hash: {commit_hash}")
        except Exception as e:
            self.logger.log(f"Error saving commit hash: {e}")

    def check_for_updates(self) -> bool:
        """Check for updates in the GitLab repository."""
        try:
            if not all([self.repo_url, self.repo_branch, self.gitlab_token,
                       self.gitlab_username, self.repo_paths]):
                self.logger.log("GitLab configuration incomplete")
                return False

            latest_commit = self.get_latest_commit_hash()
            if not latest_commit:
                return False

            last_commit = self.get_last_known_commit()
            
            if latest_commit != last_commit:
                self.logger.log(f"New commit detected: {latest_commit}")
                return True
            else:
                self.logger.log("No updates found")
                return False
                
        except Exception as e:
            self.logger.log(f"Error checking for updates: {e}")
            return False