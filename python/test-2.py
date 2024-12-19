import os
import time
import random
import datetime
import signal
import sys
import re
from typing import Dict, Any

import requests
from supabase import create_client, Client
from dotenv import load_dotenv

# Testing for antara script
# Here i am
# Leaving a comment for the world
# Load environment variables
load_dotenv()

# DEFAULT_CONFIG
DEFAULT_CONFIG = {
    'SUPABASE_URL': 'https://your-supabase-url.supabase.co',
    'SUPABASE_KEY': 'your-supabase-key',
    'DEVICE_ID': 'your-device-id',
    'USER_ID': 'your-user-id',
    'GITHUB_TOKEN': 'your-github-token',
    'REPO_URL': 'https://github.com/username/repo',
    'REPO_PATH': 'path/to/script.py',
    'REPO_BRANCH': 'main'
}

def validate_environment():
    """Validate required environment variables"""
    # Make sure environment variables are set from DEFAULT_CONFIG
    for key, value in DEFAULT_CONFIG.items():
        if not os.getenv(key):
            os.environ[key] = str(value)  # Convert all values to string

    required_vars = ['SUPABASE_URL', 'SUPABASE_KEY', 'DEVICE_ID', 'USER_ID']
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    if missing_vars:
        raise EnvironmentError(f"Missing required environment variables: {', '.join(missing_vars)}")
    
    # Print the first few characters of credentials for debugging
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_KEY')
    device_id = os.getenv('DEVICE_ID')
    user_id = os.getenv('USER_ID')
    github_token = os.getenv('GITHUB_TOKEN')
    repo_url = os.getenv('REPO_URL')
    repo_path = os.getenv('REPO_PATH')
    repo_branch = os.getenv('REPO_BRANCH')
    
    print("\nEnvironment Configuration:")
    print("--------------------------")
    print(f"Supabase URL: {supabase_url}")
    print(f"Supabase Key (first 10 chars): {supabase_key[:10]}...")
    print(f"Device ID: {device_id}")
    print(f"User ID: {user_id}")
    print(f"GitHub Token: {'Set' if github_token else 'Not Set'}")
    print(f"Repository URL: {repo_url}")
    print(f"Repository Path: {repo_path}")
    print(f"Repository Branch: {repo_branch}")
    print("--------------------------")

class DeviceController:
    def __init__(self, device_type: str, initial_value: float):
        """Initialize device controller with type and initial value"""
        self.device_type = device_type
        try:
            self.current_value = float(initial_value)
        except (TypeError, ValueError):
            print(f"Warning: Invalid initial value '{initial_value}', using 0.0")
            self.current_value = 0.0
        self.last_update = datetime.datetime.now()

    def update_value(self, current_time: datetime.datetime) -> float:
        """Update the device value based on device type"""
        hour = current_time.hour
        
        if self.device_type == 'Thermostat':
            return self._update_thermostat(hour)
        elif self.device_type == 'Light':
            return self._update_light(hour)
        elif self.device_type == 'Lock':
            return self._update_lock(hour)
        elif self.device_type == 'Camera':
            return self._update_camera(hour)
        else:
            return self.current_value

    def _update_thermostat(self, hour: int) -> float:
        """Update thermostat value based on time of day"""
        # Simulate temperature changes throughout the day
        if 0 <= hour < 6:  # Night
            target = 18.0
        elif 6 <= hour < 9:  # Morning
            target = 21.0
        elif 9 <= hour < 17:  # Day
            target = 23.0
        elif 17 <= hour < 22:  # Evening
            target = 22.0
        else:  # Late night
            target = 20.0
        
        # Add some random variation
        variation = random.uniform(-0.5, 0.5)
        new_value = target + variation
        
        # Gradually change the temperature
        if abs(new_value - self.current_value) > 0.5:
            if new_value > self.current_value:
                self.current_value += 0.5
            else:
                self.current_value -= 0.5
        else:
            self.current_value = new_value
        
        return round(self.current_value, 1)

    def _update_light(self, hour: int) -> float:
        """Update light value based on time of day"""
        # Simulate light changes throughout the day
        if 0 <= hour < 6:  # Night
            target = 0.0
        elif 6 <= hour < 9:  # Morning
            target = 60.0
        elif 9 <= hour < 17:  # Day
            target = 100.0
        elif 17 <= hour < 22:  # Evening
            target = 80.0
        else:  # Late night
            target = 20.0
        
        # Add some random variation
        variation = random.uniform(-5, 5)
        self.current_value = target + variation
        
        return round(max(0, min(100, self.current_value)), 1)

    def _update_lock(self, hour: int) -> float:
        """Update lock status based on time of day"""
        # Simulate lock status (0 = locked, 1 = unlocked)
        if 0 <= hour < 6:  # Night
            self.current_value = 0
        elif 6 <= hour < 9:  # Morning
            self.current_value = 1 if random.random() < 0.7 else 0
        elif 9 <= hour < 17:  # Day
            self.current_value = 0 if random.random() < 0.8 else 1
        elif 17 <= hour < 22:  # Evening
            self.current_value = 1 if random.random() < 0.6 else 0
        else:  # Late night
            self.current_value = 0
        
        return self.current_value

    def _update_camera(self, hour: int) -> float:
        """Update camera FPS based on time of day"""
        # Simulate camera FPS changes based on activity
        if 0 <= hour < 6:  # Night
            target = 5.0
        elif 6 <= hour < 9:  # Morning
            target = 15.0
        elif 9 <= hour < 17:  # Day
            target = 30.0
        elif 17 <= hour < 22:  # Evening
            target = 20.0
        else:  # Late night
            target = 10.0
        
        # Add some random variation
        variation = random.uniform(-2, 2)
        self.current_value = target + variation
        
        return round(max(1, self.current_value), 1)

class DeviceAutomationSystem:
    def __init__(self, device_config: Dict[str, Any]):
        """Initialize device automation system"""
        # Validate environment variables
        validate_environment()
        
        # Store GitHub configuration
        self.github_token = os.getenv('GITHUB_TOKEN')
        self.repo_url = os.getenv('REPO_URL')
        self.repo_path = os.getenv('REPO_PATH')
        self.repo_branch = os.getenv('REPO_BRANCH', 'main')
        self.last_commit_sha = None
        
        # Supabase configuration
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_KEY')
        
        print("\nInitializing Device Automation System")
        print("--------------------------------------")
        print("Configuration:")
        print(f"- Supabase URL: {self.supabase_url}")
        print(f"- Device ID: {device_config.get('id')}")
        print(f"- User ID: {device_config.get('user_id')}")
        print(f"- Device Type: {device_config.get('type')}")
        print(f"- Device Title: {device_config.get('title')}")
        print(f"- Initial Value: {device_config.get('value')}")
        print(f"- GitHub Token: {'Set' if self.github_token else 'Not Set'}")
        print(f"- Repository URL: {self.repo_url}")
        print(f"- Repository Path: {self.repo_path}")
        print(f"- Repository Branch: {self.repo_branch}")
        print("--------------------------------------")
        
        # Initialize Supabase client
        try:
            print("\nInitializing Supabase client...")
            self.supabase_client: Client = create_client(self.supabase_url, self.supabase_key)
            print("Supabase client initialized successfully")
        except Exception as e:
            print("Error initializing Supabase client:", str(e))
            raise
        
        # Dashboard connection configuration
        self.dashboard_url = os.getenv('DASHBOARD_URL', 'http://localhost:5173')
        print(f"\nDashboard URL: {self.dashboard_url}")
        
        # Device configuration
        self.device_config = device_config
        self.running = False
        self.connected = False
        self.retry_count = 0
        self.max_retries = 3
        self.retry_delay = 5  # seconds

    def init(self):
        """Initialize device automation and establish connection"""
        try:
            print(f"Initializing device {self.device_config['id']}...")
            
            # Try to establish connection
            while not self.connected and self.retry_count < self.max_retries:
                try:
                    self._check_dashboard_connection()
                    break
                except Exception as error:
                    self.retry_count += 1
                    if self.retry_count < self.max_retries:
                        print(f"Connection attempt {self.retry_count} failed: {error}")
                        print(f"Retrying in {self.retry_delay} seconds...")
                        time.sleep(self.retry_delay)
                    else:
                        print("Max retries reached. Could not establish connection.")
                        raise

            # Start device updates if connected
            if self.connected:
                self.running = True
                self._start_device_updates()
            else:
                raise RuntimeError("Failed to establish connection")

        except Exception as error:
            print(f'Initialization failed: {error}')
            self.stop()

    def _check_dashboard_connection(self):
        """Check connection to dashboard and update device status"""
        try:
            response = requests.get(self.dashboard_url)
            response.raise_for_status()
            
            # Update device status in Supabase upon successful connection
            current_time = datetime.datetime.now()
            device_id = self.device_config['id']
            user_id = self.device_config['user_id']
            print(f"\nAttempting to update device {device_id} for user {user_id} in Supabase...")
            
            try:
                # Debug Supabase connection
                print("Supabase URL:", self.supabase_url)
                print("Device Config:", self.device_config)
                
                # First check if device exists
                print("\nQuerying all devices in the database...")
                all_devices = self.supabase_client.table('devices') \
                    .select('*') \
                    .execute()
                
                print("\nAll devices in database:")
                for device in all_devices.data:
                    print(f"- Device ID: {device.get('id')}")
                    print(f"  User ID: {device.get('user_id')}")
                    print(f"  Title: {device.get('title')}")
                    print(f"  Type: {device.get('type')}")
                    print(f"  Status: {device.get('status')}")
                    print()
                
                print("\nLooking for specific device...")
                print(f"Searching for device_id={device_id} and user_id={user_id}")
                
                # Now check for specific device
                device_check = self.supabase_client.table('devices') \
                    .select('*') \
                    .eq('id', device_id) \
                    .eq('user_id', user_id) \
                    .execute()
                
                if not device_check.data:
                    print(f"Warning: Device {device_id} not found for user {user_id} in database!")
                    print("Please make sure:")
                    print("1. The device exists in the database")
                    print("2. The device ID is correct")
                    print("3. The user ID is correct")
                    print("4. You have the right permissions")
                    return
                
                print(f"Device found: {device_check.data[0]}")
                
                # Update the device status to online
                update_response = self.supabase_client.table('devices').update({
                    'status': 'online',
                    'updated_at': current_time.isoformat()
                }).eq('id', device_id).eq('user_id', user_id).execute()
                
                if update_response.data:
                    print(f"Successfully updated device status to online")
                else:
                    print(f"Failed to update device status")
                
            except Exception as supabase_error:
                print(f"Error updating Supabase: {supabase_error}")
                print(f"Error type: {type(supabase_error)}")
                raise
            
            print('Dashboard connection successful')
            self.connected = True
        except requests.RequestException as error:
            print(f'Could not connect to dashboard: {error}')
            raise RuntimeError('Dashboard connection failed')

    def _check_github_updates(self):
        """Check if there are any updates to the script in GitHub"""
        try:
            if not all([self.github_token, self.repo_url, self.repo_path]):
                print("\nSkipping GitHub check - missing configuration")
                return False

            print("\nChecking for GitHub updates...")
            
            # Parse repository information
            repo_match = re.search(r'github\.com/([^/]+)/([^/]+)', self.repo_url)
            if not repo_match:
                print("Invalid GitHub repository URL")
                return False
                
            owner, repo = repo_match.groups()
            path = self.repo_path.lstrip('/')
            
            # Construct GitHub API URL
            api_url = f"https://api.github.com/repos/{owner}/{repo}/commits"
            params = {'path': path, 'sha': self.repo_branch}
            
            # Make API request
            headers = {
                'Authorization': f'token {self.github_token}',
                'Accept': 'application/vnd.github.v3+json'
            }
            
            response = requests.get(api_url, params=params, headers=headers)
            response.raise_for_status()
            
            commits = response.json()
            if not commits:
                print("No commits found for this file")
                return False
                
            latest_commit = commits[0]
            latest_sha = latest_commit['sha']
            
            if self.last_commit_sha is None:
                self.last_commit_sha = latest_sha
                print(f"Initial commit SHA: {latest_sha[:8]}")
                return False
                
            if latest_sha != self.last_commit_sha:
                print("\nScript update detected!")
                print(f"Previous commit: {self.last_commit_sha[:8]}")
                print(f"New commit: {latest_sha[:8]}")
                print(f"Message: {latest_commit['commit']['message']}")
                self.last_commit_sha = latest_sha
                return True
                
            print("No updates found")
            return False
            
        except Exception as error:
            print(f"Error checking GitHub updates: {error}")
            return False

    def _start_device_updates(self):
        """Start periodic updates for the specific device"""
        while self.running:
            try:
                # Check for GitHub updates first
                if self._check_github_updates():
                    print("\nScript update detected - consider restarting the device")
                
                # Update device as usual
                self._update_device()
                # Sleep for 5 minutes between updates
                time.sleep(5 * 60)
            except Exception as error:
                print(f'Error in device update loop: {error}')
                # Wait a bit before retrying
                time.sleep(60)

    def stop(self):
        """Stop the device automation"""
        try:
            # Update device status to offline before stopping
            current_time = datetime.datetime.now()
            update_response = self.supabase_client.table('devices').update({
                'status': 'offline',
                'updated_at': current_time.isoformat()
            }).eq('id', self.device_config['id']).eq('user_id', self.device_config['user_id']).execute()
            
            if update_response.data:
                print(f"Successfully updated device status to offline")
            else:
                print(f"Failed to update device status to offline")
                
        except Exception as error:
            print(f"Error updating device status: {error}")
        
        self.running = False

    def _update_device(self):
        """Update the specific device"""
        try:
            # Check for GitHub updates first
            if self._check_github_updates():
                print("\nScript update detected - consider restarting the device")
            
            # Get current timestamp
            current_time = datetime.datetime.now()

            # Create device controller and update value
            controller = DeviceController(
                device_type=self.device_config['type'],
                initial_value=float(self.device_config['value'])
            )
            
            # Get new device value
            new_value = controller.update_value(current_time)
            
            # Notify dashboard about update
            self._notify_dashboard(new_value)
            
        except Exception as error:
            print(f'Error updating device: {error}')
            raise

    def _notify_dashboard(self, new_value: float):
        """Notify dashboard about device update"""
        try:
            # Update device value in Supabase
            current_time = datetime.datetime.now()
            update_response = self.supabase_client.table('devices').update({
                'value': str(new_value),
                'updated_at': current_time.isoformat()
            }).eq('id', self.device_config['id']).eq('user_id', self.device_config['user_id']).execute()
            
            if update_response.data:
                print(f"Successfully updated device value to {new_value}")
            else:
                print(f"Failed to update device value")
                
        except Exception as error:
            print(f"Error notifying dashboard: {error}")
            raise

def signal_handler(signum, frame):
    """Handle termination signals"""
    print('\nReceived signal to terminate')
    if 'device_system' in globals():
        device_system.stop()
    sys.exit(0)

def main():
    """Main execution function"""
    try:
        # Print startup message
        print(f"Starting device automation...")
        print(f"Device ID: {os.getenv('DEVICE_ID')}")
        print(f"User ID: {os.getenv('USER_ID')}")

        # Register signal handlers
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)

        # Create device configuration
        device_config = {
            'id': os.getenv('DEVICE_ID'),
            'user_id': os.getenv('USER_ID'),
            'type': os.getenv('DEVICE_TYPE', 'Thermostat'),
            'title': os.getenv('DEVICE_TITLE', 'Device'),
            'value': os.getenv('INITIAL_VALUE', '0')
        }

        # Create and initialize device automation system
        global device_system
        device_system = DeviceAutomationSystem(device_config)
        device_system.init()

    except Exception as error:
        print(f'Error in main: {error}')
        if 'device_system' in globals():
            device_system.stop()
        sys.exit(1)

if __name__ == '__main__':
    main()
