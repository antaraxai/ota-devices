"""Device logging utilities."""

from typing import Dict, List, Any
from datetime import datetime
from .logging_utils import StructuredLogger
from .security_utils import SecurityUtils

# Store device logs
device_logs: Dict[str, List[Dict[str, Any]]] = {}

def add_device_log(device_id: str, message: str) -> None:
    """Add a log message for a device."""
    try:
        device_id = SecurityUtils.validate_input(device_id, pattern_name='device_id')
        message = SecurityUtils.validate_input(message, max_length=500)
        
        if device_id not in device_logs:
            device_logs[device_id] = []
            
        log_entry = {
            'timestamp': datetime.now().isoformat(),
            'message': message
        }
        
        device_logs[device_id].append(log_entry)
        
        # Keep only last 100 logs per device
        if len(device_logs[device_id]) > 100:
            device_logs[device_id] = device_logs[device_id][-100:]
            
        StructuredLogger.info(
            'Added device log',
            extra={
                'device_id': device_id,
                'message': message
            }
        )
    except Exception as e:
        StructuredLogger.error(
            'Failed to add device log',
            extra={'device_id': device_id},
            error=e
        )
        raise

def get_device_logs(device_id: str) -> List[Dict[str, Any]]:
    """Get logs for a specific device."""
    try:
        device_id = SecurityUtils.validate_input(device_id, pattern_name='device_id')
        
        logs = device_logs.get(device_id, [])
        
        StructuredLogger.info(
            'Retrieved device logs',
            extra={
                'device_id': device_id,
                'count': len(logs)
            }
        )
        
        return logs
    except Exception as e:
        StructuredLogger.error(
            'Failed to get device logs',
            extra={'device_id': device_id},
            error=e
        )
        raise
