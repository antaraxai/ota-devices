import os
import time
import random
import datetime
import signal
import sys
from typing import Dict, Any

import requests
from supabase import create_client, Client
from dotenv import load_dotenv

# Device Configuration
DEFAULT_CONFIG = {
    'SUPABASE_URL': 'https://hdodriygzudamnqqbluy.supabase.co',
    'SUPABASE_KEY': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhkb2RyaXlnenVkYW1ucXFibHV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjM3MTEwNjgsImV4cCI6MjAzOTI4NzA2OH0.zDGFdgBFqsgm0wOKWIl9ehyvY8cMvE87-TZhrZyE8IM',
    'DEVICE_ID': 'd26c83ca-6f61-49a4-94ba-ee00ebae6830',
    'USER_ID': 'b877f0c8-8bd7-49fb-9608-fd47f9da23cf',
    'DEVICE_TYPE': 'Thermostat',
    'DEVICE_TITLE': 'Test_01',
    'INITIAL_VALUE': '0',
    'DASHBOARD_URL': 'http://127.0.0.1:5173'
}

# Load environment variables
load_dotenv()

# Set environment variables from DEFAULT_CONFIG if not already set
for key, value in DEFAULT_CONFIG.items():
    if not os.getenv(key):
        os.environ[key] = value

def validate_environment():
    """Validate required environment variables"""
    required_vars = ['SUPABASE_URL', 'SUPABASE_KEY', 'DEVICE_ID', 'USER_ID']
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    if missing_vars:
        raise EnvironmentError(f"Missing required environment variables: {', '.join(missing_vars)}")
    
    # Print the first few characters of credentials for debugging
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_KEY')
    device_id = os.getenv('DEVICE_ID')
    user_id = os.getenv('USER_ID')
    print(f"Supabase URL: {supabase_url}")
    print(f"Supabase Key (first 10 chars): {supabase_key[:10]}...")
    print(f"Device ID: {device_id}")
    print(f"User ID: {user_id}")

class DeviceController:
    def __init__(self, device_type: str, initial_value: float):
        """Initialize device controller with type and initial value"""
        self.device_type = device_type
        self.current_value = initial_value
        self.last_update = datetime.datetime.now()

    def update_value(self, current_time: datetime.datetime) -> float:
        """Update device value based on time of day"""
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
        if hour >= 22 or hour < 6:
            # Night time - cooler
            return 19 + random.random() * 2
        elif 12 <= hour < 18:
            # Afternoon - warmer
            return 22 + random.random() * 2
        else:
            # Morning/Evening - moderate
            return 20 + random.random() * 2

    def _update_light(self, hour: int) -> float:
        """Update light value based on time of day"""
        if hour >= 22 or hour < 6:
            # Night time - dim
            return random.random() * 100
        elif 10 <= hour < 16:
            # Daytime - bright
            return 800 + random.random() * 200
        else:
            # Morning/Evening - moderate
            return 400 + random.random() * 200

    def _update_lock(self, hour: int) -> float:
        """Update lock status based on time of day"""
        if hour >= 23 or hour < 6:
            # Night time - locked
            return 100
        elif 9 <= hour < 18:
            # Daytime - varies
            return 100 if random.random() > 0.7 else 0
        else:
            # Evening - mostly locked
            return 100 if random.random() > 0.2 else 0

    def _update_camera(self, hour: int) -> float:
        """Update camera FPS based on time of day"""
        if hour >= 22 or hour < 6:
            # Night time - lower FPS
            return 15 + random.random() * 5
        else:
            # Daytime - higher FPS
            return 25 + random.random() * 5

class DeviceAutomationSystem:
    def __init__(self, device_config: Dict[str, Any]):
        """Initialize device automation system"""
        # Validate environment variables
        validate_environment()
        
        # Supabase configuration
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_KEY')
        
        # Initialize Supabase client
        self.supabase_client: Client = create_client(self.supabase_url, self.supabase_key)
        
        # Dashboard connection configuration
        self.dashboard_url = os.getenv('DASHBOARD_URL', 'http://localhost:5173')
        
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
            raise

    def _check_dashboard_connection(self):
        """Check connection to dashboard and update device status"""
        try:
            response = requests.get(self.dashboard_url)
            response.raise_for_status()
            
            # Update device status in Supabase upon successful connection
            current_time = datetime.datetime.now()
            device_id = self.device_config['id']
            user_id = self.device_config['user_id']
            
            try:
                # First check if device exists
                device_check = self.supabase_client.table('devices')                     .select('*')                     .eq('id', device_id)                     .eq('user_id', user_id)                     .execute()
                
                if not device_check.data:
                    print(f"Warning: Device {device_id} not found for user {user_id} in database!")
                    return
                
                # Update the device status to online
                update_response = self.supabase_client.table('devices')                     .update({
                        'status': 'online',
                        'updated_at': current_time.isoformat()
                    })                     .eq('id', device_id)                     .eq('user_id', user_id)                     .execute()
                
                if update_response.data:
                    print(f"Successfully updated device status to online")
                else:
                    print(f"Failed to update device status")
                
            except Exception as supabase_error:
                print(f"Error updating Supabase: {supabase_error}")
                raise
            
            print('Dashboard connection successful')
            self.connected = True
        except requests.RequestException as error:
            print(f'Could not connect to dashboard: {error}')
            raise RuntimeError('Dashboard connection failed')

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

    def _start_device_updates(self):
        """Start periodic updates for the specific device"""
        while self.running:
            try:
                self._update_device()
                # Sleep for 5 minutes between updates
                time.sleep(5 * 60)
            except Exception as error:
                print(f'Error in device update loop: {error}')
                # Wait a bit before retrying
                time.sleep(60)

    def _update_device(self):
        """Update the specific device"""
        try:
            # Get current timestamp
            current_time = datetime.datetime.now()

            # Create device controller and update value
            controller = DeviceController(
                self.device_config['type'], 
                self.device_config.get('initial_value', 0)
            )
            new_value = controller.update_value(current_time)

            # Update device in Supabase
            response = self.supabase_client.table('devices').update({
                'value': new_value,
                'updated_at': current_time.isoformat()
            }).eq('id', self.device_config['id']).eq('user_id', self.device_config['user_id']).execute()
            
            if response.data:
                print(f"Device {self.device_config['id']} updated to {new_value}")
            else:
                print(f"Failed to update device value")

        except Exception as error:
            print(f"Error updating device {self.device_config['id']}: {error}")

def signal_handler(signum, frame):
    """Handle termination signals"""
    print("\nReceived signal to terminate. Shutting down gracefully...")
    if 'automation_system' in globals():
        automation_system.stop()
    sys.exit(0)

def main():
    """Main execution function"""
    try:
        # Register signal handlers
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)

        # Get device ID and user ID from environment
        device_id = os.getenv('DEVICE_ID')
        user_id = os.getenv('USER_ID')
        if not device_id or not user_id:
            print("Error: DEVICE_ID and USER_ID are required")
            sys.exit(1)

        # Device configuration
        device_config = {
            'id': device_id,
            'user_id': user_id,
            'type': os.getenv('DEVICE_TYPE', DEFAULT_CONFIG['DEVICE_TYPE']),
            'initial_value': float(os.getenv('INITIAL_VALUE', DEFAULT_CONFIG['INITIAL_VALUE'])),
            'title': os.getenv('DEVICE_TITLE', DEFAULT_CONFIG['DEVICE_TITLE'])
        }

        print(f"Starting device automation for {device_config['type']} device:")
        print(f"  - Device ID: {device_config['id']}")
        print(f"  - User ID: {device_config['user_id']}")
        print(f"  - Title: {device_config['title']}")
        print(f"  - Initial Value: {device_config['initial_value']}")

        # Create and initialize device automation system
        global automation_system
        automation_system = DeviceAutomationSystem(device_config)
        
        try:
            # Initialize the automation system
            automation_system.init()
            
            # Keep the script running until interrupted
            print("Device automation running. Press Ctrl+C to stop.")
            while True:
                time.sleep(1)
                
        except KeyboardInterrupt:
            print("\nStopping device automation...")
        finally:
            if automation_system:
                automation_system.stop()
                
    except Exception as error:
        print(f"Error in main: {error}")
        if 'automation_system' in globals():
            automation_system.stop()
        sys.exit(1)

if __name__ == '__main__':
    main()
