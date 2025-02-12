"""Utilities for managing device workspace backups."""

import os
import shutil
from datetime import datetime
from typing import Optional
from .logging_utils import StructuredLogger
from .workspace_utils import get_device_work_dir

def create_backup(device_id: str) -> Optional[str]:
    """Create a backup of the device workspace.
    
    Args:
        device_id: ID of the device to backup
        
    Returns:
        Optional[str]: Path to the backup if successful, None if backup not needed or failed
    """
    try:
        # Get and validate work directory
        work_dir = get_device_work_dir(device_id)
        if not os.path.exists(work_dir) or not os.path.exists(os.path.join(work_dir, '.git')):
            # No backup needed for non-existent or non-git directories
            return None
            
        # Ensure we have read access to the work directory
        if not os.access(work_dir, os.R_OK):
            StructuredLogger.error(
                'No read access to workspace directory',
                extra={'device_id': device_id, 'work_dir': work_dir}
            )
            return None
            
        # Create backups directory with proper permissions
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        backups_dir = os.path.join(base_dir, 'device_backups', device_id)
        os.makedirs(backups_dir, mode=0o755, exist_ok=True)
        
        # Create timestamp for backup
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_path = os.path.join(backups_dir, f'backup_{timestamp}')
        
        # Remove target directory if it already exists
        if os.path.exists(backup_path):
            shutil.rmtree(backup_path)
        
        # Create backup with proper permissions
        shutil.copytree(work_dir, backup_path, dirs_exist_ok=True)
        
        # Set proper permissions on backup directory
        for root, dirs, files in os.walk(backup_path):
            os.chmod(root, 0o755)  # rwxr-xr-x for directories
            for d in dirs:
                os.chmod(os.path.join(root, d), 0o755)
            for f in files:
                os.chmod(os.path.join(root, f), 0o644)  # rw-r--r-- for files
        
        StructuredLogger.info(
            'Created workspace backup',
            extra={
                'device_id': device_id,
                'backup_path': backup_path,
                'size': sum(os.path.getsize(os.path.join(root, f))
                           for root, _, files in os.walk(backup_path)
                           for f in files)
            }
        )
        
        # Keep only last 5 backups
        backups = sorted([
            d for d in os.listdir(backups_dir)
            if os.path.isdir(os.path.join(backups_dir, d))
        ])
        
        while len(backups) > 5:
            oldest_backup = os.path.join(backups_dir, backups[0])
            try:
                shutil.rmtree(oldest_backup)
                backups.pop(0)
                StructuredLogger.info(
                    'Removed old backup',
                    extra={
                        'device_id': device_id,
                        'backup_path': oldest_backup
                    }
                )
            except Exception as e:
                StructuredLogger.warning(
                    'Failed to remove old backup',
                    extra={
                        'device_id': device_id,
                        'backup_path': oldest_backup
                    },
                    error=e
                )
            
        return backup_path
        
    except Exception as e:
        StructuredLogger.error(
            'Failed to create backup',
            extra={'device_id': device_id},
            error=e
        )
        return None

def restore_backup(device_id: str, backup_path: str) -> bool:
    """Restore a device workspace from a backup.
    
    Args:
        device_id: ID of the device to restore
        backup_path: Path to the backup to restore from
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        work_dir = get_device_work_dir(device_id)
        
        # Remove current workspace
        if os.path.exists(work_dir):
            shutil.rmtree(work_dir)
        
        # Restore from backup
        shutil.copytree(backup_path, work_dir)
        
        StructuredLogger.info(
            'Restored workspace from backup',
            extra={
                'device_id': device_id,
                'backup_path': backup_path
            }
        )
        return True
        
    except Exception as e:
        StructuredLogger.error(
            'Failed to restore backup',
            extra={
                'device_id': device_id,
                'backup_path': backup_path
            },
            error=e
        )
        return False
