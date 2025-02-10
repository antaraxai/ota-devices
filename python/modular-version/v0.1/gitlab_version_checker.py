"""GitLab Version Checker for monitoring and updating file changes."""

import os
import hashlib
import json
import time
import subprocess
import requests
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class GitLabVersionChecker:
    def __init__(self):
        self.base_dir = os.path.dirname(os.path.abspath(__file__))
        self.tracked_files = [
            'gitlab_connection_manager.py',
            'gitlab_ota_manager.py',
            'gitlab_file_manager.py',
            'gitlab_controller.py'
        ]
        self.version_file = os.path.join(self.base_dir, 'gitlab_versions.json')
        self.backup_dir = os.path.join(self.base_dir, 'backups')
        self.file_versions: Dict[str, Dict] = self._load_versions()
        
        # GitLab configuration
        self.gitlab_token = os.getenv('GITLAB_TOKEN')
        self.gitlab_project_id = os.getenv('GITLAB_PROJECT_ID')
        self.gitlab_branch = os.getenv('GITLAB_BRANCH', 'main')
        
        # Ensure backup directory exists
        os.makedirs(self.backup_dir, exist_ok=True)

    def _load_versions(self) -> Dict:
        """Load existing version information from JSON file."""
        if os.path.exists(self.version_file):
            with open(self.version_file, 'r') as f:
                return json.load(f)
        return {}

    def _save_versions(self):
        """Save version information to JSON file."""
        with open(self.version_file, 'w') as f:
            json.dump(self.file_versions, f, indent=4)

    def _calculate_file_hash(self, filepath: str) -> Optional[str]:
        """Calculate SHA-256 hash of file content."""
        try:
            with open(filepath, 'rb') as f:
                return hashlib.sha256(f.read()).hexdigest()
        except Exception as e:
            print(f"Error calculating hash for {filepath}: {e}")
            return None

    def _get_file_info(self, filepath: str) -> Dict:
        """Get file information including size and modification time."""
        stats = os.stat(filepath)
        return {
            'size': stats.st_size,
            'modified_time': datetime.fromtimestamp(stats.st_mtime).isoformat(),
            'hash': self._calculate_file_hash(filepath)
        }

    def _get_gitlab_file_content(self, filepath: str) -> Tuple[Optional[str], Optional[str]]:
        """Get file content and commit SHA from GitLab."""
        if not self.gitlab_token or not self.gitlab_project_id:
            print("GitLab configuration missing. Please set GITLAB_TOKEN and GITLAB_PROJECT_ID")
            return None, None

        relative_path = os.path.relpath(filepath, self.base_dir)
        url = f"https://gitlab.com/api/v4/projects/{self.gitlab_project_id}/repository/files/{relative_path}/raw"
        headers = {'PRIVATE-TOKEN': self.gitlab_token}
        params = {'ref': self.gitlab_branch}

        try:
            response = requests.get(url, headers=headers, params=params)
            response.raise_for_status()
            
            # Get the latest commit SHA for this file
            commit_url = f"https://gitlab.com/api/v4/projects/{self.gitlab_project_id}/repository/commits"
            commit_params = {'path': relative_path, 'ref_name': self.gitlab_branch}
            commit_response = requests.get(commit_url, headers=headers, params=commit_params)
            commit_response.raise_for_status()
            commit_sha = commit_response.json()[0]['id'] if commit_response.json() else None
            
            return response.text, commit_sha
        except Exception as e:
            print(f"Error fetching file from GitLab: {e}")
            return None, None

    def _backup_file(self, filepath: str) -> str:
        """Create a backup of the file."""
        filename = os.path.basename(filepath)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_path = os.path.join(self.backup_dir, f"{filename}.{timestamp}.bak")
        
        try:
            with open(filepath, 'rb') as src, open(backup_path, 'wb') as dst:
                dst.write(src.read())
            return backup_path
        except Exception as e:
            print(f"Error creating backup: {e}")
            return ""

    def check_versions(self) -> List[Dict]:
        """Check versions of all tracked files and update if needed."""
        changes = []
        
        for filename in self.tracked_files:
            filepath = os.path.join(self.base_dir, filename)
            if not os.path.exists(filepath):
                print(f"Warning: {filename} not found")
                continue

            current_info = self._get_file_info(filepath)
            gitlab_content, gitlab_sha = self._get_gitlab_file_content(filepath)
            
            if gitlab_content is None:
                continue
                
            gitlab_hash = hashlib.sha256(gitlab_content.encode()).hexdigest()
            
            if filename not in self.file_versions:
                self.file_versions[filename] = current_info
                changes.append({
                    'file': filename,
                    'type': 'new',
                    'info': current_info,
                    'gitlab_sha': gitlab_sha
                })
            elif gitlab_hash != current_info['hash']:
                # Create backup before updating
                backup_path = self._backup_file(filepath)
                
                # Update the file
                try:
                    with open(filepath, 'w') as f:
                        f.write(gitlab_content)
                    
                    new_info = self._get_file_info(filepath)
                    changes.append({
                        'file': filename,
                        'type': 'updated',
                        'old_info': current_info,
                        'new_info': new_info,
                        'gitlab_sha': gitlab_sha,
                        'backup_path': backup_path
                    })
                    self.file_versions[filename] = new_info
                except Exception as e:
                    print(f"Error updating {filename}: {e}")

        if changes:
            self._save_versions()
        
        return changes

    def print_status(self):
        """Print current status of all tracked files."""
        print("\nGitLab Files Version Status:")
        print("-" * 50)
        
        for filename in self.tracked_files:
            filepath = os.path.join(self.base_dir, filename)
            if not os.path.exists(filepath):
                print(f"{filename}: NOT FOUND")
                continue
                
            info = self.file_versions.get(filename, self._get_file_info(filepath))
            print(f"\n{filename}:")
            print(f"  Size: {info['size']} bytes")
            print(f"  Last Modified: {info['modified_time']}")
            print(f"  Hash: {info['hash'][:8]}...")

def monitor_files(interval: int = 60):
    """Monitor files for changes and update from GitLab at specified interval."""
    checker = GitLabVersionChecker()
    print("Starting GitLab files version monitoring and auto-update...")
    
    while True:
        print("\nChecking for updates...")
        changes = checker.check_versions()
        if changes:
            print("\nChanges detected and processed:")
            for change in changes:
                print(f"\nFile: {change['file']}")
                print(f"Type: {change['type']}")
                print(f"GitLab Commit: {change['gitlab_sha'][:8]}")
                
                if change['type'] == 'updated':
                    print("Previous version:", change['old_info']['modified_time'])
                    print("New version:", change['new_info']['modified_time'])
                    print(f"Backup created at: {change['backup_path']}")
        
        checker.print_status()
        time.sleep(interval)

if __name__ == '__main__':
    try:
        monitor_files()
    except KeyboardInterrupt:
        print("\nStopping version checker...")
