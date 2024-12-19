import React, { useState, useEffect } from 'react';
import { Device } from '../types';
import { FaGithub, FaPencilAlt, FaTrash } from 'react-icons/fa';
import { FiZap } from 'react-icons/fi';
import { useDevices } from '../contexts/DeviceContext';
import DeviceDetailsModal from './DeviceDetailsModal';

interface DeviceCardProps {
  device: Device;
  onUpdate: (deviceId: string) => void;
}

export const DeviceCard: React.FC<DeviceCardProps> = ({ 
  device, 
  onUpdate
}) => {
  const [isBlinking, setIsBlinking] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const { updateDevice, deleteDevice } = useDevices();
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 200);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleEdit = async () => {
    // You can implement edit functionality here
    console.log('Edit device:', device.id);
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

  // Format the value to handle long decimal numbers
  const formattedValue = typeof device.value === 'number' 
    ? device.value >= 100 
      ? device.value.toFixed(0)
      : device.value.toFixed(1)
    : device.value;

  return (
    <div className="bg-white rounded-lg p-6 shadow-md flex flex-col items-center">
      {/* Eyes */}
      <div className="flex justify-center space-x-4 mb-6">
        <div 
          className={`w-8 h-8 bg-black rounded-t-full transition-transform duration-200 origin-bottom ${
            isBlinking ? 'scale-y-[0.1]' : 'scale-y-100'
          }`} 
        />
        <div 
          className={`w-8 h-8 bg-black rounded-t-full transition-transform duration-200 origin-bottom ${
            isBlinking ? 'scale-y-[0.1]' : 'scale-y-100'
          }`} 
        />
      </div>

      {/* Title and Type */}
      <h3 className="text-2xl font-bold text-gray-900 mb-2">{device.title}</h3>
      <p className="text-gray-500 mb-6">Type: {device.type}</p>

      {/* Value */}
      <div className="flex items-center justify-center mb-4">
        <span className="text-4xl font-bold">{formattedValue}</span>
        <span className="text-2xl ml-2 text-gray-500">{device.unit}</span>
      </div>

      {/* Status Badge */}
      <div className="mb-4">
        <span className="inline-flex items-center px-4 py-1 rounded-full bg-red-100 text-red-800">
          <FiZap className="mr-2" /> {device.status}
        </span>
      </div>

      {/* GitHub Status (if applicable) */}
      {device.repo_url && (
        <div className="mb-4 flex items-center">
          <FaGithub className="mr-2" />
          <span className={`text-sm ${
            device.github_status === 'updating' ? 'text-blue-500' :
            device.github_status === 'error' ? 'text-red-500' :
            device.github_status === 'up-to-date' ? 'text-green-500' :
            'text-gray-500'
          }`}>
            {device.github_status || 'Not checked'}
          </span>
          {device.github_status !== 'updating' && (
            <button
              onClick={handleUpdate}
              disabled={isUpdating}
              className="ml-2 text-blue-500 hover:text-blue-700"
              title="Update device"
            >
              <FaGithub />
            </button>
          )}
        </div>
      )}

      {/* Connection Status */}
      <div className="mb-4 flex items-center text-gray-500">
        <FiZap className="mr-2" /> {device.connected ? 'Connected' : 'Disconnected'}
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-4">
        <button
          onClick={handleEdit}
          className="flex items-center text-blue-500 hover:text-blue-700"
        >
          <FaPencilAlt className="mr-1" /> Edit
        </button>
        <button
          onClick={handleDelete}
          className="flex items-center text-red-500 hover:text-red-700"
        >
          <FaTrash className="mr-1" /> Delete
        </button>
      </div>

      {/* Show More Button */}
      <button
        onClick={() => setIsDetailsModalOpen(true)}
        className="mt-4 text-gray-500 hover:text-gray-700"
      >
        Show more
      </button>

      {/* Details Modal */}
      {isDetailsModalOpen && (
        <DeviceDetailsModal
          device={device}
          onClose={() => setIsDetailsModalOpen(false)}
        />
      )}
    </div>
  );
};

export default DeviceCard;