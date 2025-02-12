"""Workspace management utilities."""

import os
import shutil
from typing import Dict, Any
from datetime import datetime
from .logging_utils import StructuredLogger
from .retry_utils import RetryUtils
from .security_utils import SecurityUtils
from .atomic_utils import AtomicUtils

def create_directory_if_not_exists(directory_path: str) -> None:
    """Create a directory if it doesn't exist with proper permissions."""
    if not os.path.exists(directory_path):
        os.makedirs(directory_path, mode=0o755, exist_ok=True)
        StructuredLogger.info(f"Created directory: {directory_path}")

def get_shared_repo_dir() -> str:
    """Get the shared repository directory."""
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base_dir, 'shared_repos')

def get_device_work_dir(device_id: str) -> str:
    """Get the working directory for a device."""
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base_dir, 'workspaces', device_id)

def setup_device_workspace(device_id: str, device: Dict[str, Any]) -> None:
    """Set up a clean workspace for the device."""
    try:
        device_id = SecurityUtils.validate_input(device_id, pattern_name='device_id')
        
        work_dir = get_device_work_dir(device_id)
        
        # Create workspace directory if it doesn't exist
        os.makedirs(work_dir, exist_ok=True)
        
        # Copy gitlab_controller.py to the workspace
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        controller_src = os.path.join(base_dir, 'gitlab_controller.py')
        controller_dst = os.path.join(work_dir, 'gitlab_controller.py')
        
        if os.path.exists(controller_src):
            shutil.copy2(controller_src, controller_dst)
            os.chmod(controller_dst, 0o644)  # Make it readable
            
            StructuredLogger.info(
                'Copied controller script to workspace',
                extra={
                    'device_id': device_id,
                    'source': controller_src,
                    'destination': controller_dst
                }
            )
        else:
            StructuredLogger.error(
                'Controller script not found',
                extra={
                    'device_id': device_id,
                    'expected_path': controller_src
                }
            )
        
        StructuredLogger.info(
            'Set up device workspace',
            extra={
                'device_id': device_id,
                'work_dir': work_dir
            }
        )
    except Exception as e:
        StructuredLogger.error(
            'Failed to set up device workspace',
            extra={'device_id': device_id},
            error=e
        )
        raise

@AtomicUtils.atomic_operation
def backup_workspace(device_id: str) -> None:
    """Create a backup of the device workspace."""
    try:
        device_id = SecurityUtils.validate_input(device_id, pattern_name='device_id')
        
        work_dir = get_device_work_dir(device_id)
        if not os.path.exists(work_dir):
            StructuredLogger.warning(
                'No workspace to backup',
                extra={'device_id': device_id}
            )
            return
            
        # Create backup directory
        backup_dir = os.path.join(
            os.path.dirname(work_dir),
            'backups',
            device_id,
            datetime.now().strftime('%Y%m%d_%H%M%S')
        )
        os.makedirs(backup_dir, exist_ok=True)
        
        # Copy workspace to backup
        shutil.copytree(work_dir, backup_dir, dirs_exist_ok=True)
        
        StructuredLogger.info(
            'Created workspace backup',
            extra={
                'device_id': device_id,
                'backup_dir': backup_dir
            }
        )
    except Exception as e:
        StructuredLogger.error(
            'Failed to backup workspace',
            extra={'device_id': device_id},
            error=e
        )
        raise

@RetryUtils.with_retries(max_attempts=3)
def force_refresh(device_id: str) -> Dict[str, Any]:
    """Force refresh of device files from GitLab."""
    from .device_manager import update_device_status  # Import here to avoid circular dependency
    from .git_utils import clone_or_pull_repo  # Import here to avoid circular dependency
    
    try:
        device_id = SecurityUtils.validate_input(device_id, pattern_name='device_id')
        
        # Get device details
        from device_api import supabase  # Import here to avoid circular dependency
        response = supabase.table('devices').select('*').eq('id', device_id).single().execute()
        device = response.data
        
        if not device:
            raise ValueError(f"Device {device_id} not found")
            
        repo_url = device.get('github_url')
        if not repo_url:
            raise ValueError(f"Device {device_id} has no GitHub URL configured")
            
        # Update status to UPDATING
        update_device_status(device_id, 'UPDATING', 'Force refreshing device files')
        
        # Pull latest changes
        clone_or_pull_repo(device_id, repo_url, device.get('github_branch', 'main'))
        
        # Update status back to ONLINE
        update_device_status(device_id, 'ONLINE', 'Device files refreshed')
        
        return {'status': 'refreshed'}
    except Exception as e:
        StructuredLogger.error(
            'Failed to force refresh',
            extra={'device_id': device_id},
            error=e
        )
        # Update status to ERROR
        update_device_status(device_id, 'ERROR', str(e))
        raise
