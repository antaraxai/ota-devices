"""Preview and static file handling utilities."""

import os
from flask import make_response, jsonify
from typing import Dict, Any, Tuple
from .logging_utils import StructuredLogger
from .security_utils import SecurityUtils
from .workspace_utils import get_device_work_dir

def get_device_preview(device_id: str) -> Tuple[Any, int]:
    """Get the device's index.html preview."""
    try:
        device_id = SecurityUtils.validate_input(device_id, pattern_name='device_id')
        formatted_id = device_id
        
        work_dir = get_device_work_dir(formatted_id)
        index_path = os.path.join(work_dir, 'index.html')
        
        if not os.path.exists(index_path):
            StructuredLogger.error(
                'Preview file not found',
                extra={'device_id': formatted_id}
            )
            return jsonify({'error': 'Preview not found'}), 404
            
        # Get file modification time for caching
        last_modified = os.path.getmtime(index_path)
        
        # Read and serve the HTML content
        with open(index_path, 'r', encoding='utf-8') as f:
            html_content = f.read()
            
        # Add scroll position preservation script
        scroll_script = """
        <script>
            // Store scroll position before unload
            window.addEventListener('beforeunload', function() {
                sessionStorage.setItem('scrollPos', window.scrollY);
            });
            
            // Restore scroll position after load
            window.addEventListener('load', function() {
                if (sessionStorage.getItem('scrollPos') !== null) {
                    window.scrollTo(0, parseInt(sessionStorage.getItem('scrollPos')));
                }
            });
        </script>
        """
        
        # Insert script before closing body tag
        html_content = html_content.replace('</body>', f'{scroll_script}</body>')
        
        StructuredLogger.info(
            'Serving HTML content',
            extra={
                'device_id': formatted_id,
                'content_size': len(html_content)
            }
        )
            
        response = make_response(html_content)
        response.headers['Content-Type'] = 'text/html'
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Last-Modified'] = str(last_modified)
        response.headers['Cache-Control'] = 'no-cache'
        return response
        
    except Exception as e:
        StructuredLogger.error(
            'Failed to get device preview',
            extra={'device_id': formatted_id},
            error=e
        )
        return jsonify({'error': str(e)}), 500

def get_device_static(device_id: str, filename: str) -> Tuple[Any, int]:
    """Serve static files (CSS, JS) for device preview."""
    try:
        device_id = SecurityUtils.validate_input(device_id, pattern_name='device_id')
        filename = SecurityUtils.validate_input(
            filename,
            pattern=r'^[\w\-./]+\.(css|js|png|jpg|jpeg|gif|svg|ico)$'
        )
        
        work_dir = get_device_work_dir(device_id)
        file_path = os.path.join(work_dir, filename)
        
        # Ensure file exists and is within work_dir
        if not os.path.exists(file_path) or not file_path.startswith(work_dir):
            StructuredLogger.error(
                'Static file not found or access denied',
                extra={'device_id': device_id, 'filename': filename}
            )
            return jsonify({'error': 'File not found'}), 404
            
        # Get file modification time for caching
        last_modified = os.path.getmtime(file_path)
        
        # Read and serve the file content
        with open(file_path, 'rb') as f:
            content = f.read()
            
        StructuredLogger.info(
            'Serving static file',
            extra={
                'device_id': device_id,
                'filename': filename,
                'size': len(content)
            }
        )
            
        response = make_response(content)
        response.headers['Content-Type'] = 'text/css' if filename.endswith('.css') else 'application/javascript'
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Last-Modified'] = str(last_modified)
        response.headers['Cache-Control'] = 'no-cache'
        return response
        
    except Exception as e:
        StructuredLogger.error(
            'Failed to serve static file',
            extra={'device_id': device_id, 'filename': filename},
            error=e
        )
        return jsonify({'error': str(e)}), 500
