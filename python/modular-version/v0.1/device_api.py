"""Production-grade device API with GitLab integration."""

from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
from flask_socketio import SocketIO
from supabase import create_client
from os import environ
import traceback
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
import tempfile
import zipfile
import os
import shutil
import re
import json
import pandas as pd
from collections import defaultdict
from dotenv import load_dotenv

# Load environment variables from .env file
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
print(f'Looking for .env file at: {env_path}')
load_dotenv(env_path)

# Debug: Print environment variables
print('Environment variables:')
print(f'VITE_SUPABASE_URL exists: {"VITE_SUPABASE_URL" in environ}')
print(f'VITE_SUPABASE_ANON_KEY exists: {"VITE_SUPABASE_ANON_KEY" in environ}')

# Initialize Supabase client
supabase = None
if 'VITE_SUPABASE_URL' in environ and 'VITE_SUPABASE_ANON_KEY' in environ:
    supabase = create_client(
        environ['VITE_SUPABASE_URL'],
        environ['VITE_SUPABASE_ANON_KEY']
    )
    print('Successfully initialized Supabase client')
else:
    print('Warning: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables are required')

def is_valid_device_id(device_id: str) -> bool:
    """Validate device ID format (UUID)."""
    uuid_pattern = r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    return bool(re.match(uuid_pattern, device_id.lower()))

def get_device_config(device_id: str) -> Optional[Dict[str, Any]]:
    """Get device configuration.
    If Supabase is available, fetch from database, otherwise return default config."""
    try:
        if supabase:
            response = supabase.table('devices').select('*').eq('id', device_id).execute()
            if response.data and len(response.data) > 0:
                return response.data[0]
        
        # Return default config if no Supabase or device not found
        return {
            'id': device_id,
            'check_interval': 60,
            'auto_update': True
        }
    except Exception as e:
        StructuredLogger.error('Error fetching device config',
            extra={
                'device_id': device_id,
                'error': str(e)
            }
        )
        # Return default config on error
        return {
            'id': device_id,
            'check_interval': 60,
            'auto_update': True
        }
import threading
import asyncio
from typing import Any, Dict
from datetime import datetime

# Import production-grade utilities
from utils import StructuredLogger
from utils.retry_utils import RetryUtils
from utils.logging_utils import log_duration
from utils.security_utils import SecurityUtils
from utils.device_manager import (
    update_device_status, list_devices, start_device,
    stop_device, get_device_status, mark_all_devices_offline
)
from utils.preview_handler import get_device_preview, get_device_static
from utils.device_logs import get_device_logs
from utils.git_utils import monitor_gitlab_changes
from utils.workspace_utils import force_refresh, create_directory_if_not_exists, get_device_work_dir

# Initialize Flask app and CORS
app = Flask(__name__)
cors_origins = ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173']
CORS(app, resources={
    r"/*": {
        "origins": cors_origins,
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "If-Modified-Since"],
        "supports_credentials": True
    }
})

# Initialize SocketIO with CORS settings
socketio = SocketIO(app, cors_allowed_origins=cors_origins)

# Get CORS origin from environment
cors_origins = os.getenv('CORS_ORIGINS', 'http://localhost:3001').split(',')
StructuredLogger.info('Configured CORS origins', extra={'origins': cors_origins})

# Configure CORS with secure settings
CORS(app, 
     resources={r"/*": {
         "origins": cors_origins,
         "allow_headers": [
             "Content-Type",
             "Authorization",
             "Access-Control-Allow-Credentials",
             "If-Modified-Since"
         ],
         "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
         "supports_credentials": True,
         "expose_headers": ["Content-Range", "X-Content-Range", "Last-Modified"],
         "max_age": 3600
     }}
)

# Initialize SocketIO with production settings
socketio = SocketIO(
    app,
    cors_allowed_origins=cors_origins,
    async_mode='threading',
    logger=True,
    engineio_logger=True,
    ping_timeout=60000,
    ping_interval=25000
)

# API Routes
@app.route('/api/devices', methods=['GET'])
def get_devices():
    """Get all devices and their status."""
    return jsonify(list_devices())

@app.route('/api/devices/<device_id>/start', methods=['POST'])
def handle_start_device(device_id):
    """Start monitoring a specific device."""
    return jsonify(start_device(device_id))

@app.route('/api/devices/<device_id>/stop', methods=['POST'])
def handle_stop_device(device_id):
    """Stop monitoring a specific device."""
    return jsonify(stop_device(device_id))

@app.route('/api/devices/<device_id>/status', methods=['GET'])
def handle_device_status(device_id):
    """Get detailed status of a specific device."""
    return jsonify(get_device_status(device_id))

@app.route('/api/devices/<device_id>/preview', methods=['GET'])
def handle_device_preview(device_id):
    """Get the device's index.html preview."""
    return get_device_preview(device_id)

@app.route('/api/devices/<device_id>/static/<path:filename>', methods=['GET'])
def handle_device_static(device_id, filename):
    """Serve static files (CSS, JS) for device preview."""
    return get_device_static(device_id, filename)

@app.route('/api/devices/<device_id>/refresh', methods=['POST'])
def handle_force_refresh(device_id):
    """Force refresh of device files from GitLab."""
    return jsonify(force_refresh(device_id))

@app.route('/api/devices/<device_id>/logs', methods=['GET'])
def handle_device_logs(device_id):
    """Get logs for a specific device."""
    return jsonify(get_device_logs(device_id))

@app.route('/api/analytics/recent', methods=['GET'])
def get_recent_analytics():
    """Get recent analytics data for all devices"""
    try:
        minutes = request.args.get('minutes', default=30, type=int)
        time_threshold = (datetime.now() - timedelta(minutes=minutes)).isoformat()
        
        response = supabase.table('device_data')\
            .select('*')\
            .eq('data_type', 'status')\
            .gte('timestamp', time_threshold)\
            .execute()
            
        if not response.data:
            return jsonify({
                'message': 'No data available',
                'data': {}
            })
        
        df = pd.DataFrame(response.data)
        values = df['value'].astype(float)
        uptime_ratio = (values.sum() / len(values)) * 100
        
        analytics = {
            'current_status': 'Online' if float(df.iloc[-1]['value']) == 1 else 'Offline',
            'uptime_percentage': f"{uptime_ratio:.2f}%",
            'status_changes': str(len(values[values.diff() != 0])),
            'last_update': df.iloc[-1]['timestamp']
        }
        
        return jsonify({
            'message': 'Success',
            'data': {
                'status_data': response.data,
                'analytics': analytics
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/analytics/device/<device_id>', methods=['GET'])
def get_device_analytics(device_id):
    """Get analytics data for a specific device"""
    try:
        minutes = request.args.get('minutes', default=30, type=int)
        time_threshold = (datetime.now() - timedelta(minutes=minutes)).isoformat()
        
        response = supabase.table('device_data')\
            .select('*')\
            .eq('device_id', device_id)\
            .eq('data_type', 'status')\
            .gte('timestamp', time_threshold)\
            .execute()
            
        if not response.data:
            return jsonify({
                'message': 'No data available',
                'data': {
                    'status_data': [],
                    'analytics': {}
                }
            })
        
        df = pd.DataFrame(response.data)
        values = df['value'].astype(float)
        uptime_ratio = (values.sum() / len(values)) * 100
        
        analytics = {
            'current_status': 'Online' if float(df.iloc[-1]['value']) == 1 else 'Offline',
            'uptime_percentage': f"{uptime_ratio:.2f}%",
            'status_changes': str(len(values[values.diff() != 0])),
            'last_update': df.iloc[-1]['timestamp']
        }
        
        return jsonify({
            'message': 'Success',
            'data': {
                'status_data': response.data,
                'analytics': analytics
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/devices/<device_id>/download-script', methods=['GET'])
def handle_download_script(device_id):
    """Download the device script with configuration and dependencies."""
    try:
        # Validate device ID
        if not is_valid_device_id(device_id):
            return jsonify({'error': 'Invalid device ID format'}), 400
            
        # Check if device exists
        device = get_device_config(device_id)
        if not device:
            return jsonify({'error': 'Device not found'}), 404

        # Get the device's work directory
        device_dir = get_device_work_dir(device_id)
        os.makedirs(device_dir, exist_ok=True)
        
        # Define required files with metadata
        base_dir = os.path.dirname(os.path.abspath(__file__))
        python_dir = os.path.dirname(os.path.dirname(os.path.dirname(base_dir)))
        required_files = [
            {
                'filename': 'gitlab_controller.py',
                'path': os.path.join(base_dir, 'gitlab_controller.py'),
                'required': True,
                'description': 'Main controller script'
            },
            {
                'filename': 'gitlab_ota_manager.py',
                'path': os.path.join(base_dir, 'gitlab_ota_manager.py'),
                'required': True,
                'description': 'OTA update manager'
            },
            {
                'filename': 'gitlab_file_manager.py',
                'path': os.path.join(base_dir, 'gitlab_file_manager.py'),
                'required': True,
                'description': 'File operations manager'
            },
            {
                'filename': 'gitlab_connection_manager.py',
                'path': os.path.join(base_dir, 'gitlab_connection_manager.py'),
                'required': True,
                'description': 'Supabase connection manager'
            },
            {
                'filename': 'gitlab_file_monitor.py',
                'path': os.path.join(base_dir, 'gitlab_file_monitor.py'),  # Look in the current directory
                'required': True,
                'description': 'File change monitor'
            },
            {
                'filename': 'gitlab_version_checker.py',
                'path': os.path.join(base_dir, 'gitlab_version_checker.py'),
                'required': True,
                'description': 'Version check utility'
            },
            {
                'filename': 'current_logger.py',
                'path': os.path.join(base_dir, 'current_logger.py'),
                'required': True,
                'description': 'Logging utility'
            }
        ]
        
        # First, copy gitlab_file_monitor.py to the current directory if it doesn't exist
        monitor_file = next(f for f in required_files if f['filename'] == 'gitlab_file_monitor.py')
        local_monitor_path = os.path.join(base_dir, monitor_file['filename'])
        if not os.path.exists(local_monitor_path):
            shutil.copy2(monitor_file['path'], local_monitor_path)
            monitor_file['path'] = local_monitor_path  # Update the path to use local copy
        
        # Verify all required files exist
        missing_files = []
        for file_info in required_files:
            if file_info['required'] and not os.path.exists(file_info['path']):
                missing_files.append(file_info['filename'])
        
        if missing_files:
            error_msg = f"Missing required files: {', '.join(missing_files)}"
            StructuredLogger.error('Missing required files for download',
                extra={
                    'device_id': device_id,
                    'missing_files': missing_files
                }
            )
            return jsonify({'error': error_msg}), 500

        # Create a requirements.txt file
        requirements_path = os.path.join(device_dir, 'requirements.txt')
        with open(requirements_path, 'w') as f:
            f.write('# Python dependencies for device script\n')
            f.write('requests>=2.25.1\n')
            f.write('python-dotenv>=0.19.0\n')
            f.write('supabase>=0.7.1\n')
            f.write('GitPython>=3.1.30\n')

        # Create device config file
        config = {
            'device_id': device_id,
            'api_url': request.host_url.rstrip('/'),
            'check_interval': device.get('check_interval', 60),
            'auto_update': device.get('auto_update', True)
        }
        config_path = os.path.join(device_dir, 'device_config.json')
        with open(config_path, 'w') as f:
            json.dump(config, f, indent=4)

        # Create a temporary zip file with cleanup
        with tempfile.NamedTemporaryFile(suffix='.zip', delete=False) as temp_zip:
            try:
                with zipfile.ZipFile(temp_zip.name, 'w', zipfile.ZIP_DEFLATED) as zf:
                    # Add all Python files
                    for file_info in required_files:
                        if os.path.exists(file_info['path']):
                            zf.write(file_info['path'], file_info['filename'])
                            StructuredLogger.info('Added file to zip',
                                extra={
                                    'file': file_info['filename'],
                                    'description': file_info['description']
                                }
                            )
                    
                    # Add requirements.txt and config
                    zf.write(requirements_path, 'requirements.txt')
                    zf.write(config_path, 'device_config.json')
                    
                    # Add README with instructions
                    readme_content = f"""# Device Script Package

This package contains the following components:

## Python Scripts
{chr(10).join(f'- {f["filename"]}: {f["description"]}' for f in required_files)}

## Configuration
- device_config.json: Device-specific configuration
- requirements.txt: Python package dependencies

## Setup Instructions
1. Install dependencies: pip install -r requirements.txt
2. Ensure all files are in the same directory
3. Run: python gitlab_controller.py
"""
                    zf.writestr('README.md', readme_content)

                # Log the successful download
                StructuredLogger.info('Device scripts package created',
                    extra={
                        'device_id': device_id,
                        'timestamp': datetime.now().isoformat(),
                        'file_count': len(required_files) + 3  # +3 for requirements.txt, config.json, and README.md
                    }
                )
                
                # Send the zip file
                return send_file(
                    temp_zip.name,
                    as_attachment=True,
                    download_name=f'device-scripts-{device_id}.zip',
                    mimetype='application/zip'
                )
            finally:
                # Clean up temporary files
                try:
                    os.unlink(requirements_path)
                    os.unlink(config_path)
                except Exception as e:
                    StructuredLogger.warning('Error cleaning up temporary files',
                        extra={'error': str(e)}
                    )
        
    except Exception as e:
        StructuredLogger.error('Error creating device script package',
            extra={
                'device_id': device_id,
                'error': str(e),
                'traceback': traceback.format_exc()
            }
        )
        return jsonify({
            'error': 'Failed to create device script package',
            'details': str(e)
        }), 500
        
    except Exception as e:
        StructuredLogger.error(
            'Error downloading device script',
            extra={'device_id': device_id, 'error': str(e)}
        )
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Mark all devices as offline on startup
    mark_all_devices_offline()
    
    # Start GitLab monitoring thread
    monitor_thread = threading.Thread(target=monitor_gitlab_changes, daemon=True)
    monitor_thread.start()
    StructuredLogger.info("Started GitLab monitoring thread")
    
    # Start Flask server
    socketio.run(app, host='0.0.0.0', port=5001, allow_unsafe_werkzeug=True)

# Create necessary directories
base_dir = os.path.dirname(os.path.abspath(__file__))
create_directory_if_not_exists(os.path.join(base_dir, 'workspaces'))
create_directory_if_not_exists(os.path.join(base_dir, 'backups'))
create_directory_if_not_exists(os.path.join(base_dir, 'shared_repos'))

@app.after_request
def after_request(response):
    """Add CORS headers to all responses."""
    for origin in cors_origins:
        response.headers['Access-Control-Allow-Origin'] = origin
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, If-Modified-Since'
    return response

def run_async(coroutine) -> Any:
    """Run an async function in a synchronous context."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coroutine)
    finally:
        loop.close()

def format_device_id(device_id: str) -> str:
    """Format device ID for workspace path."""
    return SecurityUtils.validate_input(
        device_id.lower(),
        pattern_name='device_id'
    )

@RetryUtils.with_retries(max_attempts=3)
async def get_devices_with_github() -> Dict[str, Any]:
    """Fetch all devices that have GitHub configuration."""
    try:
        response = supabase.table('devices').select('*').not_.is_('repo_url', 'null').execute()
        devices = {device['id']: device for device in response.data}
        StructuredLogger.info(
            'Found devices with GitHub configuration',
            extra={
                'count': len(devices),
                'device_ids': list(devices.keys())
            }
        )
        return devices
    except Exception as e:
        StructuredLogger.error(
            'Failed to fetch devices',
            error=e
        )
        return {}

def get_shared_repo_dir() -> str:
    """Get the shared repository directory."""
    app_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(app_dir, 'shared_repo')

def get_device_work_dir(device_id: str) -> str:
    """Get the working directory for a device."""
    app_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(app_dir, 'device_workspaces', device_id)

@log_duration
def setup_device_workspace(device_id: str, device: Dict[str, Any]) -> str:
    """Set up a clean workspace for the device."""
    # Validate inputs
    device_id = SecurityUtils.validate_input(device_id, pattern_name='device_id')
    work_dir = get_device_work_dir(device_id)
    
    try:
        with AtomicUtils.atomic_operation(f'setup_workspace_{device_id}') as temp_dir:
            # Remove existing workspace if it exists
            if os.path.exists(work_dir):
                StructuredLogger.info(
                    'Removing existing workspace',
                    extra={'device_id': device_id}
                )
                shutil.rmtree(work_dir)
            
            # Create workspace and templates directory with secure permissions
            templates_dir = os.path.join(work_dir, 'src', 'templates')
            SecurityUtils.secure_directory(templates_dir)
            
            StructuredLogger.info(
                'Created fresh workspace',
                extra={
                    'device_id': device_id,
                    'work_dir': work_dir
                }
            )
            
            return work_dir
            
    except Exception as e:
        StructuredLogger.error(
            'Failed to setup workspace',
            extra={'device_id': device_id},
            error=e
        )
        raise

@RetryUtils.with_retries(max_attempts=3)
def get_current_commit_sha(repo_dir: str, branch: str = 'main') -> str:
    """Get the current commit SHA for a repository."""
    try:
        # Validate inputs
        repo_dir = SecurityUtils.validate_input(repo_dir, pattern_name='path')
        branch = SecurityUtils.validate_input(branch, pattern_name='branch')
        
        result = subprocess.run(
            ['git', 'rev-parse', f'origin/{branch}'],
            cwd=repo_dir,
            capture_output=True,
            text=True,
            check=True
        )
        
        commit_sha = result.stdout.strip()
        if not re.match(SecurityUtils.PATTERNS['sha'], commit_sha):
            raise ValueError(f'Invalid commit SHA format: {commit_sha}')
            
        StructuredLogger.info(
            'Got commit SHA',
            extra={
                'repo_dir': repo_dir,
                'branch': branch,
                'commit_sha': commit_sha
            }
        )
        return commit_sha
        
    except Exception as e:
        StructuredLogger.error(
            'Failed to get commit SHA',
            extra={
                'repo_dir': repo_dir,
                'branch': branch
            },
            error=e
        )
        return ''

@log_duration
def backup_workspace(device_id: str) -> bool:
    """Create a backup of the device workspace with improved error handling and permissions management."""
    try:
        # Validate input
        device_id = SecurityUtils.validate_input(device_id, pattern_name='device_id')
        work_dir = get_device_work_dir(device_id)
        
        # Check source directory
        if not os.path.exists(work_dir):
            StructuredLogger.info(
                'No workspace to backup',
                extra={'device_id': device_id}
            )
            return True
            
        if not os.access(work_dir, os.R_OK):
            StructuredLogger.error(
                'No read permission for workspace',
                extra={'device_id': device_id, 'work_dir': work_dir}
            )
            return False
        
        # Setup backup directory
        app_dir = os.path.dirname(os.path.abspath(__file__))
        backups_dir = os.path.join(app_dir, 'device_backups', device_id)
        
        # Ensure backup directory exists with correct permissions
        os.makedirs(backups_dir, mode=0o750, exist_ok=True)
        
        # Use atomic operation for safe backup
        with AtomicUtils.atomic_operation(f'backup_{device_id}') as temp_dir:
            try:
                # Create timestamped backup
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                backup_path = os.path.join(backups_dir, f'backup_{timestamp}')
                
                # Copy files with progress tracking
                total_files = sum(len(files) for _, _, files in os.walk(work_dir))
                copied_files = 0
                
                def copy_with_progress(src, dst, *, follow_symlinks=True):
                    nonlocal copied_files
                    copied_files += 1
                    shutil.copy2(src, dst, follow_symlinks=follow_symlinks)
                    logger.debug(f'Backup progress: {copied_files}/{total_files} files')
                
                # Perform the backup with custom copy function
                shutil.copytree(
                    work_dir,
                    backup_path,
                    copy_function=copy_with_progress,
                    dirs_exist_ok=True
                )
                
                logger.info(f'Successfully created backup at {backup_path}')
                return True
            except Exception as e:
                logger.error(f'Failed to create backup for device {device_id}: {str(e)}')
                return False
            
    except Exception as e:
        StructuredLogger.error(
            'Failed to create backup',
            extra={'device_id': device_id},
            error=e
        )
        return False

@RetryUtils.with_retries(max_attempts=3)
@log_duration
def clone_or_pull_repo(device_id: str, repo_url: str, branch: str = 'main') -> bool:
    """Clone or pull repository for a device and copy files."""
    try:
        # Validate inputs
        device_id = SecurityUtils.validate_input(device_id, pattern_name='device_id')
        repo_url = SecurityUtils.validate_input(repo_url, pattern_name='repo_url')
        branch = SecurityUtils.validate_input(branch, pattern_name='branch')
        
        shared_repo = get_shared_repo_dir()
        git_dir = os.path.join(shared_repo, '.git')
        work_dir = get_device_work_dir(device_id)
        
        # Get GitLab credentials
        gitlab_username = os.getenv('GITLAB_USERNAME')
        gitlab_token = os.getenv('GITLAB_TOKEN')
        
        if not gitlab_username or not gitlab_token:
            raise EnvironmentError('GitLab credentials not found in environment')
        
        # Add credentials to URL
        parsed = urlparse(repo_url)
        auth_url = parsed._replace(
            netloc=f"{gitlab_username}:{gitlab_token}@{parsed.netloc}"
        )
        auth_repo_url = urlunparse(auth_url)
        
        changes_detected = False
        
        # Use file lock for git operations
        lock_file = os.path.join(shared_repo, '.git', 'cascade.lock')
        
        with AtomicUtils.file_lock(lock_file, f'git_{device_id}'):
            if os.path.exists(git_dir):
                # Update existing repository
                StructuredLogger.info(
                    'Updating existing repository',
                    extra={
                        'device_id': device_id,
                        'branch': branch
                    }
                )
                
                # Configure git
                subprocess.run(
                    ['git', 'config', 'credential.helper', 'store'],
                    cwd=shared_repo,
                    check=True
                )
                
                # Fetch and reset to origin
                subprocess.run(
                    ['git', 'fetch', 'origin'],
                    cwd=shared_repo,
                    check=True
                )
                
                subprocess.run(
                    ['git', 'reset', '--hard', f'origin/{branch}'],
                    cwd=shared_repo,
                    check=True
                )
                
                changes_detected = True
                
            else:
                # Clone new repository
                StructuredLogger.info(
                    'Cloning new repository',
                    extra={
                        'device_id': device_id,
                        'branch': branch
                    }
                )
                
                # Clear directory if it exists
                if os.path.exists(shared_repo):
                    shutil.rmtree(shared_repo)
                
                # Clone repository
                subprocess.run(
                    ['git', 'clone', '-b', branch, auth_repo_url, shared_repo],
                    check=True
                )
                
                changes_detected = True
            
            # Update commit information
            commit_sha = get_current_commit_sha(shared_repo, branch)
            if commit_sha:
                supabase.table('devices').update(
                    {'last_commit_sha': commit_sha}
                ).eq('id', device_id).execute()
                
                StructuredLogger.info(
                    'Updated commit information',
                    extra={
                        'device_id': device_id,
                        'commit_sha': commit_sha
                    }
                )
        
        # Handle workspace files
        if changes_detected:
            # Create backup
            if not backup_workspace(device_id):
                StructuredLogger.warning(
                    'Failed to create backup',
                    extra={'device_id': device_id}
                )
            
            # Copy templates
            with AtomicUtils.atomic_operation(f'copy_templates_{device_id}') as temp_dir:
                src_templates = os.path.join(shared_repo, 'src', 'templates')
                dst_templates = os.path.join(work_dir, 'src', 'templates')
                
                if os.path.exists(src_templates):
                    # Secure the templates directory
                    SecurityUtils.secure_directory(dst_templates)
                    
                    # Copy files atomically
                    temp_templates = os.path.join(temp_dir, 'templates')
                    shutil.copytree(src_templates, temp_templates)
                    
                    if os.path.exists(dst_templates):
                        shutil.rmtree(dst_templates)
                    shutil.move(temp_templates, dst_templates)
                    
                    StructuredLogger.info(
                        'Copied template files',
                        extra={
                            'device_id': device_id,
                            'template_count': len(os.listdir(src_templates))
                        }
                    )
        
        return changes_detected
        
    except Exception as e:
        StructuredLogger.error(
            'Failed to update repository',
            extra={
                'device_id': device_id,
                'repo_url': repo_url,
                'branch': branch
            },
            error=e
        )
        return False

# Store running controllers
running_controllers = {}

# Initialize Supabase client if credentials are available
supabase_url = environ.get('SUPABASE_URL')
supabase_key = environ.get('SUPABASE_KEY')
supabase = None
if supabase_url and supabase_key:
    try:
        supabase = create_client(supabase_url, supabase_key)
    except Exception as e:
        StructuredLogger.warning(
            'Failed to initialize Supabase client',
            error=e
        )

# Store device logs
device_logs = {}

def add_device_log(device_id: str, message: str):
    """Add a log message for a device."""
    if device_id not in device_logs:
        device_logs[device_id] = []
    device_logs[device_id].append({
        'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
        'message': message
    })
    # Keep only last 100 logs
    device_logs[device_id] = device_logs[device_id][-100:]

@RetryUtils.with_retries(max_attempts=3)
@log_duration
def update_device_status(device_id: str, status: str, details: str = None) -> None:
    """Update device status in the database."""
    try:
        # Validate inputs
        device_id = SecurityUtils.validate_input(device_id, pattern_name='device_id')
        status = SecurityUtils.validate_input(
            status,
            pattern=r'^(ONLINE|OFFLINE|ERROR|UPDATING|SCRIPT_DOWNLOADED)$'
        )
        if details:
            details = SecurityUtils.validate_input(
                details,
                max_length=500  # Reasonable limit for status messages
            )
        
        # Add status change to device logs
        log_message = f"Status changed to {status}" + (f": {details}" if details else "")
        add_device_log(device_id, log_message)
        
        # Update Supabase if available
        if supabase:
            try:
                update_data = {'status': status}
                supabase.table('devices').update(update_data).eq('id', device_id).execute()
            except Exception as e:
                StructuredLogger.warning(
                    'Failed to update device status in Supabase',
                    extra={
                        'device_id': device_id,
                        'status': status,
                        'details': details
                    },
                    error=e
                )
        
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
            extra={
                'device_id': device_id,
                'status': status,
                'details': details
            },
            error=e
        )
        raise

@app.route('/api/devices', methods=['GET'])
def list_devices():
    """Get all devices and their status."""
    devices = run_async(get_devices_with_github())
    
    device_status = {}
    for device_id, device in devices.items():
        status = {
            'id': device_id,
            'is_running': device_id in running_controllers,
            'has_github': bool(device.get('github_token')),
            'status': device.get('status', 'OFFLINE')
        }
        device_status[device_id] = status
    
    return jsonify(device_status)

@app.route('/api/devices/<device_id>/start', methods=['POST'])
def start_device(device_id):
    """Start monitoring a specific device."""
    try:
        devices = run_async(get_devices_with_github())
        
        if device_id not in devices:
            return jsonify({'error': 'Device not found or no GitHub configuration'}), 404
            
        if device_id in running_controllers:
            add_device_log(device_id, "Controller already running")
            return jsonify({'message': 'Controller already running'})
            
        # Set up workspace
        device = devices[device_id]
        work_dir = setup_device_workspace(device_id, device)
        
        # Initial clone/pull
        if clone_or_pull_repo(device_id, device['repo_url'], device.get('repo_branch', 'main')):
            log_with_timestamp(f"Initial repository setup complete for device {device_id}")
            add_device_log(device_id, "Initial repository setup complete")
        
        # Mark as running
        running_controllers[device_id] = True
        update_device_status(device_id, 'ONLINE', 'Controller started')
        add_device_log(device_id, "Controller started")
        
        return jsonify({'message': f'Started controller for device {device_id}'})
    except Exception as e:
        error_msg = str(e)
        log_with_timestamp(f"Error starting device {device_id}: {error_msg}")
        add_device_log(device_id, f"Error starting controller: {error_msg}")
        return jsonify({'error': error_msg}), 500

@app.route('/api/devices/<device_id>/stop', methods=['POST'])
def stop_device(device_id):
    """Stop monitoring a specific device."""
    try:
        devices = run_async(get_devices_with_github())
        if device_id not in devices:
            return jsonify({'error': 'Device not found'}), 404
            
        # Always update status to OFFLINE
        update_device_status(device_id, 'OFFLINE', 'Controller stopped')
        add_device_log(device_id, "Controller stopped")
            
        if device_id not in running_controllers:
            log_with_timestamp(f"Device {device_id} is not running")
            add_device_log(device_id, "Controller was not running")
            return jsonify({'message': 'Controller is not running'})
            
        # Remove from running controllers
        running_controllers.pop(device_id, None)
        
        return jsonify({'message': f'Stopped controller for device {device_id}'})
    except Exception as e:
        error_msg = str(e)
        log_with_timestamp(f"Error stopping device {device_id}: {error_msg}")
        add_device_log(device_id, f"Error stopping controller: {error_msg}")
        return jsonify({'error': error_msg}), 500

@app.route('/api/devices/<device_id>/status', methods=['GET'])
def get_device_status(device_id):
    """Get detailed status of a specific device."""
    try:
        # Check if device exists
        devices = run_async(get_devices_with_github())
        if device_id not in devices:
            return jsonify({'error': 'Device not found'}), 404
            
        device = devices[device_id]
        
        status = {
            'status': device.get('status', 'OFFLINE'),
            'is_running': device_id in running_controllers
        }
            
        return jsonify(status)
    except Exception as e:
        log_with_timestamp(f"Error getting status: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/devices/<device_id>/preview', methods=['GET'])
@log_duration
def get_device_preview(device_id):
    """Get the device's index.html preview."""
    try:
        # Format the device ID
        formatted_id = SecurityUtils.validate_input(device_id, pattern_name='device_id')
        formatted_id = format_device_id(formatted_id)
        
        StructuredLogger.info(
            'Getting device preview',
            extra={'device_id': formatted_id}
        )
        
        # Check if device exists
        devices = run_async(get_devices_with_github())
        if device_id not in devices:
            StructuredLogger.warning(
                'Device not found',
                extra={'device_id': formatted_id}
            )
            return jsonify({'error': 'Device not found'}), 404
            
        # Get the device's workspace path
        current_dir = os.path.dirname(os.path.abspath(__file__))
        workspace_dir = os.path.join(current_dir, 'device_workspaces', formatted_id)
        template_dir = os.path.join(workspace_dir, 'src', 'templates')
        
        StructuredLogger.debug(
            'Looking for templates',
            extra={
                'device_id': formatted_id,
                'template_dir': template_dir
            }
        )
        
        # If workspace doesn't exist, use default template
        if not os.path.exists(template_dir):
            template_dir = os.path.join(current_dir, 'src', 'templates')
            StructuredLogger.info(
                'Using default template',
                extra={
                    'device_id': formatted_id,
                    'template_dir': template_dir
                }
            )
            
        # Read HTML content
        html_path = os.path.join(template_dir, 'index.html')
        
        if not os.path.exists(html_path):
            StructuredLogger.warning(
                'Template not found',
                extra={
                    'device_id': formatted_id,
                    'html_path': html_path
                }
            )
            return jsonify({'error': 'Template not found'}), 404
            
        # Get last modified time
        last_modified = os.path.getmtime(html_path)
            
        # Check if client has a newer version
        if_modified_since = request.headers.get('If-Modified-Since')
        if if_modified_since:
            try:
                if_modified_since = float(if_modified_since)
                if if_modified_since >= last_modified:
                    return '', 304  # Not Modified
            except ValueError:
                StructuredLogger.warning(
                    'Invalid If-Modified-Since header',
                    extra={
                        'device_id': formatted_id,
                        'if_modified_since': if_modified_since
                    }
                )
            
        with open(html_path, 'r') as f:
            html_content = f.read()
            
        # Update relative paths to absolute paths
        base_url = f'/api/devices/{formatted_id}/static'
        html_content = html_content.replace('href="./style.css"', f'href="{base_url}/style.css"')
        html_content = html_content.replace('src="./script.js"', f'src="{base_url}/script.js"')
        
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

@app.route('/api/devices/<device_id>/static/<path:filename>', methods=['GET'])
def get_device_static(device_id, filename):
    """Serve static files (CSS, JS) for device preview."""
    try:
        # Format the device ID
        formatted_id = format_device_id(device_id)
        log_with_timestamp(f"Getting static file {filename} for device: {formatted_id}")
        
        # Get the device's workspace path
        current_dir = os.path.dirname(os.path.abspath(__file__))
        workspace_dir = os.path.join(current_dir, 'device_workspaces', formatted_id)
        static_path = os.path.join(workspace_dir, 'src', 'templates', filename)
        
        log_with_timestamp(f"Looking for static file at: {static_path}")
        
        # If file doesn't exist in workspace, use template
        if not os.path.exists(static_path):
            template_path = os.path.join(current_dir, 'src', 'templates', filename)
            log_with_timestamp(f"Static file not found in workspace, trying template: {template_path}")
            
            if not os.path.exists(template_path):
                log_with_timestamp(f"Static file not found in template dir: {template_path}")
                return jsonify({'error': f'File {filename} not found'}), 404
                
            static_path = template_path
            
        # Determine content type
        content_type = 'text/css' if filename.endswith('.css') else 'text/javascript' if filename.endswith('.js') else 'text/plain'
            
        # Read and return the file content
        with open(static_path, 'r') as f:
            content = f.read()
            
        log_with_timestamp(f"Serving {filename} with size: {len(content)} bytes")
            
        response = make_response(content)
        response.headers['Content-Type'] = content_type
        response.headers['Access-Control-Allow-Origin'] = '*'
        return response
        
    except Exception as e:
        log_with_timestamp(f"Error serving static file {filename} for device {formatted_id}: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/devices/<device_id>/refresh', methods=['POST'])
def force_refresh(device_id):
    """Force refresh of device files from GitLab."""
    try:
        # Format device ID
        formatted_id = format_device_id(device_id)
        
        # Get device info
        devices = run_async(get_devices_with_github())
        if device_id not in devices:
            return jsonify({'error': 'Device not found'}), 404
            
        device = devices[device_id]
        
        # Force update
        if clone_or_pull_repo(formatted_id, device['repo_url'], device.get('repo_branch', 'main')):
            socketio.emit('device_updated', {'device_id': device_id})
            return jsonify({'message': 'Device refreshed successfully'})
        else:
            return jsonify({'message': 'No changes detected'})
            
    except Exception as e:
        log_with_timestamp(f"Error refreshing device {formatted_id}: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/devices/<device_id>/logs', methods=['GET'])
def get_device_logs(device_id):
    """Get logs for a specific device."""
    try:
        # Check if device exists
        devices = run_async(get_devices_with_github())
        if device_id not in devices:
            return jsonify({'error': 'Device not found'}), 404
            
        # Get logs or empty list if none exist
        device_log_entries = device_logs.get(device_id, [])
        
        # Format logs as expected by frontend
        formatted_logs = {
            'stdout': [f"[{entry['timestamp']}] {entry['message']}" for entry in device_log_entries],
            'stderr': []
        }
        
        return jsonify(formatted_logs)
    except Exception as e:
        log_with_timestamp(f"Error getting logs for device {device_id}: {str(e)}")
        return jsonify({'error': str(e)}), 500

@log_duration
def monitor_gitlab_changes() -> None:
    """Background thread to monitor GitLab changes."""
    while True:
        try:
            # Get all devices with GitLab configuration
            devices = run_async(get_devices_with_github())
            
            StructuredLogger.info(
                'Starting GitLab polling cycle',
                extra={'device_count': len(devices)}
            )
            
            for device_id, device in devices.items():
                try:
                    # Format device ID
                    formatted_id = format_device_id(device_id)
                    
                    # Set up or update workspace
                    work_dir = setup_device_workspace(device_id, device)
                    
                    # Check if we need to update
                    if clone_or_pull_repo(formatted_id, device['repo_url'], device.get('repo_branch', 'main')):
                        StructuredLogger.info(
                            'Changes detected for device',
                            extra={
                                'device_id': formatted_id,
                                'repo_url': device['repo_url'],
                                'branch': device.get('repo_branch', 'main')
                            }
                        )
                        # Notify frontend about the update
                        socketio.emit('device_updated', {'device_id': device_id})
                    
                except Exception as device_error:
                    StructuredLogger.error(
                        'Failed to monitor device',
                        extra={
                            'device_id': device_id,
                            'repo_url': device.get('repo_url'),
                            'branch': device.get('repo_branch', 'main')
                        },
                        error=device_error
                    )
            
            # Wait before next check
            time.sleep(10)  # Check every 10 seconds
            
        except Exception as e:
            StructuredLogger.error(
                'Error in monitoring thread',
                error=e
            )
            time.sleep(10)  # Wait before retrying

@RetryUtils.with_retries(max_attempts=3)
@log_duration
def mark_all_devices_offline() -> None:
    """Mark all devices as offline during server startup."""
    try:
        devices = run_async(get_devices_with_github())
        
        StructuredLogger.info(
            'Marking all devices as offline',
            extra={'device_count': len(devices)}
        )
        
        for device_id in devices:
            try:
                update_device_status(device_id, 'OFFLINE', 'Server restarted')
            except Exception as device_error:
                StructuredLogger.error(
                    'Failed to mark device as offline',
                    extra={'device_id': device_id},
                    error=device_error
                )
                # Continue with other devices even if one fails
                continue
        
        StructuredLogger.info('Successfully marked all devices as offline')
        
    except Exception as e:
        StructuredLogger.error(
            'Failed to mark devices as offline',
            error=e
        )
        raise

if __name__ == '__main__':
    # Mark all devices as offline on startup
    mark_all_devices_offline()
    
    # Start GitLab monitoring thread
    monitor_thread = threading.Thread(target=monitor_gitlab_changes, daemon=True)
    monitor_thread.start()
    StructuredLogger.info("Started GitLab monitoring thread")
    
    # Start Flask server
    socketio.run(app, host='0.0.0.0', port=5001, allow_unsafe_werkzeug=True)