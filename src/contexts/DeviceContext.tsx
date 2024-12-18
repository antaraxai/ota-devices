import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Device, CreateDeviceInput } from '../types/device';
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
            // Refresh devices when there's a change
            refreshDevices();
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

      // Create device record
      const { data, error } = await supabase
        .from('devices')
        .insert([{
          ...input,
          user_id: user.id,
          status: 'Normal' as const,
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating device record:', error);
        throw error;
      }
      if (!data) throw new Error('Failed to create device');

      try {
        // Get template from storage
        console.log('Getting device template...');
        const templateText = await getDeviceTemplate();

        // Generate device token
        const deviceToken = crypto.randomUUID();

        // Update device with token
        const { error: tokenError } = await supabase
          .from('devices')
          .update({ device_token: deviceToken })
          .eq('id', data.id)
          .eq('user_id', user?.id);

        if (tokenError) {
          console.error('Error updating device token:', tokenError);
          throw tokenError;
        }

        // Customize the template
        const customizedScript = templateText
          .replace('{{DEVICE_ID}}', data.id)
          .replace('{{DEVICE_TYPE}}', data.type)
          .replace('{{DEVICE_TITLE}}', data.title)
          .replace('{{SUPABASE_URL}}', SUPABASE_URL)
          .replace('{{SUPABASE_KEY}}', SERVICE_ROLE_KEY)
          .replace('{{USER_ID}}', user?.id || '')
          .replace('{{DEVICE_TOKEN}}', deviceToken)
          .replace('{{API_URL}}', 'http://localhost:5173')
          .replace('{{GITHUB_TOKEN}}', '')
          .replace('{{GITHUB_REPO}}', '')
          .replace('{{GITHUB_BRANCH}}', 'main')
          .replace('{{GITHUB_PATH}}', '');

        // Upload the customized script
        console.log('Uploading device script...');
        const { error: uploadError } = await serviceRoleClient.storage
          .from('device-scripts')
          .upload(`${data.id}/device-script.py`, customizedScript, {
            contentType: 'text/x-python',
            upsert: true
          });

        if (uploadError) {
          console.error('Error uploading script:', uploadError);
          throw uploadError;
        }

        console.log('Device script uploaded successfully');
        
        // Download the script automatically
        await downloadDeviceScript(data.id);
      } catch (storageError) {
        console.error('Storage operation failed:', storageError);
        toast.warning('Device created but script operation failed');
      }

      setDevices(prev => [data, ...prev]);
      toast.success('Device created successfully');
      return data;
    } catch (error) {
      console.error('Error in createDevice:', error);
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

  const downloadDeviceScript = async (deviceId: string) => {
    try {
      const { data, error } = await serviceRoleClient.storage
        .from('device-scripts')
        .download(`${deviceId}/device-script.py`);

      if (error) {
        console.error('Error downloading script:', error);
        throw error;
      }

      // Create blob and download link
      const blob = new Blob([await data.text()], { type: 'text/x-python' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `device-script.py`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error in downloadDeviceScript:', error);
      toast.error('Failed to download device script');
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
    downloadDeviceScript
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
