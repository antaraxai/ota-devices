"""Production-grade retry utilities."""

import time
import functools
from typing import Callable, Optional, Type, Union, Tuple
from .logging_utils import StructuredLogger

class RetryError(Exception):
    """Custom exception for retry failures."""
    def __init__(self, message: str, last_exception: Optional[Exception] = None):
        super().__init__(message)
        self.last_exception = last_exception

class RetryUtils:
    """Utilities for retrying operations with exponential backoff."""
    
    @staticmethod
    def with_retries(
        max_attempts: int = 3,
        delay: float = 1.0,
        exceptions: Union[Type[Exception], Tuple[Type[Exception], ...]] = Exception,
        on_retry: Optional[Callable] = None
    ):
        """
        Decorator for retrying operations with exponential backoff.
        
        Args:
            max_attempts: Maximum number of retry attempts
            delay: Initial delay between retries in seconds
            exceptions: Exception types to catch and retry
            on_retry: Optional callback function to execute before each retry
            
        Returns:
            Decorated function
        """
        def decorator(func: Callable):
            @functools.wraps(func)
            def wrapper(*args, **kwargs):
                last_exception = None
                
                for attempt in range(max_attempts):
                    try:
                        start_time = time.time()
                        result = func(*args, **kwargs)
                        
                        # Log successful attempt
                        duration_ms = (time.time() - start_time) * 1000
                        StructuredLogger.info(
                            f"Operation completed successfully",
                            extra={
                                'function': func.__name__,
                                'attempt': attempt + 1,
                                'args': str(args),
                                'kwargs': str(kwargs)
                            },
                            duration_ms=duration_ms
                        )
                        
                        return result
                        
                    except exceptions as e:
                        last_exception = e
                        
                        if attempt < max_attempts - 1:
                            wait_time = delay * (2 ** attempt)  # Exponential backoff
                            
                            StructuredLogger.warning(
                                'Operation failed, retrying',
                                extra={
                                    'function': func.__name__,
                                    'attempt': attempt + 1,
                                    'max_attempts': max_attempts,
                                    'wait_time': wait_time,
                                    'args': str(args),
                                    'kwargs': str(kwargs)
                                },
                                error=e
                            )
                            
                            # Execute retry callback if provided
                            if on_retry:
                                try:
                                    on_retry(attempt, e)
                                except Exception as callback_error:
                                    StructuredLogger.error(
                                        'Retry callback failed',
                                        extra={'function': func.__name__},
                                        error=callback_error
                                    )
                            
                            time.sleep(wait_time)
                        else:
                            StructuredLogger.error(
                                'Operation failed after all attempts',
                                extra={
                                    'function': func.__name__,
                                    'max_attempts': max_attempts
                                },
                                error=e
                            )
                
                raise RetryError(
                    f"Operation failed after {max_attempts} attempts",
                    last_exception
                )
                
            return wrapper
        return decorator
