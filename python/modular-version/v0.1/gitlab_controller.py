import os
import time
import signal
import sys
import json
import argparse
import threading
from current_logger import Logger
from gitlab_connection_manager import GitLabConnectionManager
from gitlab_ota_manager import GitLabOTAManager
from gitlab_file_manager import GitLabFileManager
import urllib.parse
import subprocess
import shutil
from urllib.parse import urlparse, urlunparse

class GitLabController:
    def __init__(self, supabase_url: str, supabase_key: str, device_id: str, device_token: str, work_dir: str):
        print("Initializing GitLab Controller...")
        self.logger = Logger()
        self.connection_manager = GitLabConnectionManager(self.logger)
        self.ota_manager = GitLabOTAManager(self.logger)
        self.file_manager = GitLabFileManager(self.logger)
        self.work_dir = work_dir
        
        # Configure connection manager
        print("Configuring connection manager...")
        if not self.connection_manager.configure(supabase_url, supabase_key, device_id, device_token):
            raise Exception("Failed to configure connection manager")
            
        # Add running flag for thread control
        self.running = True
        
        # Only register signals in main thread
        if threading.current_thread() is threading.main_thread():
            signal.signal(signal.SIGINT, self._signal_handler)
            signal.signal(signal.SIGTERM, self._signal_handler)
        
        print("GitLab Controller initialization complete")
        self.logger.log("GitLab Controller initialized")

    def _signal_handler(self, signum, frame):
        """Handle shutdown signals."""
        self.stop()

    def stop(self):
        """Stop the controller gracefully."""
        self.running = False
        self.logger.log("\nUpdating device status to OFFLINE before exiting...")
        self.connection_manager.update_device_status('OFFLINE')
        sys.exit(0)

    def _configure_components(self):
        """Configure OTA and File managers with device settings."""
        try:
            # Get device configuration
            config = self.connection_manager.get_device_config()
            if not config:
                return False

            # Get GitLab credentials from environment
            gitlab_username = os.getenv('GITLAB_USERNAME')
            gitlab_token = os.getenv('GITLAB_TOKEN')
            
            if not gitlab_username or not gitlab_token:
                self.logger.log("GitLab credentials not found in environment")
                return False

            # Configure OTA manager
            self.ota_manager.configure(
                repo_url=config.get('repo_url'),
                repo_branch=config.get('repo_branch', 'main'),
                gitlab_token=gitlab_token,
                gitlab_username=gitlab_username,
                repo_path=config.get('repo_path', 'src/templates/index.html'),
                check_interval=config.get('check_interval', 10)
            )
            return True

        except Exception as e:
            self.logger.log(f"Error configuring components: {e}")
            return False

    def clone_repository(self, workspace_path: str) -> bool:
        """Clone the repository to the specified workspace."""
        try:
            if not self.connection_manager.device_config:
                self.logger.log("Device configuration not available")
                return False

            repo_url = self.connection_manager.device_config.get('repo_url')
            if not repo_url:
                self.logger.log("Repository URL not found in device configuration")
                return False

            # Get GitLab credentials
            gitlab_username = os.getenv('GITLAB_USERNAME')
            gitlab_token = os.getenv('GITLAB_TOKEN')
            if not gitlab_username or not gitlab_token:
                self.logger.log("GitLab credentials not found in environment")
                return False

            # Parse and add credentials to URL
            parsed = urlparse(repo_url)
            auth_url = parsed._replace(
                netloc=f"{gitlab_username}:{gitlab_token}@{parsed.netloc}"
            )
            auth_repo_url = urlunparse(auth_url)

            # Clone the repository
            if os.path.exists(workspace_path):
                self.logger.log("Removing existing workspace")
                shutil.rmtree(workspace_path)

            os.makedirs(workspace_path)
            self.logger.log("Created fresh workspace")

            clone_cmd = ['git', 'clone', auth_repo_url, workspace_path]
            result = subprocess.run(clone_cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                self.logger.log("Repository cloned successfully")
                return True
            else:
                self.logger.log(f"Failed to clone repository: {result.stderr}")
                return False

        except Exception as e:
            self.logger.log(f"Error cloning repository: {e}")
            return False

    def _process_update(self):
        """Process file update from GitLab."""
        try:
            # Clone repository
            if not self.clone_repository(self.work_dir):
                return False

            # Get authenticated URL
            auth_url = self.ota_manager.create_git_url_with_auth()
            
            # Download file using sparse checkout
            if not self.file_manager.download_single_file(
                auth_url=auth_url,
                repo_path=self.ota_manager.repo_path,
                repo_branch=self.ota_manager.repo_branch,
                work_dir=self.work_dir
            ):
                return False

            # Copy file to destination
            source_path = os.path.join(self.work_dir, self.ota_manager.repo_path)
            dest_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), self.ota_manager.repo_path)
            
            if not self.file_manager.copy_file(source_path, dest_path):
                return False

            return True

        except Exception as e:
            self.logger.log(f"Error processing update: {e}")
            return False

    def run(self):
        """Main execution loop."""
        try:
            print("\nStarting GitLab Controller...")
            # Initial setup
            self.connection_manager.update_device_status('ONLINE', 'Monitor started')
            print("Configuring components...")
            if not self._configure_components():
                raise Exception("Failed to configure components")

            self.logger.log("\nStarting GitLab file monitor...")
            print("Entering main monitoring loop...\n")
            
            # Main monitoring loop
            while self.running:
                try:
                    # Check for updates
                    if self.ota_manager.check_for_updates():
                        self.logger.log("Processing update...")
                        self.connection_manager.update_device_status('UPDATING', 'Downloading updates')
                        
                        if self._process_update():
                            # Update was successful
                            latest_commit = self.ota_manager.get_latest_commit_hash()
                            self.ota_manager.save_last_commit(latest_commit)
                            self.connection_manager.update_commit_hash(latest_commit)
                            self.connection_manager.update_device_status('ONLINE', 'Update successful')
                        else:
                            # Update failed
                            self.connection_manager.update_device_status('ERROR', 'Failed to process update')
                    else:
                        # No updates needed
                        self.connection_manager.update_device_status('ONLINE', 'No updates needed')

                    # Wait before next check
                    time.sleep(self.ota_manager.check_interval)
                    
                except Exception as e:
                    self.logger.log(f"Error in monitoring loop: {e}")
                    self.connection_manager.update_device_status('ERROR', str(e))
                    time.sleep(self.ota_manager.check_interval)

        except Exception as e:
            self.logger.log(f"Error in controller: {e}")
            self.connection_manager.update_device_status('ERROR', str(e))
            raise

def main():
    """Main entry point with command line argument parsing."""
    try:
        parser = argparse.ArgumentParser(description='GitLab Controller')
        parser.add_argument('--device-id', required=True, help='Device ID')
        parser.add_argument('--config', required=True, help='JSON configuration string')
        args = parser.parse_args()

        # Parse config JSON
        try:
            config = json.loads(args.config)
        except json.JSONDecodeError as e:
            print(f"Error parsing config JSON: {e}", file=sys.stderr)
            sys.exit(1)

        # Validate required config fields
        required_fields = ['supabase_url', 'supabase_key', 'device_token', 'work_dir']
        missing_fields = [field for field in required_fields if field not in config]
        if missing_fields:
            print(f"Missing required config fields: {', '.join(missing_fields)}", file=sys.stderr)
            sys.exit(1)

        # Create and run controller
        controller = GitLabController(
            supabase_url=config['supabase_url'],
            supabase_key=config['supabase_key'],
            device_id=args.device_id,
            device_token=config['device_token'],
            work_dir=config['work_dir']
        )
        
        # Print process info for parent process
        print(json.dumps({
            'status': 'initialized',
            'pid': os.getpid()
        }))
        sys.stdout.flush()

        controller.run()

    except Exception as e:
        print(json.dumps({
            'error': str(e),
            'status': 'failed'
        }), file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()