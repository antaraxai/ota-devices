"""Device management utilities."""

from typing import Dict, List, Any, Optional
from datetime import datetime
from .logging_utils import StructuredLogger
from .retry_utils import RetryUtils
from .security_utils import SecurityUtils

# Store running controllers
running_controllers = {}

@RetryUtils.with_retries(max_attempts=3)
def update_device_status(device_id: str, status: str, details: str = None) -> None:
    """Update device status in the database."""
    from .db_utils import supabase
    
    try:
        # Validate inputs
        device_id = SecurityUtils.validate_input(device_id, pattern_name='device_id')
        status = SecurityUtils.validate_input(
            status,
            pattern=r'^(ONLINE|OFFLINE|ERROR|UPDATING)$'
        )
        if details:
            details = SecurityUtils.validate_input(
                details,
                max_length=500  # Reasonable limit for status messages
            )
        
        update_data = {
            'status': status
        }
        
        supabase.table('devices').update(update_data).eq('id', device_id).execute()
        
        # Add status change to device logs
        from .device_logs import add_device_log  # Import here to avoid circular dependency
        log_message = f"Status changed to {status}" + (f": {details}" if details else "")
        add_device_log(device_id, log_message)
        
        StructuredLogger.info(
            'Updated device status',
            extra={
                'device_id': device_id,
                'status': status,
                'details': details
            }
        )
    except Exception as e:
        StructuredLogger.error(
            'Failed to update device status',
            extra={'device_id': device_id},
            error=e
        )
        raise

def list_devices() -> List[Dict[str, Any]]:
    """Get all devices and their status."""
    from .db_utils import supabase
    
    try:
        response = supabase.table('devices').select('*').execute()
        devices = response.data
        
        StructuredLogger.info(
            'Retrieved device list',
            extra={'count': len(devices)}
        )
        return devices
    except Exception as e:
        StructuredLogger.error(
            'Failed to list devices',
            error=e
        )
        raise

@RetryUtils.with_retries(max_attempts=3)
def get_devices_with_github() -> List[Dict[str, Any]]:
    """Fetch all devices that have GitHub configuration."""
    from .db_utils import supabase
    
    try:
        response = supabase.table('devices').select('*').not_.is_('repo_url', 'null').execute()
        devices = response.data
        
        StructuredLogger.info(
            'Retrieved devices with GitHub config',
            extra={'count': len(devices)}
        )
        return devices
    except Exception as e:
        StructuredLogger.error(
            'Failed to get devices with GitHub config',
            error=e
        )
        raise

def start_device(device_id: str) -> Dict[str, Any]:
    """Start monitoring a specific device."""
    try:
        device_id = SecurityUtils.validate_input(device_id, pattern_name='device_id')
        
        if device_id in running_controllers:
            return {'status': 'already_running'}
        
        # Update device status to ONLINE
        update_device_status(device_id, 'ONLINE', 'Device monitoring started')
        running_controllers[device_id] = True
        
        return {'status': 'started'}
    except Exception as e:
        StructuredLogger.error(
            'Failed to start device',
            extra={'device_id': device_id},
            error=e
        )
        raise

def stop_device(device_id: str) -> Dict[str, Any]:
    """Stop monitoring a specific device."""
    try:
        device_id = SecurityUtils.validate_input(device_id, pattern_name='device_id')
        
        if device_id not in running_controllers:
            return {'status': 'not_running'}
        
        # Update device status to OFFLINE
        update_device_status(device_id, 'OFFLINE', 'Device monitoring stopped')
        del running_controllers[device_id]
        
        return {'status': 'stopped'}
    except Exception as e:
        StructuredLogger.error(
            'Failed to stop device',
            extra={'device_id': device_id},
            error=e
        )
        raise

def get_device_status(device_id: str) -> Dict[str, Any]:
    """Get detailed status of a specific device."""
    from device_api import supabase  # Import here to avoid circular dependency
    
    try:
        device_id = SecurityUtils.validate_input(device_id, pattern_name='device_id')
        
        # Add connection error handling
        try:
            response = supabase.table('devices').select('*').eq('id', device_id).single().execute()
            device = response.data
        except Exception as conn_error:
            StructuredLogger.error(
                'Database connection error',
                extra={'device_id': device_id, 'error_type': 'connection'},
                error=conn_error
            )
            raise ValueError(f"Unable to connect to database: {str(conn_error)}")
            
        if not device:
            raise ValueError(f"Device {device_id} not found")
            
        return device
    except Exception as e:
        StructuredLogger.error(
            'Failed to get device status',
            extra={'device_id': device_id},
            error=e
        )
        raise

@RetryUtils.with_retries(max_attempts=3)
def mark_all_devices_offline() -> None:
    """Mark all devices as offline during server startup."""
    try:
        devices = list_devices()
        for device in devices:
            update_device_status(
                device['id'],
                'OFFLINE',
                'Server restarted'
            )
        
        StructuredLogger.info(
            'Marked all devices as offline',
            extra={'count': len(devices)}
        )
    except Exception as e:
        StructuredLogger.error(
            'Failed to mark devices offline',
            error=e
        )
        raise
