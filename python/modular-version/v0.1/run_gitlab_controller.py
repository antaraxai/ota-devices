import os
import json
import asyncio
import subprocess
from supabase import create_client, Client
from dotenv import load_dotenv
from typing import Dict, Optional
import time
from datetime import datetime
import shutil

# Load environment variables
load_dotenv()

# Initialize Supabase client
supabase_url = os.getenv("VITE_SUPABASE_URL")
supabase_key = os.getenv("VITE_SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

# Store running processes
running_processes: Dict[str, subprocess.Popen] = {}

def log_with_timestamp(message: str):
    """Print a message with a timestamp."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")

def get_device_work_dir(device_id: str) -> str:
    """Get the working directory for a device."""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    work_dir = os.path.join(current_dir, 'device_workspaces', device_id)
    return work_dir

def setup_device_workspace(device_id: str, device: dict) -> str:
    """Set up a clean workspace for the device."""
    work_dir = get_device_work_dir(device_id)
    
    # Clean up existing workspace if it exists
    if os.path.exists(work_dir):
        try:
            shutil.rmtree(work_dir)
        except Exception as e:
            log_with_timestamp(f"[WARN] Error cleaning workspace: {str(e)}")
    
    # Create fresh workspace
    os.makedirs(work_dir, exist_ok=True)
    
    # Clone the repository if repo_url is available
    if device.get('repo_url'):
        try:
            subprocess.run([
                'git', 'clone',
                device['repo_url'],
                work_dir
            ], check=True, capture_output=True, text=True)
            
            # Set up Git configuration in the workspace
            subprocess.run(['git', 'config', 'user.name', 'GitLab Controller'], cwd=work_dir)
            subprocess.run(['git', 'config', 'user.email', 'controller@example.com'], cwd=work_dir)
            
            log_with_timestamp(f"[INFO] Repository cloned successfully for device {device_id}")
        except subprocess.CalledProcessError as e:
            log_with_timestamp(f"[ERROR] Failed to clone repository: {e.stderr}")
    
    return work_dir

async def get_devices_with_github():
    """Fetch all devices that have GitHub configuration."""
    try:
        response = supabase.table('devices').select('*').not_.is_('github_token', 'null').execute()
        devices = {device['id']: device for device in response.data}
        log_with_timestamp(f"[POLL] Found {len(devices)} devices with GitHub configuration")
        return devices
    except Exception as e:
        log_with_timestamp(f"[ERROR] Error fetching devices: {str(e)}")
        return {}

def start_gitlab_controller(device_id: str, device: dict) -> Optional[subprocess.Popen]:
    """Start the GitLab controller for a specific device."""
    try:
        if device_id in running_processes:
            log_with_timestamp(f"[INFO] Controller already running for device {device_id}")
            return None

        # Set up workspace for the device
        work_dir = setup_device_workspace(device_id, device)
        
        device_token = device['github_token']
        
        # Prepare the config
        config = {
            'supabase_url': supabase_url,
            'supabase_key': supabase_key,
            'device_token': device_token,
            'work_dir': work_dir
        }
        
        # Get the absolute path to gitlab_controller.py
        current_dir = os.path.dirname(os.path.abspath(__file__))
        controller_path = os.path.join(current_dir, 'gitlab_controller.py')
        
        log_with_timestamp(f"[START] Starting GitLab controller for device {device_id}...")
        
        # Create log files for the process
        logs_dir = os.path.join(current_dir, 'logs')
        os.makedirs(logs_dir, exist_ok=True)
        stdout_file = open(os.path.join(logs_dir, f'controller_{device_id}.log'), 'a')
        stderr_file = open(os.path.join(logs_dir, f'controller_{device_id}.err'), 'a')
        
        # Run the GitLab controller as a subprocess
        process = subprocess.Popen([
            'python3',
            controller_path,
            '--device-id', device_id,
            '--config', json.dumps(config)
        ], stdout=stdout_file, stderr=stderr_file, cwd=work_dir)
        
        # Store the file handles with the process
        process.stdout_file = stdout_file
        process.stderr_file = stderr_file
        process.work_dir = work_dir
        
        log_with_timestamp(f"[SUCCESS] Started GitLab controller for device {device_id}")
        return process
        
    except Exception as e:
        log_with_timestamp(f"[ERROR] Error starting controller for device {device_id}: {str(e)}")
        return None

def stop_gitlab_controller(device_id: str):
    """Stop the GitLab controller for a specific device."""
    if device_id in running_processes:
        log_with_timestamp(f"[STOP] Stopping GitLab controller for device {device_id}...")
        process = running_processes[device_id]
        try:
            # Close log files
            if hasattr(process, 'stdout_file'):
                process.stdout_file.close()
            if hasattr(process, 'stderr_file'):
                process.stderr_file.close()
            
            process.terminate()
            process.wait(timeout=5)  # Wait up to 5 seconds for graceful termination
        except subprocess.TimeoutExpired:
            log_with_timestamp(f"[WARN] Force killing controller for device {device_id}")
            process.kill()  # Force kill if it doesn't terminate
            
        # Clean up workspace
        if hasattr(process, 'work_dir') and os.path.exists(process.work_dir):
            try:
                shutil.rmtree(process.work_dir)
                log_with_timestamp(f"[INFO] Cleaned up workspace for device {device_id}")
            except Exception as e:
                log_with_timestamp(f"[WARN] Error cleaning workspace: {str(e)}")
        
        log_with_timestamp(f"[SUCCESS] Stopped GitLab controller for device {device_id}")
        del running_processes[device_id]

async def check_process_status(device_id: str, process: subprocess.Popen):
    """Check if a process is still running and handle termination."""
    try:
        if process.poll() is not None:  # Process has terminated
            log_with_timestamp(f"[WARN] Process for device {device_id} has terminated")
            if device_id in running_processes:
                del running_processes[device_id]
            return False
        return True
    except Exception as e:
        log_with_timestamp(f"[ERROR] Error checking process for device {device_id}: {str(e)}")
        return False

async def poll_and_update():
    """Poll Supabase and update controllers."""
    try:
        log_with_timestamp("[POLL] Polling Supabase for device updates...")
        
        # Get current devices from Supabase
        current_devices = await get_devices_with_github()
        
        # Check all running processes first
        for device_id in list(running_processes.keys()):
            process = running_processes[device_id]
            is_running = await check_process_status(device_id, process)
            if not is_running:
                continue
                
            if (device_id not in current_devices or 
                current_devices[device_id]['github_token'] != getattr(process, 'github_token', None)):
                stop_gitlab_controller(device_id)
        
        # Start controllers for new devices
        for device_id, device in current_devices.items():
            if device_id not in running_processes:
                process = start_gitlab_controller(device_id, device)
                if process:
                    running_processes[device_id] = process
                    process.github_token = device['github_token']  # Store token for comparison
        
        log_with_timestamp(f"[STATUS] Currently running {len(running_processes)} controllers")
        
    except Exception as e:
        log_with_timestamp(f"[ERROR] Error in poll_and_update: {str(e)}")

async def manage_controllers():
    """Main loop to manage GitLab controllers."""
    log_with_timestamp("[START] Starting GitLab controller manager...")
    log_with_timestamp("[INFO] Will poll Supabase every 10 seconds for device updates")
    
    while True:
        try:
            await poll_and_update()
            await asyncio.sleep(10)  # Poll every 10 seconds
        except Exception as e:
            log_with_timestamp(f"[ERROR] Error in manage_controllers: {str(e)}")
            await asyncio.sleep(10)  # Wait before retrying

async def main():
    """Main function to run the controller manager."""
    try:
        await manage_controllers()
    except KeyboardInterrupt:
        log_with_timestamp("[SHUTDOWN] Shutting down all controllers...")
        for device_id in list(running_processes.keys()):
            stop_gitlab_controller(device_id)
        log_with_timestamp("[SHUTDOWN] All controllers stopped")
    except Exception as e:
        log_with_timestamp(f"[ERROR] Fatal error in main function: {str(e)}")

if __name__ == "__main__":
    try:
        # Run the main function
        asyncio.run(main())
    except KeyboardInterrupt:
        # The cleanup will be handled by the main function
        pass
    except Exception as e:
        log_with_timestamp(f"[ERROR] Error running main: {str(e)}")
