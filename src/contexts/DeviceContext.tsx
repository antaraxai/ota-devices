import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Device, CreateDeviceInput } from '../types/device';
import { useAuth } from './AuthContext';
import { toast } from 'react-toastify';

interface DeviceContextType {
  devices: Device[];
  loading: boolean;
  createDevice: (input: CreateDeviceInput) => Promise<Device>;
  updateDevice: (id: string, updates: Partial<CreateDeviceInput>) => Promise<Device>;
  deleteDevice: (id: string) => Promise<void>;
  refreshDevices: () => Promise<void>;
  toggleAutoUpdate: (id: string, value: boolean) => Promise<void>;
  downloadGitHubFile: (deviceId: string) => Promise<string>;
  updateGitHubConfig: (id: string, config: Partial<CreateDeviceInput>) => Promise<void>;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export function DeviceProvider({ children }: { children: React.ReactNode }) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const refreshDevices = async () => {
    try {
      if (!user) return;

      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setDevices(data || []);
    } catch (error) {
      toast.error('Failed to fetch devices');
      console.error('Error fetching devices:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      refreshDevices();
    }
  }, [user]);

  const createDevice = async (input: CreateDeviceInput): Promise<Device> => {
    try {
      if (!user) throw new Error('User not authenticated');

      const newDevice = {
        ...input,
        user_id: user.id,
        status: 'Normal' as const,
      };

      const { data, error } = await supabase
        .from('devices')
        .insert([newDevice])
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('Failed to create device');

      setDevices(prev => [data, ...prev]);
      toast.success('Device created successfully');
      return data;
    } catch (error) {
      toast.error('Failed to create device');
      throw error;
    }
  };

  const updateDevice = async (id: string, updates: Partial<CreateDeviceInput>): Promise<Device> => {
    try {
      const { data, error } = await supabase
        .from('devices')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user?.id)
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('Failed to update device');

      setDevices(prev => prev.map(device => 
        device.id === id ? data : device
      ));
      
      toast.success('Device updated successfully');
      return data;
    } catch (error) {
      toast.error('Failed to update device');
      throw error;
    }
  };

  const deleteDevice = async (id: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from('devices')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id);

      if (error) throw error;

      setDevices(prev => prev.filter(device => device.id !== id));
      toast.success('Device deleted successfully');
    } catch (error) {
      toast.error('Failed to delete device');
      throw error;
    }
  };

  const toggleAutoUpdate = async (id: string, value: boolean) => {
    try {
      const { data, error } = await supabase
        .from('devices')
        .update({ auto_update: value })
        .eq('id', id)
        .eq('user_id', user?.id)
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('Failed to update device');

      setDevices(prev => prev.map(device => 
        device.id === id ? data : device
      ));
      
      toast.success(`Auto-update ${value ? 'enabled' : 'disabled'}`);
    } catch (error) {
      toast.error('Failed to update auto-update setting');
      throw error;
    }
  };

  const downloadGitHubFile = async (deviceId: string): Promise<string> => {
    try {
      // Refresh device data to get the latest configuration
      const { data: updatedDevice, error: refreshError } = await supabase
        .from('devices')
        .select('*')
        .eq('id', deviceId)
        .eq('user_id', user?.id)
        .single();

      if (refreshError || !updatedDevice) {
        throw new Error('Failed to refresh device data');
      }

      // Get Supabase configuration
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase configuration');
      }

      // Create the config script content
      const configScript = `import os
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
    'SUPABASE_URL': '${supabaseUrl}',
    'SUPABASE_KEY': '${supabaseKey}',
    'DEVICE_ID': '${updatedDevice.id}',
    'USER_ID': '${user?.id}',
    'DEVICE_TYPE': '${updatedDevice.type}',
    'DEVICE_TITLE': '${updatedDevice.title}',
    'INITIAL_VALUE': '${updatedDevice.value}',
    'DASHBOARD_URL': '${window.location.origin}',
    'DEVICE_TOKEN': '${updatedDevice.device_token || ''}',
    'GITHUB_TOKEN': '${updatedDevice.github_token || ''}',
    'REPO_URL': '${updatedDevice.repo_url || ''}',
    'REPO_PATH': '${updatedDevice.repo_path || ''}',
    'REPO_BRANCH': '${updatedDevice.repo_branch || 'main'}'
}

# Load environment variables
load_dotenv()

# Set environment variables from DEFAULT_CONFIG if not already set
for key, value in DEFAULT_CONFIG.items():
    if not os.getenv(key):
        os.environ[key] = str(value)  // Convert all values to string

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

class DeviceAutomationSystem:
    def __init__(self, device_config: Dict[str, Any]):
        """Initialize device automation system"""
        # Validate environment variables
        validate_environment()
        
        # Store GitHub configuration
        self.github_token = os.getenv('GITHUB_TOKEN')
        self.repo_url = device_config.get('repo_url')
        self.repo_path = device_config.get('repo_path')
        self.repo_branch = device_config.get('repo_branch', 'main')
        self.last_commit_sha = None
        
        # Supabase configuration
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_KEY')
        
        print("\\nInitializing Device Automation System")
        print("--------------------------------------")
        print("Configuration:")
        print(f"- Supabase URL: {self.supabase_url}")
        print(f"- Device ID: {device_config.get('id')}")
        print(f"- User ID: {device_config.get('user_id')}")
        print(f"- Device Type: {device_config.get('type')}")
        print(f"- Device Title: {device_config.get('title')}")
        print(f"- Initial Value: {device_config.get('value')}")
        print(f"- GitHub Token: {self.github_token}")
        print(f"- Repository URL: {self.repo_url}")
        print(f"- Repository Path: {self.repo_path}")
        print(f"- Repository Branch: {self.repo_branch}")
        print("--------------------------------------")
        
        # Initialize Supabase client
        try:
            print("\\nInitializing Supabase client...")
            self.supabase_client: Client = create_client(self.supabase_url, self.supabase_key)
            print("Supabase client initialized successfully")
        except Exception as e:
            print("Error initializing Supabase client:", str(e))
            raise
        
        # Sign in as device user
        try:
            device_token = os.getenv('DEVICE_TOKEN')
            if device_token:
                print("\\nAttempting to authenticate with device token...")
                self.supabase_client.auth.set_session(device_token)
                print("Successfully authenticated with Supabase")
            else:
                print("\\nWarning: No device token provided")
                print("Using service role key for authentication")
        except Exception as e:
            print("\\nWarning: Authentication error:", str(e))
            print("Error type:", type(e))
            print("Using service role key as fallback")
        
        # Dashboard connection configuration
        self.dashboard_url = os.getenv('DASHBOARD_URL', 'http://localhost:5173')
        print(f"\\nDashboard URL: {self.dashboard_url}")
        
        # Device configuration
        self.device_config = device_config
        self.running = False
        self.connected = False
        self.retry_count = 0
        self.max_retries = 3
        self.retry_delay = 5  // seconds

    def init(self):
        """
        Initialize device automation and establish connection
        """
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
        """
        Check connection to dashboard and update device status
        """
        try:
            response = requests.get(self.dashboard_url)
            response.raise_for_status()
            
            # Update device status in Supabase upon successful connection
            current_time = datetime.datetime.now()
            device_id = self.device_config['id']
            user_id = self.device_config['user_id']
            print(f"\\nAttempting to update device {device_id} for user {user_id} in Supabase...")
            
            try:
                # Debug Supabase connection
                print("Supabase URL:", self.supabase_url)
                print("Device Config:", self.device_config)
                
                # First check if device exists
                print("\\nQuerying all devices in the database...")
                all_devices = self.supabase_client.table('devices') \
                    .select('*') \
                    .execute()
                
                print("\\nAll devices in database:")
                for device in all_devices.data:
                    print(f"- Device ID: {device.get('id')}")
                    print(f"  User ID: {device.get('user_id')}")
                    print(f"  Title: {device.get('title')}")
                    print(f"  Type: {device.get('type')}")
                    print(f"  Status: {device.get('status')}")
                    print()
                
                print("\\nLooking for specific device...")
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
                print("\\nSkipping GitHub check - missing configuration")
                return False

            print("\\nChecking for GitHub updates...")
            
            # Parse repository information
            repo_match = self.repo_url.match(r'github\.com/([^/]+)/([^/]+)')
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
                print("\\nScript update detected!")
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
                    print("\\nScript update detected - consider restarting the device")
                
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
        """
        Update the specific device
        """
        try:
            # Check for GitHub updates first
            if self._check_github_updates():
                print("\\nScript update detected - consider restarting the device")
            
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
        """
        Notify dashboard about device update
        
        :param new_value: New value of the device
        """
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
    print('\\nReceived signal to terminate')
    if 'device_system' in globals():
        device_system.stop()
    sys.exit(0)

def main():
    """
    Main execution function
    """
    try:
        # Print startup message
        print(f"Starting device automation for {DEFAULT_CONFIG['DEVICE_TYPE']} device:")
        print(f"  - Device ID: {DEFAULT_CONFIG['DEVICE_ID']}")
        print(f"  - User ID: {DEFAULT_CONFIG['USER_ID']}")
        print(f"  - Title: {DEFAULT_CONFIG['DEVICE_TITLE']}")
        print(f"  - Initial Value: {DEFAULT_CONFIG['INITIAL_VALUE']}")

        # Register signal handlers
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)

        # Create device configuration
        device_config = {
            'id': os.getenv('DEVICE_ID'),
            'user_id': os.getenv('USER_ID'),
            'type': os.getenv('DEVICE_TYPE'),
            'title': os.getenv('DEVICE_TITLE'),
            'value': os.getenv('INITIAL_VALUE')
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
    main()`;

      // Get the main script content
      const mainScript = await GitHubService.downloadFile(updatedDevice);

      // Combine the config and main script
      const newScriptContent = configScript + '\n\n' + mainScript;

      return newScriptContent;
    } catch (error) {
      console.error('Error downloading GitHub file:', error);
      throw error;
    }
  };

  const updateGitHubConfig = async (id: string, config: Partial<CreateDeviceInput>) => {
    try {
      const { error } = await supabase
        .from('devices')
        .update(config)
        .eq('id', id)
        .eq('user_id', user?.id);

      if (error) throw error;

      // Refresh devices to get updated config
      await refreshDevices();

      toast.success('GitHub configuration updated successfully');
    } catch (error) {
      toast.error('Failed to update GitHub configuration');
      throw error;
    }
  };

  const value = {
    devices,
    loading,
    createDevice,
    updateDevice,
    deleteDevice,
    refreshDevices,
    toggleAutoUpdate,
    downloadGitHubFile,
    updateGitHubConfig
  };

  return (
    <DeviceContext.Provider value={value}>
      {children}
    </DeviceContext.Provider>
  );
}

export function useDevices() {
  const context = useContext(DeviceContext);
  if (context === undefined) {
    throw new Error('useDevices must be used within a DeviceProvider');
  }
  return context;
}
