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
  onUpdate, 
  onToggleAutoUpdate,
  onEdit,
  onDelete
}) => {
  const [isBlinking, setIsBlinking] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 200);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Format the value to handle long decimal numbers
  const formattedValue = typeof device.value === 'number' 
    ? device.value >= 100 
      ? device.value.toFixed(0)
      : device.value.toFixed(1)
    : device.value;

  return (
    <>
      <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 p-6 space-y-4 border border-gray-100">
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

        {/* Device Info */}
        <div className="text-center">
          <h3 className="text-2xl font-bold text-gray-900">{device.title}</h3>
          <p className="text-gray-500">Type: {device.type}</p>
        </div>

        {/* Value Display */}
        <div className="flex items-center justify-center space-x-2">
          <span className="text-4xl font-bold text-gray-900">{formattedValue}</span>
          <span className="text-xl text-gray-500">{device.unit}</span>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center justify-center">
          <div className={`flex items-center px-3 py-1 rounded-full text-sm ${
            device.status === 'online' 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            <FiZap className={`w-4 h-4 mr-1 ${
              device.status === 'online' 
                ? 'text-green-500' 
                : 'text-red-500'
            }`} />
            {device.status}
          </div>
        </div>

        {/* GitHub Indicator */}
        {device.repo_url && (
          <div className="flex items-center justify-center text-gray-500">
            <FaGithub className="w-4 h-4 mr-1" />
            Connected
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-center space-x-2">
          <button
            onClick={onEdit}
            className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <FaPencilAlt className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-gray-500 hover:text-red-500 transition-colors"
          >
            <FaTrash className="w-4 h-4" />
          </button>
        </div>

        {/* Show More Button */}
        <button 
          onClick={() => setIsDetailsModalOpen(true)}
          className="w-full flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors mt-2 py-2 hover:bg-gray-50 rounded-md"
        >
          Show more
        </button>
      </div>

      <DeviceDetailsModal
        device={device}
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        onToggleAutoUpdate={onToggleAutoUpdate}
      />
    </>
  );
};