import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';

const router = Router();

// Fetch device status data
export const fetchDeviceStatusData = async (deviceId: string) => {
  try {
    const { data, error } = await supabase
      .from('device_data')
      .select('*')
      .eq('device_id', deviceId)
      .eq('data_type', 'status')
      .order('created_at', { ascending: true });

    if (error) throw error;

    if (data) {
      return data.map(item => ({
        time: format(new Date(item.created_at), 'HH:mm'),
        status: item.value === 'online' ? 1 : 0
      }));
    }
    return [];
  } catch (error) {
    console.error('Error fetching device status data:', error);
    throw error;
  }
};

// Handle device connection
router.post('/devices/:deviceId/connection', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const connectionInfo = req.body;

    // Update device with connection info
    const { error } = await supabase
      .from('devices')
      .update({
        first_connection: connectionInfo.first_connection,
        installer_version: connectionInfo.installer_version,
        installer_id: connectionInfo.installer_id,
        created_at: connectionInfo.created_at,
        status: 'online'
      })
      .eq('id', deviceId);

    if (error) throw error;
    res.status(200).json({ message: 'Connection info updated successfully' });
  } catch (error) {
    console.error('Error updating connection info:', error);
    res.status(500).json({ error: 'Failed to update connection info' });
  }
});

// Handle device readings
router.post('/devices/:deviceId/readings', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const reading = req.body;

    // Update device with latest reading
    const { error } = await supabase
      .from('devices')
      .update({
        value: reading.value,
        unit: reading.unit,
        updated_at: reading.timestamp,
        status: 'online'
      })
      .eq('id', deviceId);

    if (error) throw error;
    res.status(200).json({ message: 'Reading updated successfully' });
  } catch (error) {
    console.error('Error updating reading:', error);
    res.status(500).json({ error: 'Failed to update reading' });
  }
});

export default router;
