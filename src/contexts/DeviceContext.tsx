import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Device, CreateDeviceInput } from '../types/device';
import { useAuth } from './AuthContext';
import { toast } from 'react-toastify';
import { createClient } from '@supabase/supabase-js';
import templateContent from '../templates/gitlab-device-script.py?raw';
import { v4 as uuidv4 } from 'uuid';

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

interface DeviceContextProps {
  devices: Device[];
  createDevice: (input: CreateDeviceInput) => Promise<Device>;
  updateDevice: (id: string, input: Partial<CreateDeviceInput>) => Promise<Device>;
  deleteDevice: (id: string) => Promise<void>;
  generateDeviceScript: (device: Device) => Promise<string>;
  downloadDeviceScriptFile: (device: Device) => Promise<void>;
}

const DeviceContext = createContext<DeviceContextProps>({
  devices: [],
  createDevice: async () => {
    throw new Error('createDevice not implemented');
  },
  updateDevice: async () => {
    throw new Error('updateDevice not implemented');
  },
  deleteDevice: async () => {
    throw new Error('deleteDevice not implemented');
  },
  generateDeviceScript: async () => {
    throw new Error('generateDeviceScript not implemented');
  },
  downloadDeviceScriptFile: async () => {
    throw new Error('downloadDeviceScriptFile not implemented');
  }
});

const DeviceProvider: React.FC = ({ children }) => {
  const { user } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);

  useEffect(() => {
    const fetchDevices = async () => {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching devices:', error);
        toast.error('Failed to fetch devices');
      } else {
        setDevices(data);
      }
    };

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('device-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'devices'
        },
        (payload) => {
          // console.log('Received real-time update:', payload);
          // Refresh the devices list
          fetchDevices();
        }
      )
      .subscribe();

    fetchDevices();

    // Cleanup subscription
    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  const createDevice = async (input: CreateDeviceInput): Promise<Device> => {
    try {
      if (!user) {
        throw new Error('User must be logged in to create a device');
      }

      // Generate a UUID using crypto.randomUUID() if available, otherwise use uuid library
      const deviceToken = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : uuidv4();

      const newDevice = {
        ...input,
        user_id: user.id,
        status: 'AWAITING_CONNECTION',
        device_token: deviceToken,
      };

      console.log('Creating device with data:', newDevice);

      const { data, error } = await supabase
        .from('devices')
        .insert([newDevice])
        .select('*')
        .single();

      if (error) {
        console.error('Error creating device:', error);
        throw error;
      }

      if (!data) {
        throw new Error('No data returned from insert');
      }

      // Refresh the devices list
      setDevices(prev => [...prev, data]);

      return data;
    } catch (error) {
      console.error('Error creating device:', error);
      throw error;
    }
  };

  const updateDevice = async (id: string, input: Partial<CreateDeviceInput>): Promise<Device> => {
    const { data, error } = await supabase
      .from('devices')
      .update([input])
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating device:', error);
      throw error;
    }

    return data;
  };

  const deleteDevice = async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('devices')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting device:', error);
      throw error;
    }
  };

  const generateDeviceScript = async (device: Device): Promise<string> => {
    try {
      console.log('Generating device script for device:', device);

      // Use the imported template content
      let scriptContent = templateContent;

      console.log('Template loaded, length:', scriptContent.length);

      // Create a unique filename for this device's script
      const scriptFileName = `device-script-${device.id}.py`;

      // Replace placeholders with actual values
      scriptContent = scriptContent
        .replace(/DEVICE_ID = ".*"/, `DEVICE_ID = "${device.id}"`)
        .replace(/DEVICE_TOKEN = ".*"/, `DEVICE_TOKEN = "${device.device_token}"`)
        // .replace(/SUPABASE_URL = ".*"/, `SUPABASE_URL = "${import.meta.env.VITE_SUPABASE_URL}"`)
        // .replace(/SUPABASE_KEY = ".*"/, `SUPABASE_KEY = "${import.meta.env.VITE_SUPABASE_ANON_KEY}"`);

      // Upload the customized script
      const { error: uploadError } = await serviceRoleClient.storage
        .from('device-scripts')
        .upload(scriptFileName, scriptContent, {
          contentType: 'text/plain',
          upsert: true
        });

      if (uploadError) {
        console.error('Error uploading script:', uploadError);
        throw uploadError;
      }

      console.log('Script uploaded successfully');
      return scriptFileName;
    } catch (error) {
      console.error('Error generating device script:', error);
      throw error;
    }
  };

  const downloadDeviceScriptFile = async (device: Device): Promise<void> => {
    try {
      // Get the API URL from environment
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
      
      // Create the download URL
      const downloadUrl = `${apiUrl}/api/devices/${device.id}/download-script`;
      
      // Create a temporary link element
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = 'device-script.py';
      
      // Append to body, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // The backend will handle updating the timestamp
      toast.success('Script download initiated');
    } catch (error) {
      console.error('Error downloading script:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to download script');
      throw error;
    }
  };

  return (
    <DeviceContext.Provider value={{
      devices,
      createDevice,
      updateDevice,
      deleteDevice,
      generateDeviceScript,
      downloadDeviceScriptFile
    }}>
      {children}
    </DeviceContext.Provider>
  );
};

export const useDevice = () => {
  const context = useContext(DeviceContext);
  if (!context) {
    throw new Error('useDevice must be used within a DeviceProvider');
  }
  return context;
};

// Keep the original exports for backward compatibility
export const useDevices = useDevice;
export const useDeviceContext = useDevice;

export { DeviceProvider };
