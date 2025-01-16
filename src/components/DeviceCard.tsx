import React, { useState, useEffect } from 'react';
import { Device } from '../types';
import { FaGithub, FaGitlab } from 'react-icons/fa';
import { FiZap } from 'react-icons/fi';
import { useDevices } from '../contexts/DeviceContext';
import DeviceDrawer from './DeviceDrawer';

interface DeviceCardProps {
  device: Device;
  onUpdate: (deviceId: string) => void;
}

export const DeviceCard: React.FC<DeviceCardProps> = ({ 
  device, 
  onUpdate
}) => {
  const [isBlinking, setIsBlinking] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const { updateDevice, deleteDevice } = useDevices();
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 200);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleEdit = () => {
    setIsEditMode(true);
    setIsDrawerOpen(true);
  };

  const handleSave = async (updatedDevice: Device) => {
    try {
      await updateDevice(updatedDevice.id, updatedDevice);
      setIsDrawerOpen(false);
      setIsEditMode(false);
    } catch (error) {
      console.error('Error updating device:', error);
    }
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setIsEditMode(false);
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this device?')) {
      try {
        await deleteDevice(device.id);
      } catch (error) {
        console.error('Error deleting device:', error);
      }
    }
  };

  const handleUpdate = async () => {
    try {
      setIsUpdating(true);
      await updateDevice(device.id, { 
        ...device,
        github_status: 'updating'
      });
    } catch (error) {
      console.error('Error triggering update:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
      <div className="flex flex-col items-center">
        {/* Eyes with improved styling */}
        <div className="flex justify-center space-x-4 mb-8 mt-4 relative">
          <div 
            className={`w-6 h-6 bg-gray-800 rounded-t-full transition-transform duration-200 origin-bottom ${
              isBlinking ? 'scale-y-[0.1]' : 'scale-y-100'
            }`} 
          />
          <div 
            className={`w-6 h-6 bg-gray-800 rounded-t-full transition-transform duration-200 origin-bottom ${
              isBlinking ? 'scale-y-[0.1]' : 'scale-y-100'
            }`} 
          />
        </div>

        <div className="flex flex-col items-center flex-1">
          {/* Title and Status Section */}
          <div className="text-center mb-4">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">{device.title}</h3>
            <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${
              device.status === 'ONLINE'
                ? 'bg-green-50 text-green-700'
                : device.status === 'OFFLINE'
                ? 'bg-red-50 text-red-700'
                : 'bg-yellow-50 text-yellow-700'
            }`}>
              {device.status === 'ONLINE' ? 'Online' : 
               device.status === 'OFFLINE' ? 'Offline' : 
               'Connecting...'}
            </span>
          </div>

          {/* Repository Status */}
          {device.repo_url && (
            <div className="flex items-center justify-center mb-4">
              <div className="flex items-center space-x-2 px-3 py-1.5 bg-gray-50 rounded-lg">
                {device.repo_type === 'github' ? (
                  <FaGithub className="text-gray-700" />
                ) : (
                  <FaGitlab className="text-gray-700" />
                )}
                <span className={`text-sm ${
                  device.github_status === 'up-to-date' ? 'text-green-600' :
                  device.github_status === 'updating' ? 'text-blue-600' :
                  device.github_status === 'not-connected' ? 'text-gray-600' :
                  'text-gray-600'
                }`}>
                  {device.github_status === 'up-to-date' ? 'Up to Date' : 
                   device.github_status === 'updating' ? 'Updating...' : 
                   device.github_status === 'not-connected' ? 'Not Connected' :
                   'Not Connected'}
                </span>
                {device.github_status !== 'updating' && (
                  <button
                    onClick={handleUpdate}
                    disabled={isUpdating}
                    className="text-blue-600 hover:text-blue-700 disabled:opacity-50"
                    title="Update device"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-2">
            {/* Edit and Delete actions */}
            <div className="flex items-center justify-start space-x-6 mb-4">
              <button
                onClick={() => {
                  setIsEditMode(true);
                  setIsDrawerOpen(true);
                }}
                className="inline-flex items-center text-blue-500 hover:text-blue-700"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span className="ml-2">Edit</span>
              </button>

              <button
                onClick={handleDelete}
                className="inline-flex items-center text-red-500 hover:text-red-700"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span className="ml-2">Delete</span>
              </button>
            </div>

            {/* View Details button */}
            <button
              onClick={() => {
                setIsEditMode(false);
                setIsDrawerOpen(true);
              }}
              className="w-full inline-flex items-center justify-center px-4 py-2 bg-gray-50 text-gray-700 hover:bg-gray-100 rounded-md transition-colors duration-150"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              View Details
            </button>
          </div>
        </div>
      </div>

      {/* Device Drawer */}
      <DeviceDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        device={device}
        isEditMode={isEditMode}
        onSave={handleSave}
        initialTab={isEditMode ? 'edit' : 'info'}
      />
    </div>
  );
};

export default DeviceCard;