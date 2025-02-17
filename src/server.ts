import express from 'express';
import cors from 'cors';
import { supabase } from './lib/supabase.js';
import path from 'path';
import fs from 'fs';
import OpenAI from 'openai';

const app = express();
const port = process.env.PORT || 5001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'Authorization']
}));
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

app.post('/api/devices/:deviceId/connection', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { status } = req.body;
    
    const { error } = await supabase
      .from('devices')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', deviceId);

    if (error) throw error;
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating device status:', error);
    res.status(500).json({ error: 'Failed to update device status' });
  }
});

app.post('/api/devices/:deviceId/readings', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const readings = req.body;
    
    // Add device_id and timestamp to readings
    const readingsWithMeta = {
      ...readings,
      device_id: deviceId,
      created_at: new Date().toISOString()
    };
    
    const { error } = await supabase
      .from('device_readings')
      .insert([readingsWithMeta]);

    if (error) throw error;
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving device readings:', error);
    res.status(500).json({ error: 'Failed to save device readings' });
  }
});

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key is not configured');
    }

    const { message, history } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    try {
      const chatCompletion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          ...history,
          { role: 'user', content: message }
        ]
      });

      if (!chatCompletion.choices || chatCompletion.choices.length === 0) {
        throw new Error('No response from OpenAI');
      }

      const aiResponse = chatCompletion.choices[0].message.content;
      res.json({ success: true, message: aiResponse });
    } catch (apiError) {
      // Handle rate limit and quota errors specifically
      if (apiError.status === 429) {
        console.error('OpenAI API rate limit or quota exceeded:', apiError);
        return res.status(503).json({
          success: false,
          error: 'Service temporarily unavailable due to API limits. Please try again later.'
        });
      }
      throw apiError; // Re-throw other API errors
    }
  } catch (error) {
    console.error('Error in chat endpoint:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to process chat request';
    const statusCode = error.status || 500;
    res.status(statusCode).json({ success: false, error: errorMessage });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
