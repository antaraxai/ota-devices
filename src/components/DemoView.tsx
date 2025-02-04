import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { config } from '../config';

interface DemoViewProps {
  deviceId: string;
}

// Helper function to format device ID for workspace path
const formatDeviceId = (id: string): string => {
  // Remove any special characters and convert to lowercase
  return id.toLowerCase().replace(/[^a-z0-9-]/g, '');
};

const DemoView: React.FC<DemoViewProps> = ({ deviceId }) => {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [iframeKey, setIframeKey] = useState(0); // Add key to force iframe reload

  useEffect(() => {
    // Reset loading state when device ID changes
    setIsLoading(true);
    setError(null);
    setIframeKey(prev => prev + 1); // Force iframe reload

    // Connect to WebSocket
    const socket = io(config.socketUrl);

    // Listen for device updates
    socket.on('device_updated', (data: { device_id: string }) => {
      if (data.device_id === deviceId) {
        console.log('Device updated, refreshing preview...');
        setIframeKey(prev => prev + 1); // Force iframe reload
      }
    });

    // Cleanup socket connection
    return () => {
      socket.disconnect();
    };
  }, [deviceId]);

  const handleIframeLoad = (event: React.SyntheticEvent<HTMLIFrameElement>) => {
    console.log('Iframe loaded');
    setIsLoading(false);
  };

  const handleIframeError = () => {
    console.error('Iframe failed to load');
    setError('Failed to load preview');
    setIsLoading(false);
  };

  return (
    <div className="h-full w-full">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-white">
          <div className="bg-red-50 text-red-500 p-4 rounded-lg max-w-md text-center">
            {error}
          </div>
        </div>
      )}

      <iframe
        key={iframeKey}
        src={`${config.apiBaseUrl}/api/devices/${formatDeviceId(deviceId)}/preview`}
        className="w-full h-full border-0"
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
};

export default DemoView;
