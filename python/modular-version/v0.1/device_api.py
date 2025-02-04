from flask import Flask, jsonify, request, make_response
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import os
import json
import asyncio
import threading
import time
import re
import subprocess
import shutil
from datetime import datetime
from supabase import create_client, Client
from dotenv import load_dotenv
from urllib.parse import urlparse, urlunparse

# Load environment variables
load_dotenv()

# Initialize Supabase client
supabase_url = os.getenv("VITE_SUPABASE_URL")
supabase_key = os.getenv("VITE_SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

app = Flask(__name__)

# Get CORS origin from environment or default to localhost
cors_origin = os.getenv('CORS_ORIGIN', 'http://localhost:3001')

# Configure CORS with more permissive settings
CORS(app, 
     resources={r"/*": {
         "origins": ["*"],  # Allow all origins temporarily for debugging
         "allow_headers": ["Content-Type", "Authorization", "Access-Control-Allow-Credentials", "If-Modified-Since"],
         "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
         "supports_credentials": True,
         "expose_headers": ["Content-Range", "X-Content-Range", "Last-Modified"]
     }},
     supports_credentials=True
)

# Configure Socket.IO with CORS
socketio = SocketIO(
    app,
    cors_allowed_origins=["http://localhost:3001"],
    async_mode='threading',
    logger=True,
    engineio_logger=True,
    ping_timeout=60000,
    ping_interval=25000
)

def add_cors_headers(response):
    """Add CORS headers to the response."""
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, If-Modified-Since'
    return response

@app.after_request
def after_request(response):
    """Add CORS headers to all responses."""
    return add_cors_headers(response)

def log_with_timestamp(message: str):
    """Print a message with a timestamp."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")

def run_async(coroutine):
    """Run an async function in a synchronous context."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coroutine)
    finally:
        loop.close()

def format_device_id(device_id: str) -> str:
    """Format device ID for workspace path."""
    return re.sub(r'[^a-z0-9-]', '', device_id.lower())

async def get_devices_with_github():
    """Fetch all devices that have GitHub configuration."""
    try:
        response = supabase.table('devices').select('*').not_.is_('repo_url', 'null').execute()
        devices = {device['id']: device for device in response.data}
        log_with_timestamp(f"[POLL] Found {len(devices)} devices with GitHub configuration")
        return devices
    except Exception as e:
        log_with_timestamp(f"[ERROR] Error fetching devices: {str(e)}")
        return {}

def get_shared_repo_dir() -> str:
    """Get the shared repository directory."""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(current_dir, 'shared_repo')

def get_device_work_dir(device_id: str) -> str:
    """Get the working directory for a device."""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    work_dir = os.path.join(current_dir, 'device_workspaces', device_id)
    return work_dir

def setup_device_workspace(device_id: str, device: dict) -> str:
    """Set up a clean workspace for the device."""
    work_dir = get_device_work_dir(device_id)
    
    # Remove existing workspace if it exists
    if os.path.exists(work_dir):
        log_with_timestamp(f"[INFO] Removing existing workspace for device {device_id}")
        shutil.rmtree(work_dir)
    
    # Create workspace and templates directory
    templates_dir = os.path.join(work_dir, 'src', 'templates')
    os.makedirs(templates_dir, exist_ok=True)
    log_with_timestamp(f"[INFO] Created fresh workspace for device {device_id}")
    
    return work_dir

def clone_or_pull_repo(device_id: str, repo_url: str, branch: str = 'main') -> bool:
    """Clone or pull repository for a device and copy files."""
    try:
        shared_repo = get_shared_repo_dir()
        git_dir = os.path.join(shared_repo, '.git')
        work_dir = get_device_work_dir(device_id)
        
        # Add GitLab credentials to URL
        gitlab_username = os.getenv('GITLAB_USERNAME')
        gitlab_token = os.getenv('GITLAB_TOKEN')
        
        if not gitlab_username or not gitlab_token:
            log_with_timestamp("[ERROR] GitLab credentials not found in environment")
            return False

        # Parse and add credentials to URL
        parsed = urlparse(repo_url)
        auth_url = parsed._replace(
            netloc=f"{gitlab_username}:{gitlab_token}@{parsed.netloc}"
        )
        auth_repo_url = urlunparse(auth_url)
        log_with_timestamp(f"[INFO] Created authenticated URL for {device_id}")
        
        changes_detected = False
        
        # First, handle the shared repository
        if os.path.exists(git_dir):
            # Repository exists, force pull updates
            log_with_timestamp(f"[INFO] Pulling updates for shared repo")
            
            # Set git config for auth
            subprocess.run(['git', 'config', '--global', 'credential.helper', 'store'], capture_output=True)
            
            # Fetch and reset hard to origin
            subprocess.run(['git', 'fetch', 'origin'], cwd=shared_repo, capture_output=True)
            result = subprocess.run(
                ['git', 'reset', '--hard', f'origin/{branch}'],
                cwd=shared_repo,
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0:
                changes_detected = True
                log_with_timestamp("[SUCCESS] Changes pulled successfully")
            else:
                log_with_timestamp(f"[ERROR] Error pulling changes: {result.stderr}")
                return False
        else:
            # Repository doesn't exist, clone it
            log_with_timestamp(f"[INFO] Cloning repository to shared location")
            # Clear directory if it exists
            if os.path.exists(shared_repo):
                shutil.rmtree(shared_repo)
            
            # Set git config globally
            subprocess.run(['git', 'config', '--global', 'credential.helper', 'store'], capture_output=True)
            
            # Clone without force flag
            result = subprocess.run(
                ['git', 'clone', '-b', branch, auth_repo_url, shared_repo],
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0:
                log_with_timestamp("[SUCCESS] Repository cloned successfully")
                changes_detected = True
            else:
                log_with_timestamp(f"[ERROR] Error cloning repository: {result.stderr}")
                return False
        
        # Copy files to device workspace
        src_templates = os.path.join(shared_repo, 'src', 'templates')
        dst_templates = os.path.join(work_dir, 'src', 'templates')
        
        if os.path.exists(src_templates):
            # Create destination directory if it doesn't exist
            os.makedirs(dst_templates, exist_ok=True)
            
            # Remove old files
            for item in os.listdir(dst_templates):
                item_path = os.path.join(dst_templates, item)
                if os.path.isfile(item_path):
                    os.remove(item_path)
            
            # Copy new files
            for item in os.listdir(src_templates):
                src_path = os.path.join(src_templates, item)
                dst_path = os.path.join(dst_templates, item)
                if os.path.isfile(src_path):
                    shutil.copy2(src_path, dst_path)
                    log_with_timestamp(f"Copied {item} to device workspace")
                    changes_detected = True
        
        return changes_detected
                
    except Exception as e:
        log_with_timestamp(f"Error in clone_or_pull_repo: {str(e)}")
        return False

# Store running controllers
running_controllers = {}

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

def update_device_status(device_id: str, status: str, details: str = None):
    """Update device status in the database."""
    try:
        update_data = {'status': status}
        supabase.table('devices').update(update_data).eq('id', device_id).execute()
        log_with_timestamp(f"Updated device {device_id} status to {status}")
        # Add status change to device logs
        add_device_log(device_id, f"Status changed to {status}" + (f": {details}" if details else ""))
    except Exception as e:
        log_with_timestamp(f"Error updating device status: {str(e)}")

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
def get_device_preview(device_id):
    """Get the device's index.html preview."""
    try:
        # Format the device ID
        formatted_id = format_device_id(device_id)
        log_with_timestamp(f"Getting preview for device: {formatted_id}")
        
        # Check if device exists
        devices = run_async(get_devices_with_github())
        if device_id not in devices:
            log_with_timestamp(f"Device {formatted_id} not found")
            return jsonify({'error': 'Device not found'}), 404
            
        # Get the device's workspace path
        current_dir = os.path.dirname(os.path.abspath(__file__))
        workspace_dir = os.path.join(current_dir, 'device_workspaces', formatted_id)
        template_dir = os.path.join(workspace_dir, 'src', 'templates')
        
        log_with_timestamp(f"Looking for templates in: {template_dir}")
        
        # If workspace doesn't exist, use default template
        if not os.path.exists(template_dir):
            template_dir = os.path.join(current_dir, 'src', 'templates')
            log_with_timestamp(f"Workspace not found, using default template: {template_dir}")
            
        # Read HTML content
        html_path = os.path.join(template_dir, 'index.html')
        log_with_timestamp(f"Reading HTML from: {html_path}")
        
        if not os.path.exists(html_path):
            log_with_timestamp(f"HTML file not found at: {html_path}")
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
                pass
            
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
        
        log_with_timestamp(f"Serving HTML with size: {len(html_content)} bytes")
            
        response = make_response(html_content)
        response.headers['Content-Type'] = 'text/html'
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Last-Modified'] = str(last_modified)
        response.headers['Cache-Control'] = 'no-cache'
        return response
        
    except Exception as e:
        log_with_timestamp(f"Error getting preview for device {formatted_id}: {str(e)}")
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

def monitor_gitlab_changes():
    """Background thread to monitor GitLab changes."""
    while True:
        try:
            # Get all devices with GitLab configuration
            devices = run_async(get_devices_with_github())
            log_with_timestamp(f"[POLL] Found {len(devices)} devices with GitHub configuration")
            
            for device_id, device in devices.items():
                try:
                    # Format device ID
                    formatted_id = format_device_id(device_id)
                    
                    # Set up or update workspace
                    work_dir = setup_device_workspace(device_id, device)
                    
                    # Check if we need to update
                    if clone_or_pull_repo(formatted_id, device['repo_url'], device.get('repo_branch', 'main')):
                        log_with_timestamp(f"[UPDATE] Changes detected for device {formatted_id}")
                        # Notify frontend about the update
                        socketio.emit('device_updated', {'device_id': device_id})
                    
                except Exception as e:
                    log_with_timestamp(f"[ERROR] Error monitoring device {device_id}: {str(e)}")
            
            # Wait before next check
            time.sleep(10)  # Check every 10 seconds
            
        except Exception as e:
            log_with_timestamp(f"[ERROR] Error in monitoring thread: {str(e)}")
            time.sleep(10)  # Wait before retrying

def mark_all_devices_offline():
    """Mark all devices as offline during server startup."""
    try:
        devices = run_async(get_devices_with_github())
        for device_id in devices:
            update_device_status(device_id, 'OFFLINE', 'Server restarted')
        log_with_timestamp(f"Marked {len(devices)} devices as offline")
    except Exception as e:
        log_with_timestamp(f"Error marking devices offline: {str(e)}")

if __name__ == '__main__':
    # Mark all devices as offline on startup
    mark_all_devices_offline()
    
    # Start GitLab monitoring thread
    monitor_thread = threading.Thread(target=monitor_gitlab_changes, daemon=True)
    monitor_thread.start()
    log_with_timestamp("Started GitLab monitoring thread")
    
    # Start Flask server
    socketio.run(app, host='0.0.0.0', port=5001, allow_unsafe_werkzeug=True)
