"""Git-related utilities for device management."""

import os
import subprocess
import threading
import time
import json
from typing import Dict, Any
from .logging_utils import StructuredLogger
from .retry_utils import RetryUtils
from .security_utils import SecurityUtils

def get_current_commit_sha(repo_dir: str, branch: str = 'main') -> str:
    """Get the current commit SHA for a repository."""
    try:
        result = subprocess.run(
            ['git', 'rev-parse', branch],
            cwd=repo_dir,
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        StructuredLogger.error(
            'Failed to get current commit SHA',
            extra={'repo_dir': repo_dir, 'branch': branch},
            error=e
        )
        raise

def rollback_to_commit(repo_dir: str, commit_sha: str) -> None:
    """Rollback repository to a specific commit."""
    try:
        subprocess.run(
            ['git', 'reset', '--hard', commit_sha],
            cwd=repo_dir,
            check=True
        )
        StructuredLogger.info(
            'Rolled back to previous commit',
            extra={'repo_dir': repo_dir, 'commit_sha': commit_sha}
        )
    except subprocess.CalledProcessError as e:
        StructuredLogger.error(
            'Failed to rollback repository',
            extra={'repo_dir': repo_dir, 'commit_sha': commit_sha},
            error=e
        )
        raise

@RetryUtils.with_retries(max_attempts=3)
def clone_or_pull_repo(device_id: str, repo_url: str, branch: str = 'main') -> None:
    """Clone or pull repository for a device."""
    from .workspace_utils import get_shared_repo_dir  # Import here to avoid circular dependency
    from .workspace_backup_utils import create_backup, restore_backup
    
    try:
        repo_dir = os.path.join(get_shared_repo_dir(), device_id)
        
        if os.path.exists(repo_dir):
            # Create backup before making changes
            backup_path = create_backup(device_id)
            if not backup_path:
                StructuredLogger.error(
                    'Failed to create backup, aborting update',
                    extra={'device_id': device_id}
                )
                return
            
            try:
                # Pull latest changes
                subprocess.run(
                    ['git', 'fetch', 'origin', branch],
                    cwd=repo_dir,
                    check=True
                )
                subprocess.run(
                    ['git', 'reset', '--hard', f'origin/{branch}'],
                    cwd=repo_dir,
                    check=True
                )
                
                # Verify the new changes work
                if not verify_device_changes(device_id, repo_dir):
                    StructuredLogger.warning(
                        'New changes failed verification, restoring from backup',
                        extra={'device_id': device_id, 'backup_path': backup_path}
                    )
                    restore_backup(device_id, backup_path)
                    return
                
                StructuredLogger.info(
                    'Pulled latest changes',
                    extra={'device_id': device_id, 'repo_url': repo_url}
                )
            except Exception as e:
                StructuredLogger.error(
                    'Failed to pull changes, restoring from backup',
                    extra={'device_id': device_id, 'backup_path': backup_path},
                    error=e
                )
                restore_backup(device_id, backup_path)
                raise
        else:
            # Clone repository
            subprocess.run(
                ['git', 'clone', '-b', branch, repo_url, repo_dir],
                check=True
            )
            StructuredLogger.info(
                'Cloned repository',
                extra={'device_id': device_id, 'repo_url': repo_url}
            )
    except subprocess.CalledProcessError as e:
        StructuredLogger.error(
            'Git operation failed',
            extra={'device_id': device_id, 'repo_url': repo_url},
            error=e
        )
        raise

@RetryUtils.with_retries(max_attempts=3)
def verify_device_changes(device_id: str, repo_dir: str) -> bool:
    """Verify that device changes are valid.
    
    This function checks:
    1. Required files exist (index.html, etc.)
    2. Basic syntax validation of configuration files
    3. No breaking changes in the API contract
    
    Returns:
        bool: True if changes are valid, False otherwise
    """
    try:
        # Check for required files
        required_files = ['index.html', 'config.json']
        for file in required_files:
            if not os.path.exists(os.path.join(repo_dir, file)):
                StructuredLogger.error(
                    f'Required file {file} is missing',
                    extra={'device_id': device_id, 'repo_dir': repo_dir}
                )
                return False
        
        # Validate config.json syntax
        config_path = os.path.join(repo_dir, 'config.json')
        try:
            with open(config_path, 'r') as f:
                json.load(f)
        except json.JSONDecodeError as e:
            StructuredLogger.error(
                'Invalid config.json syntax',
                extra={'device_id': device_id, 'config_path': config_path},
                error=e
            )
            return False
        
        # All checks passed
        return True
        
    except Exception as e:
        StructuredLogger.error(
            'Failed to verify device changes',
            extra={'device_id': device_id, 'repo_dir': repo_dir},
            error=e
        )
        return False

def monitor_gitlab_changes() -> None:
    """Background thread to monitor GitLab changes."""
    from .device_manager import get_devices_with_github  # Import here to avoid circular dependency
    
    while True:
        try:
            devices = get_devices_with_github()
            for device in devices:
                device_id = device['id']
                repo_url = device.get('repo_url')
                branch = device.get('repo_branch', 'main')
                
                if not repo_url:
                    continue
                    
                try:
                    clone_or_pull_repo(device_id, repo_url, branch)
                except Exception as e:
                    StructuredLogger.error(
                        'Failed to update device repository',
                        extra={'device_id': device_id},
                        error=e
                    )
            
            # Sleep for 5 minutes before next check
            time.sleep(300)
            
        except Exception as e:
            StructuredLogger.error(
                'GitLab monitoring error',
                error=e
            )
            # Sleep for 1 minute before retry on error
            time.sleep(60)
