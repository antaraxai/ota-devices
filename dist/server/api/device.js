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
        if (error)
            throw error;
        res.json({ success: true, data });
    }
    catch (error) {
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
        if (error)
            throw error;
        res.json({ success: true, data });
    }
    catch (error) {
        console.error('Error updating device readings:', error);
        res.status(500).json({ success: false, error: 'Failed to update device readings' });
    }
});
export default router;
