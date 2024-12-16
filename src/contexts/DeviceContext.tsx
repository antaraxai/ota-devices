import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Device, CreateDeviceInput } from '../types/device';
import { useAuth } from './AuthContext';
import { toast } from 'react-toastify';
import { GitHubService } from '../services/github';

interface DeviceContextType {
  devices: Device[];
  loading: boolean;
  createDevice: (input: CreateDeviceInput) => Promise<Device>;
  updateDevice: (id: string, updates: Partial<CreateDeviceInput>) => Promise<Device>;
  deleteDevice: (id: string) => Promise<void>;
  refreshDevices: () => Promise<void>;
  toggleAutoUpdate: (id: string, value: boolean) => Promise<void>;
  downloadGitHubFile: (deviceId: string) => Promise<string>;
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
        status: 'offline' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
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
      const device = devices.find(d => d.id === deviceId);
      if (!device) {
        throw new Error('Device not found');
      }

      const content = await GitHubService.downloadFile(device);
      
      // Update the device's script content in the database
      const { error } = await supabase
        .from('devices')
        .update({ script_content: content })
        .eq('id', deviceId)
        .eq('user_id', user?.id);

      if (error) throw error;

      // Update local state
      setDevices(prev => prev.map(d => 
        d.id === deviceId ? { ...d, script_content: content } : d
      ));

      toast.success('Script downloaded successfully');
      return content;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to download GitHub file';
      toast.error(message);
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
    downloadGitHubFile
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
