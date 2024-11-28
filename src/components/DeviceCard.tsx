import React from 'react';
import { Device } from '../types';
import CretaExpression from './CretaExpression';

interface DeviceCardProps {
  device: Device;
  onUpdate: (deviceId: string) => void;
}

export const DeviceCard: React.FC<DeviceCardProps> = ({ device, onUpdate }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-100 text-green-800';
      case 'offline': return 'bg-red-100 text-red-800';
      case 'updating': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'good': return 'text-green-500';
      case 'warning': return 'text-yellow-500';
      case 'critical': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getExpression = () => {
    if (device.status === 'offline') {
      return 'sad';
    }
    if (device.status === 'updating') {
      return 'focused';
    }
    
    switch (device.health) {
      case 'critical':
        return 'angry';
      case 'warning':
        return 'confused';
      case 'good':
        return 'happy';
      default:
        return 'happy';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex flex-col items-center">
        {/* Expression at the top */}
        <div className="w-64 h-48 mb-4">
          <CretaExpression 
            className="transform scale-100"
            status={device.status}
            health={device.health}
          />
        </div>

        {/* Device Info below */}
        <div className="w-full space-y-2">
          <h3 className="text-lg font-semibold text-gray-900">{device.name}</h3>
          <span className={`inline-block px-2 py-1 rounded-full text-sm font-medium ${getStatusColor(device.status)} mt-1`}>
            {device.status}
          </span>
          <p className="text-sm text-gray-600">Type: {device.type}</p>
          <p className="text-sm text-gray-600">Last seen: {new Date(device.lastSeen).toLocaleString()}</p>
          <p className="text-sm text-gray-600">
            Version: {device.currentVersion} → {device.targetVersion}
          </p>
          <p className={`text-sm font-medium ${getHealthColor(device.health)}`}>
            Health: {device.health}
          </p>
        </div>

        {/* Progress bar and update button */}
        <div className="w-full mt-4">
          {device.status === 'updating' && (
            <div>
              <div className="h-2 bg-blue-100 rounded-full">
                <div 
                  className="h-2 bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${device.progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 mt-1">Progress: {device.progress}%</p>
            </div>
          )}

          {device.status !== 'updating' && device.currentVersion !== device.targetVersion && (
            <button
              onClick={() => onUpdate(device.id)}
              className="w-full bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors"
            >
              Update Device
            </button>
          )}
        </div>
      </div>
    </div>
  );
};