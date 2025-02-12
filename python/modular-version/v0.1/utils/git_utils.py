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
        os.makedirs(repo_dir, exist_ok=True)
        
        # Check if this is an existing repo
        is_existing_repo = os.path.exists(os.path.join(repo_dir, '.git'))
        
        if is_existing_repo:
            # Only create backup for existing repos with content
            backup_path = create_backup(device_id)
            if backup_path is None:
                StructuredLogger.info(
                    'No backup needed for empty repository',
                    extra={'device_id': device_id}
                )
            
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
                
                # Only verify and restore if we created a backup
                if backup_path:
                    if not verify_device_changes(device_id, repo_dir):
                        StructuredLogger.warning(
                            'New changes failed verification, restoring from backup',
                            extra={'device_id': device_id, 'backup_path': backup_path}
                        )
                        restore_backup(device_id, backup_path)
                        return
                else:
                    # For new repositories, just verify without backup
                    if not verify_device_changes(device_id, repo_dir):
                        StructuredLogger.warning(
                            'New repository failed verification',
                            extra={'device_id': device_id}
                        )
                        return
                
                StructuredLogger.info(
                    'Updated repository successfully',
                    extra={'device_id': device_id, 'repo_url': repo_url, 'operation': 'pull' if backup_path else 'clone'}
                )
            except Exception as e:
                if backup_path:
                    StructuredLogger.error(
                        'Failed to pull changes, restoring from backup',
                        extra={'device_id': device_id, 'backup_path': backup_path},
                        error=e
                    )
                    restore_backup(device_id, backup_path)
                else:
                    StructuredLogger.error(
                        'Failed to update repository',
                        extra={'device_id': device_id},
                        error=e
                    )
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
    1. Git repository integrity
    2. Basic file structure based on repository type
    3. Configuration file syntax if present
    
    Returns:
        bool: True if changes are valid, False otherwise
    """
    try:
        # Verify git repository integrity
        git_dir = os.path.join(repo_dir, '.git')
        if not os.path.exists(git_dir):
            StructuredLogger.error(
                'Not a valid git repository',
                extra={'device_id': device_id, 'repo_dir': repo_dir}
            )
            return False
            
        # Check repository status
        try:
            subprocess.run(
                ['git', 'status'],
                cwd=repo_dir,
                check=True,
                capture_output=True
            )
        except subprocess.CalledProcessError as e:
            StructuredLogger.error(
                'Git repository is in an invalid state',
                extra={'device_id': device_id, 'repo_dir': repo_dir},
                error=e
            )
            return False
            
        # Determine repository type and required files
        package_json = os.path.join(repo_dir, 'package.json')
        requirements_txt = os.path.join(repo_dir, 'requirements.txt')
        index_html = os.path.join(repo_dir, 'index.html')
        config_json = os.path.join(repo_dir, 'config.json')
        
        if os.path.exists(package_json):
            # Node.js repository
            repo_type = 'nodejs'
            required_files = ['package.json']
        elif os.path.exists(requirements_txt):
            # Python repository
            repo_type = 'python'
            required_files = ['requirements.txt']
        elif os.path.exists(index_html):
            # Web repository
            repo_type = 'web'
            required_files = ['index.html']
            if os.path.exists(config_json):
                required_files.append('config.json')
        else:
            # Generic repository
            repo_type = 'generic'
            StructuredLogger.info(
                'Generic repository detected',
                extra={
                    'device_id': device_id,
                    'repo_dir': repo_dir,
                    'repo_type': repo_type
                }
            )
            return True
                # Verify required files based on repository type
        if repo_type != 'generic':
            StructuredLogger.info(
                'Verifying required files',
                extra={
                    'device_id': device_id,
                    'repo_dir': repo_dir,
                    'repo_type': repo_type,
                    'required_files': required_files
                }
            )
            for file in required_files:
                file_path = os.path.join(repo_dir, file)
                if not os.path.exists(file_path):
                    StructuredLogger.error(
                        f'Required file {file} is missing',
                        extra={
                            'device_id': device_id,
                            'repo_dir': repo_dir,
                            'repo_type': repo_type,
                            'missing_file': file
                        }
                    )
                    return False
                elif not os.access(file_path, os.R_OK):
                    StructuredLogger.error(
                        f'Required file {file} is not readable',
                        extra={
                            'device_id': device_id,
                            'repo_dir': repo_dir,
                            'repo_type': repo_type,
                            'file': file
                        }
                    )
                    return False
        
        # Validate config.json syntax if it exists and is required
        if repo_type == 'web' and os.path.exists(config_json):
            try:
                with open(config_json, 'r') as f:
                    json.load(f)
                StructuredLogger.info(
                    'Validated config.json successfully',
                    extra={
                        'device_id': device_id,
                        'repo_dir': repo_dir,
                        'repo_type': repo_type
                    }
                )
            except json.JSONDecodeError as e:
                StructuredLogger.error(
                    'Invalid config.json syntax',
                    extra={
                        'device_id': device_id,
                        'repo_dir': repo_dir,
                        'repo_type': repo_type
                    },
                    error=e
                )
                return False
            except Exception as e:
                StructuredLogger.error(
                    'Failed to read config.json',
                    extra={
                        'device_id': device_id,
                        'repo_dir': repo_dir,
                        'repo_type': repo_type
                    },
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
