"""Production-grade security utilities."""

import os
import re
import stat
import hashlib
from typing import Optional, Pattern
from contextlib import contextmanager
from .logging_utils import StructuredLogger

class SecurityUtils:
    """Security-related utility functions."""
    
    # Common validation patterns
    PATTERNS = {
        'device_id': r'^[\w\-]+$',
        'repo_url': r'^[\w\-:/\.@]+$',
        'branch': r'^[\w\-./]+$',
        'path': r'^[\w\-./]+$',
        'sha': r'^[0-9a-f]{40}$'
    }
    
    @staticmethod
    def validate_input(
        value: str,
        pattern: Optional[str] = None,
        max_length: int = 1000,
        pattern_name: Optional[str] = None
    ) -> str:
        """
        Validate and sanitize input strings.
        
        Args:
            value: Input string to validate
            pattern: Regex pattern for validation
            max_length: Maximum allowed length
            pattern_name: Name of predefined pattern to use
        
        Returns:
            Sanitized input string
        
        Raises:
            ValueError: If validation fails
        """
        if not isinstance(value, str):
            raise ValueError('Input must be a string')
            
        if len(value) > max_length:
            raise ValueError(f'Input exceeds maximum length of {max_length}')
            
        # Use predefined pattern if specified
        if pattern_name and pattern_name in SecurityUtils.PATTERNS:
            pattern = SecurityUtils.PATTERNS[pattern_name]
            
        if pattern and not re.match(pattern, value):
            raise ValueError('Input contains invalid characters')
            
        return value.strip()
    
    @staticmethod
    def secure_directory(path: str, mode: int = 0o750) -> None:
        """
        Secure a directory with proper permissions.
        
        Args:
            path: Directory path
            mode: Permission mode (default: 0o750 - rwxr-x---)
        """
        try:
            # Create directory if it doesn't exist
            os.makedirs(path, mode=mode, exist_ok=True)
            
            # Set permissions
            os.chmod(path, mode)
            
            StructuredLogger.info(
                'Secured directory',
                extra={
                    'path': path,
                    'mode': oct(mode)
                }
            )
        except Exception as e:
            StructuredLogger.error(
                'Failed to secure directory',
                extra={'path': path},
                error=e
            )
            raise
    
    @staticmethod
    def calculate_checksum(path: str) -> str:
        """
        Calculate SHA-256 checksum of a file or directory.
        
        Args:
            path: Path to file or directory
            
        Returns:
            Hex digest of SHA-256 hash
        """
        sha256_hash = hashlib.sha256()
        
        try:
            if os.path.isfile(path):
                with open(path, 'rb') as f:
                    for byte_block in iter(lambda: f.read(4096), b""):
                        sha256_hash.update(byte_block)
            else:
                for root, _, files in os.walk(path):
                    for file in sorted(files):  # Sort for consistency
                        file_path = os.path.join(root, file)
                        with open(file_path, 'rb') as f:
                            for byte_block in iter(lambda: f.read(4096), b""):
                                sha256_hash.update(byte_block)
            
            checksum = sha256_hash.hexdigest()
            StructuredLogger.info(
                'Calculated checksum',
                extra={
                    'path': path,
                    'checksum': checksum
                }
            )
            return checksum
            
        except Exception as e:
            StructuredLogger.error(
                'Failed to calculate checksum',
                extra={'path': path},
                error=e
            )
            raise
