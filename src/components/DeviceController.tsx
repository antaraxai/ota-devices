import React, { useEffect, useState } from 'react';
import DemoView from './DemoView';

interface DeviceControllerProps {
  deviceId: string;
}

interface DeviceStatus {
  status: string;
  pid?: number;
  returncode?: number | null;
  db_status?: string;
}

interface DeviceLogs {
  stdout: string[];
  stderr: string[];
}

const DeviceController: React.FC<DeviceControllerProps> = ({ deviceId }) => {
  const [status, setStatus] = useState<DeviceStatus>({ status: 'stopped' });
  const [logs, setLogs] = useState<DeviceLogs>({ stdout: [], stderr: [] });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchStatus = async () => {
    try {
      const response = await fetch(`http://localhost:5001/api/devices/${deviceId}/status`);
      if (!response.ok) {
        throw new Error('Failed to fetch status');
      }
      const data = await response.json();
      console.log('Status:', data); // Debug log
      setStatus(data);
    } catch (error) {
      console.error('Error fetching status:', error);
      setError('Failed to fetch device status');
    }
  };

  const fetchLogs = async () => {
    try {
      const response = await fetch(`http://localhost:5001/api/devices/${deviceId}/logs`);
      if (!response.ok) {
        throw new Error('Failed to fetch logs');
      }
      const data = await response.json();
      setLogs(data);
    } catch (error) {
      console.error('Error fetching logs:', error);
      setError('Failed to fetch device logs');
    }
  };

  const startController = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`http://localhost:5001/api/devices/${deviceId}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start controller');
      }
      
      await fetchStatus();
      await fetchLogs();
    } catch (error) {
      console.error('Error starting controller:', error);
      setError(error instanceof Error ? error.message : 'Failed to start controller');
    } finally {
      setIsLoading(false);
    }
  };

  const stopController = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`http://localhost:5001/api/devices/${deviceId}/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to stop controller');
      }
      
      await fetchStatus();
      await fetchLogs();
    } catch (error) {
      console.error('Error stopping controller:', error);
      setError(error instanceof Error ? error.message : 'Failed to stop controller');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchStatus();
    fetchLogs();

    // Set up polling
    const interval = setInterval(() => {
      fetchStatus();
      fetchLogs();
    }, 5000);

    // Cleanup
    return () => clearInterval(interval);
  }, [deviceId]);

  // Get the latest status from logs
  const getLatestStatusFromLogs = () => {
    // Get all status-related messages, sorted by timestamp
    const statusMessages = logs.stdout
      .filter(line => 
        line.includes('Controller started') || 
        line.includes('Controller already running') ||
        line.includes('Controller stopped') ||
        line.includes('Status changed to OFFLINE') ||
        line.includes('Status changed to ONLINE')
      );

    // Return based on the most recent status message
    const lastMessage = statusMessages[statusMessages.length - 1] || '';
    return lastMessage.includes('stopped') || lastMessage.includes('OFFLINE') ? false : true;
  };

  // Check if the controller is running
  const isControllerRunning = 
    (status.status === 'running' || 
    (status.db_status === 'ONLINE' && status.pid !== undefined)) &&
    getLatestStatusFromLogs();

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isControllerRunning ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm font-medium">Device Status:</span>
            <span className={`text-sm ${isControllerRunning ? 'text-green-600' : 'text-red-600'}`}>
              {isControllerRunning ? 'Running' : 'Stopped'}
            </span>
          </div>
          {status.pid && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">PID: {status.pid}</span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            className={`px-4 py-2 text-sm font-medium text-white rounded disabled:opacity-50 ${
              isControllerRunning 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-green-600 hover:bg-green-700'
            }`}
            onClick={isControllerRunning ? stopController : startController}
            disabled={isLoading}
          >
            {isLoading 
              ? (isControllerRunning ? 'Stopping...' : 'Starting...') 
              : (isControllerRunning ? 'Stop Device' : 'Start Device')}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-500 p-2 rounded text-sm mb-4">
          {error}
        </div>
      )}

      <div className="space-y-4 flex-1 overflow-auto">
        {/* Controller Logs */}
        <div>
          <h3 className="text-sm font-medium mb-2">Device Logs</h3>
          <div className="bg-black rounded-md p-4 font-mono text-xs text-green-400 overflow-auto h-[150px]">
            {logs.stdout.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
            {logs.stderr.map((line, i) => (
              <div key={`err-${i}`} className="text-red-400">
                {line}
              </div>
            ))}
          </div>
        </div>

        {/* Live Preview */}
        <div className="flex-1">
          <h3 className="text-sm font-medium mb-2">Device Preview</h3>
          <div className="bg-white rounded-md border border-gray-200 h-[500px] overflow-auto">
            <DemoView deviceId={deviceId} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeviceController;
