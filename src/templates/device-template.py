import os
import time
import datetime
import requests
from typing import Dict, Any
from supabase import create_client, Client

# Device Configuration - These values will be replaced by the frontend
SUPABASE_URL = "{{SUPABASE_URL}}"
SUPABASE_KEY = "{{SUPABASE_KEY}}"
DEVICE_ID = "{{DEVICE_ID}}"
DEVICE_TYPE = "{{DEVICE_TYPE}}"
DEVICE_TITLE = "{{DEVICE_TITLE}}"
API_URL = "{{API_URL}}"  # This will be set to http://localhost:5173

class DeviceManager:
    def __init__(self):
        # Device configuration
        self.device_id = DEVICE_ID
        self.device_type = DEVICE_TYPE
        self.device_title = DEVICE_TITLE
        self.api_url = API_URL
        
        # Initialize Supabase client
        try:
            self.supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
            print("Successfully connected to Supabase")
        except Exception as e:
            print(f"Failed to connect to Supabase: {e}")
            raise
        
        self.online = False
        self.retry_count = 0
        self.max_retries = 3
        self.retry_delay = 5

    def check_localhost(self) -> bool:
        """Check if localhost:5173 is accessible"""
        try:
            print(f"Attempting to connect to {self.api_url}...")
            # Try to connect to localhost
            response = requests.get(self.api_url)
            print(f"Response status code: {response.status_code}")
            if response.status_code == 200:
                print("Successfully connected to localhost")
                return True
            else:
                print(f"Failed to connect. Status code: {response.status_code}")
                return False
        except Exception as error:
            print(f"Failed to connect to localhost: {error}")
            return False

    def update_device_status(self, online: bool):
        """Update device status in Supabase"""
        try:
            print(f"Updating device status to {'online' if online else 'offline'}...")
            # Update device status and value
            data = {
                'status': 'online' if online else 'offline',
                'value': 1 if online else 0,
                'updated_at': datetime.datetime.now().isoformat()
            }
            print(f"Sending update to Supabase: {data}")
            result = self.supabase_client.table('devices').update(data).eq('id', self.device_id).execute()
            print(f"Supabase update result: {result}")
            
            print(f"Device status updated in Supabase: {'online' if online else 'offline'}")
            self.online = online
            
        except Exception as error:
            print(f"Failed to update device status in Supabase: {error}")
            raise

    def run(self):
        """Main run loop"""
        print(f"Starting device: {self.device_title} ({self.device_type})")
        print(f"Connecting to dashboard at: {self.api_url}")
        
        while not self.online and self.retry_count < self.max_retries:
            try:
                # Try to connect to localhost
                if self.check_localhost():
                    # Update device status in Supabase
                    self.update_device_status(True)
                    print("Device is now online and connected")
                    break
                else:
                    raise Exception("Failed to connect to localhost")
                
            except Exception as error:
                self.retry_count += 1
                if self.retry_count < self.max_retries:
                    print(f"Connection attempt {self.retry_count} failed: {error}")
                    print(f"Retrying in {self.retry_delay} seconds...")
                    time.sleep(self.retry_delay)
                else:
                    print("Max retries reached. Could not establish connection.")
                    return

        try:
            # Keep checking the connection
            while self.online:
                time.sleep(5)  # Check connection every 5 seconds
                if not self.check_localhost():
                    print("Lost connection to localhost")
                    self.update_device_status(False)
                    break
                    
        except KeyboardInterrupt:
            print("\nReceived keyboard interrupt. Shutting down...")
        finally:
            # Update status to offline before exiting
            if self.online:
                self.update_device_status(False)
            print("Device stopped.")

def main():
    device = DeviceManager()
    device.run()

if __name__ == "__main__":
    main()
