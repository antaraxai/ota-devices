import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Device, CreateDeviceInput, DeviceType } from '../types/device';
import { useAuth } from './AuthContext';
import { toast } from 'react-toastify';
import { createClient } from '@supabase/supabase-js';

// Create a separate client with service role for admin operations
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase configuration');
}

const serviceRoleClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

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
  downloadDeviceScript: (deviceId: string) => Promise<void>;
  generateDeviceScript: (device: Device) => Promise<string>;
  downloadDeviceScriptFile: (device: Device) => Promise<void>;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export const useDeviceContext = () => {
  const context = useContext(DeviceContext);
  if (context === undefined) {
    throw new Error('useDeviceContext must be used within a DeviceProvider');
  }
  return context;
};

export const DeviceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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

      // Subscribe to device updates
      const channel = supabase
        .channel('device_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'devices',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('Received realtime update:', payload);
            // Update the specific device in the state
            if (payload.eventType === 'UPDATE') {
              setDevices(prevDevices => 
                prevDevices.map(device => 
                  device.id === payload.new.id ? { ...device, ...payload.new } : device
                )
              );
            } else {
              // For other events (INSERT, DELETE), refresh the full list
              refreshDevices();
            }
          }
        )
        .subscribe();

      // Cleanup subscription
      return () => {
        channel.unsubscribe();
      };
    }
  }, [user]);

  // Function to get template from storage
  const getDeviceTemplate = async (): Promise<string> => {
    try {
      // In development mode, read from local file
      const response = await fetch('/src/templates/device-template.py');
      if (!response.ok) {
        throw new Error('Failed to get device template');
      }
      return await response.text();
    } catch (error) {
      console.error('Error getting device template:', error);
      throw error;
    }
  };

  const createDevice = async (input: CreateDeviceInput): Promise<Device> => {
    try {
      if (!user) throw new Error('User not authenticated');

      const now = new Date().toISOString();
      const deviceToken = crypto.randomUUID();

      // Create device record with all required non-null fields
      const { data, error } = await supabase
        .from('devices')
        .insert([{
          title: input.title,
          tag: input.tag,
          user_id: user.id,
          auto_update: input.auto_update,
          status: 'Awaiting connection',
          created_at: now,
          updated_at: now,
          device_token: deviceToken,
          // Optional GitHub fields
          repo_url: input.repo_url || null,
          repo_branch: input.repo_branch || null,
          repo_path: input.repo_path || null,
          github_token: input.github_token || null,
          github_username: input.github_username || null,
          github_status: null,
          last_commit_sha: null,
          script_content: null,
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating device record:', error);
        toast.error('Failed to create device');
        throw error;
      }

      if (!data) {
        const error = new Error('Failed to create device');
        console.error(error);
        toast.error('Failed to create device');
        throw error;
      }

      // Update the devices list
      setDevices(prev => [data, ...prev]);
      toast.success('Device created successfully');

      return data;
    } catch (error) {
      console.error('Error in createDevice:', error);
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
      const { data: device, error: refreshError } = await supabase
        .from('devices')
        .select('*')
        .eq('id', deviceId)
        .eq('user_id', user?.id)
        .single();

      if (refreshError || !device) {
        throw new Error('Failed to refresh device data');
      }

      // Try to download existing script from storage first
      const { data: existingScript, error: downloadError } = await serviceRoleClient.storage
        .from('device-scripts')
        .download(`${deviceId}/device-script.py`);

      if (!downloadError && existingScript) {
        return await existingScript.text();
      }

      // If no existing script, get template from storage bucket
      const { data: templateData, error: templateError } = await serviceRoleClient.storage
        .from('device-scripts')
        .download('templates/device-template.py');

      if (templateError || !templateData) {
        throw new Error('Failed to download template from storage');
      }

      const templateText = await templateData.text();

      // Customize the template
      const customizedScript = templateText
        .replace('{{DEVICE_ID}}', device.id)
        .replace('{{DEVICE_TYPE}}', device.type)
        .replace('{{DEVICE_TITLE}}', device.title)
        .replace('{{SUPABASE_URL}}', SUPABASE_URL)
        .replace('{{SUPABASE_KEY}}', SERVICE_ROLE_KEY)
        .replace('{{USER_ID}}', user?.id || '')
        .replace('{{DEVICE_TOKEN}}', device.device_token || '')
        .replace('{{API_URL}}', 'http://localhost:5173')
        .replace('{{GITHUB_TOKEN}}', '')
        .replace('{{GITHUB_REPO}}', '')
        .replace('{{GITHUB_BRANCH}}', 'main')
        .replace('{{GITHUB_PATH}}', '');

      // Upload the customized script
      const { error: uploadError } = await serviceRoleClient.storage
        .from('device-scripts')
        .upload(`${deviceId}/device-script.py`, customizedScript, {
          upsert: true
        });

      if (uploadError) {
        console.error('Error uploading script:', uploadError);
        toast.error('Failed to upload device script');
      }

      return customizedScript;
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Failed to download file');
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

  const generateDeviceScript = async (device: Device): Promise<string> => {
    try {
      console.log('Generating device script for device:', device.id);
      
      // Read the template script from device-scripts bucket, templates folder using service role client
      const { data: scriptTemplate, error: scriptError } = await serviceRoleClient
        .storage
        .from('device-scripts')
        .download('templates/final-device-script.py');

      if (scriptError) {
        console.error('Error downloading template:', scriptError);
        toast.error('Failed to download script template');
        throw scriptError;
      }

      if (!scriptTemplate) {
        const error = new Error('Template script not found');
        console.error(error);
        toast.error('Script template not found');
        throw error;
      }

      console.log('Template script downloaded successfully');

      // Convert blob to text
      const templateText = await scriptTemplate.text();
      console.log('Template text loaded');

      // Replace placeholders with actual values
      const customizedScript = templateText
        .replace('SUPABASE_URL = "your-supabase-url"', `SUPABASE_URL = "${SUPABASE_URL}"`)
        .replace('SUPABASE_KEY = "your-supabase-key"', `SUPABASE_KEY = "${SERVICE_ROLE_KEY}"`)
        .replace('DEVICE_ID = "your-device-id"', `DEVICE_ID = "${device.id}"`);

      console.log('Script customized with device values');

      // Upload the customized script to the device's folder using service role client
      const fileName = `devices/${device.id}/device-script.py`;
      const { error: uploadError } = await serviceRoleClient
        .storage
        .from('device-scripts')
        .upload(fileName, new Blob([customizedScript], { type: 'text/plain' }), {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('Error uploading customized script:', uploadError);
        toast.error('Failed to generate device script');
        throw uploadError;
      }

      console.log('Customized script uploaded successfully');
      return fileName;
    } catch (error) {
      console.error('Error generating device script:', error);
      throw error;
    }
  };

  const downloadDeviceScript = async (deviceId: string) => {
    try {
      const fileName = await generateDeviceScript({ id: deviceId } as Device);
      
      // Get the download URL
      const { data, error } = await supabase
        .storage
        .from('device-scripts')
        .createSignedUrl(fileName, 3600); // URL valid for 1 hour

      if (error) {
        console.error('Error creating signed URL:', error);
        throw error;
      }

      if (!data?.signedUrl) {
        throw new Error('Failed to get download URL');
      }

      // Create a temporary link to trigger the download
      const link = document.createElement('a');
      link.href = data.signedUrl;
      link.download = 'device-script.py';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading device script:', error);
      throw error;
    }
  };

  const downloadDeviceScriptFile = async (device: Device): Promise<void> => {
    try {
      console.log('Starting script download for device:', device.id);
      const fileName = await generateDeviceScript(device);
      
      console.log('Getting file content for:', fileName);
      // Get the file content directly
      const { data, error } = await serviceRoleClient
        .storage
        .from('device-scripts')
        .download(fileName);

      if (error) {
        console.error('Error downloading file:', error);
        toast.error('Failed to download script');
        throw error;
      }

      if (!data) {
        const error = new Error('Failed to get file content');
        console.error(error);
        toast.error('Failed to download script');
        throw error;
      }

      console.log('File content retrieved successfully');

      // Create a blob from the file content
      const blob = new Blob([data], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);

      // Create a temporary link to trigger the download
      const link = document.createElement('a');
      link.href = url;
      link.download = 'device-script.py'; // Force download with specific filename
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      console.log('Download initiated');
      toast.success('Device script downloaded successfully');
    } catch (error) {
      console.error('Error downloading device script:', error);
      toast.error('Failed to download device script');
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
    updateGitHubConfig,
    downloadDeviceScript,
    generateDeviceScript,
    downloadDeviceScriptFile
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
