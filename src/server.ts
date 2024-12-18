import express from 'express';
import cors from 'cors';
import { supabase } from './lib/supabase.js';

const app = express();
const port = process.env.PORT || 5173;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.post('/api/devices/:deviceId/connection', async (req, res) => {
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

app.post('/api/devices/:deviceId/readings', async (req, res) => {
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

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
