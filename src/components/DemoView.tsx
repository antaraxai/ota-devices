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
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const socketRef = React.useRef<any>(null);
  const lastModifiedRef = React.useRef<string | null>(null);
  const checkingRef = React.useRef<boolean>(false);

  const checkForUpdates = React.useCallback(async (force: boolean = false) => {
    if (checkingRef.current) return;
    checkingRef.current = true;

    try {
      const response = await fetch(
        `${config.apiBaseUrl}/api/devices/${formatDeviceId(deviceId)}/preview`, 
        {
          method: 'HEAD',
          headers: lastModifiedRef.current && !force ? {
            'If-Modified-Since': lastModifiedRef.current
          } : {}
        }
      );

      if (response.status === 200) {
        const newLastModified = response.headers.get('Last-Modified');
        if (force || !lastModifiedRef.current || newLastModified !== lastModifiedRef.current) {
          lastModifiedRef.current = newLastModified;
          const iframe = iframeRef.current;
          
          if (iframe) {
            iframe.src = `${config.apiBaseUrl}/api/devices/${formatDeviceId(deviceId)}/preview`;
            console.log(force ? 'Forced refresh' : 'Content changed, updating...');
          }
        } else {
          console.log('Content unchanged, skipping update');
        }
      }
    } catch (err) {
      console.error('Error checking for updates:', err);
    } finally {
      checkingRef.current = false;
    }
  }, [deviceId]);

  useEffect(() => {
    // Initialize Socket.IO connection
    if (!socketRef.current) {
      socketRef.current = io(config.socketUrl, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: Infinity
      });
    }

    // Listen for device updates
    const handleDeviceUpdate = (data: { device_id: string }) => {
      if (data.device_id === deviceId) {
        console.log('Device update received, forcing refresh...');
        checkForUpdates(true);  // Force refresh on device update
      }
    };

    socketRef.current.on('device_updated', handleDeviceUpdate);
    socketRef.current.on('connect', () => console.log('Socket connected'));
    socketRef.current.on('disconnect', () => console.log('Socket disconnected'));

    // Initial check and set up periodic checks every 30 seconds
    checkForUpdates(true);  // Force initial load
    const checkInterval = setInterval(() => checkForUpdates(false), 30000);

    // Cleanup
    return () => {
      if (socketRef.current) {
        socketRef.current.off('device_updated', handleDeviceUpdate);
      }
      clearInterval(checkInterval);
    };
  }, [deviceId, checkForUpdates]);

  const handleIframeLoad = (event: React.SyntheticEvent<HTMLIFrameElement>) => {
    console.log('Content loaded');
  };

  const handleIframeError = () => {
    console.error('Iframe failed to load');
    setError('Failed to load preview');
  };

  return (
    <div className="h-full w-full relative flex flex-col">
      {/* Preview Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
        <div className="text-sm text-gray-600">Device Preview</div>
        <div className="flex space-x-2">
          {error && (
            <div className="text-sm text-red-500">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Preview Container */}
      <div className="flex-1 relative bg-gray-100">
        <div className="absolute inset-0 p-4">
          <div className="w-full h-full bg-white rounded-lg shadow-lg">
            {/* Static iframe with scrolling enabled */}
            <iframe
              ref={iframeRef}
              src={`${config.apiBaseUrl}/api/devices/${formatDeviceId(deviceId)}/preview`}
              className="w-full h-full border-0"
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              sandbox="allow-scripts allow-same-origin"
              style={{ overflow: 'auto' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DemoView;
