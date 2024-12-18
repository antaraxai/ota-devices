import { Router } from 'express';
import { supabase } from '../lib/supabaseClient.js';

const router = Router();

// Handle device connection
router.post('/devices/:deviceId/connection', async (req, res) => {
  const { deviceId } = req.params;
  const { connected } = req.body;

  try {
    const { data, error } = await supabase
      .from('devices')
      .update({ connected, last_connected: new Date().toISOString() })
      .eq('id', deviceId);

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error updating device connection:', error);
    res.status(500).json({ success: false, error: 'Failed to update device connection' });
  }
});

// Handle device readings
router.post('/devices/:deviceId/readings', async (req, res) => {
  const { deviceId } = req.params;
  const { readings } = req.body;

  try {
    const { data, error } = await supabase
      .from('device_readings')
      .insert([
        {
          device_id: deviceId,
          readings,
          timestamp: new Date().toISOString()
        }
      ]);

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error updating device readings:', error);
    res.status(500).json({ success: false, error: 'Failed to update device readings' });
  }
});

export default router;
import { Router } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

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
