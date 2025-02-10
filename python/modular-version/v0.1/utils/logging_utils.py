"""Production-grade logging utilities."""

import logging
import json
import time
import os
import inspect
import functools
import traceback
from datetime import datetime
from typing import Any, Dict, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(message)s'  # Raw format as we'll handle formatting
)
logger = logging.getLogger(__name__)

class StructuredLogger:
    """JSON-formatted structured logging with context."""
    
    @staticmethod
    def _get_caller_info() -> Dict[str, Any]:
        """Get information about the calling function."""
        frame = inspect.currentframe()
        # Get caller's frame (2 levels up to skip this function)
        caller = inspect.getouterframes(frame, 2)[2]
        return {
            'function': caller.function,
            'filename': os.path.basename(caller.filename),
            'line': caller.lineno
        }
    
    @staticmethod
    def _format_log(
        level: str,
        message: str,
        extra: Optional[Dict[str, Any]] = None,
        error: Optional[Exception] = None,
        duration_ms: Optional[float] = None
    ) -> str:
        """Format log entry in a human-readable format."""
        timestamp = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
        caller = StructuredLogger._get_caller_info()
        
        # Build log message
        log_parts = []
        
        # Add timestamp and level
        log_parts.append(f"[{timestamp}] {level:<8} | ")
        
        # Add source location
        log_parts.append(f"[{caller['filename']}:{caller['line']}] ")
        
        # Add message
        log_parts.append(message)
        
        # Add duration if present
        if duration_ms is not None:
            log_parts.append(f" (took {duration_ms:.2f}ms)")
        
        # Add context if present
        if extra:
            log_parts.append(" | ")
            log_parts.append(", ".join(f"{k}={v}" for k, v in sorted(extra.items())))
        
        # Add error information if present
        if error:
            log_parts.append(f" | error={error.__class__.__name__}: {str(error)}")
            # Add simplified traceback
            tb_list = traceback.extract_tb(error.__traceback__)
            if tb_list:
                frame = tb_list[-1]  # Get the last frame
                filename = os.path.basename(frame.filename)
                log_parts.append(f" | at {filename}:{frame.lineno} in {frame.name}")
        
        # Add caller info
        caller = StructuredLogger._get_caller_info()
        log_parts.append(
            f" | at {caller['filename']}:{caller['line']} in {caller['function']}"
        )
        
        return ''.join(log_parts)
    
    @classmethod
    def info(cls, message: str, extra: Optional[Dict[str, Any]] = None, duration_ms: Optional[float] = None):
        """Log at INFO level."""
        logger.info(cls._format_log('INFO', message, extra, duration_ms=duration_ms))
    
    @classmethod
    def warning(cls, message: str, extra: Optional[Dict[str, Any]] = None, error: Optional[Exception] = None):
        """Log at WARNING level."""
        logger.warning(cls._format_log('WARNING', message, extra, error))
    
    @classmethod
    def error(cls, message: str, extra: Optional[Dict[str, Any]] = None, error: Optional[Exception] = None):
        """Log at ERROR level."""
        logger.error(cls._format_log('ERROR', message, extra, error))

def log_duration(func):
    """Decorator to log function duration."""
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.time()
        try:
            result = func(*args, **kwargs)
            duration_ms = (time.time() - start_time) * 1000
            StructuredLogger.info(
                f"Completed {func.__name__}",
                extra={'args': str(args), 'kwargs': str(kwargs)},
                duration_ms=duration_ms
            )
            return result
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            StructuredLogger.error(
                f"Error in {func.__name__}",
                extra={'args': str(args), 'kwargs': str(kwargs)},
                error=e
            )
            raise
    return wrapper
