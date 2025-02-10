"""Production-grade atomic operation utilities."""

import os
import time
import tempfile
import shutil
from contextlib import contextmanager
from typing import Optional
from .logging_utils import StructuredLogger

class AtomicOperationError(Exception):
    """Custom exception for atomic operation failures."""
    pass

class AtomicUtils:
    """Utilities for atomic operations and locking."""
    
    @staticmethod
    @contextmanager
    def atomic_operation(operation_name: str, work_dir: Optional[str] = None):
        """
        Context manager for atomic operations with rollback capability.
        
        Args:
            operation_name: Name of the operation for logging
            work_dir: Optional working directory to backup
            
        Yields:
            Temporary directory path for the operation
        """
        start_time = time.time()
        checkpoint = None
        temp_backup = None
        
        try:
            # Create temporary directory for the operation
            with tempfile.TemporaryDirectory() as temp_dir:
                checkpoint = temp_dir
                
                # Backup working directory if specified
                if work_dir and os.path.exists(work_dir):
                    temp_backup = os.path.join(temp_dir, 'backup')
                    shutil.copytree(work_dir, temp_backup)
                    StructuredLogger.info(
                        'Created workspace backup',
                        extra={
                            'operation': operation_name,
                            'work_dir': work_dir
                        }
                    )
                
                yield temp_dir
                
                duration_ms = (time.time() - start_time) * 1000
                StructuredLogger.info(
                    'Atomic operation completed successfully',
                    extra={
                        'operation': operation_name,
                        'work_dir': work_dir
                    },
                    duration_ms=duration_ms
                )
                
        except Exception as e:
            # Attempt rollback if we have a backup
            if temp_backup and work_dir:
                try:
                    if os.path.exists(work_dir):
                        shutil.rmtree(work_dir)
                    shutil.copytree(temp_backup, work_dir)
                    StructuredLogger.warning(
                        'Rolled back changes due to error',
                        extra={
                            'operation': operation_name,
                            'work_dir': work_dir
                        },
                        error=e
                    )
                except Exception as rollback_error:
                    StructuredLogger.error(
                        'Failed to rollback changes',
                        extra={
                            'operation': operation_name,
                            'work_dir': work_dir
                        },
                        error=rollback_error
                    )
            raise AtomicOperationError(f"Atomic operation failed: {str(e)}") from e
    
    @staticmethod
    @contextmanager
    def file_lock(lock_file: str, operation: str, timeout: int = 30):
        """
        File-based locking mechanism for concurrent operations.
        
        Args:
            lock_file: Path to lock file
            operation: Name of operation for logging
            timeout: Maximum time to wait for lock in seconds
        """
        start_time = time.time()
        acquired = False
        
        try:
            # Wait for lock
            while os.path.exists(lock_file):
                if time.time() - start_time > timeout:
                    raise TimeoutError(f'Failed to acquire lock for {operation}')
                time.sleep(0.5)
            
            # Create lock file
            os.makedirs(os.path.dirname(lock_file), exist_ok=True)
            with open(lock_file, 'w') as f:
                f.write(f'{operation}\n{time.time()}')
            acquired = True
            
            StructuredLogger.info(
                'Acquired file lock',
                extra={
                    'operation': operation,
                    'lock_file': lock_file
                }
            )
            
            yield
            
        finally:
            if acquired and os.path.exists(lock_file):
                try:
                    os.remove(lock_file)
                    StructuredLogger.info(
                        'Released file lock',
                        extra={
                            'operation': operation,
                            'lock_file': lock_file
                        }
                    )
                except Exception as e:
                    StructuredLogger.error(
                        'Failed to release file lock',
                        extra={
                            'operation': operation,
                            'lock_file': lock_file
                        },
                        error=e
                    )
