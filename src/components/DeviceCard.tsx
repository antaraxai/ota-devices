import React, { useState, useEffect, useCallback } from 'react';
import { Device } from '../types';
import { FaGithub, FaCodeBranch, FaFolder, FaSync, FaChevronUp, FaChevronDown, FaPencilAlt, FaTrash } from 'react-icons/fa';
import { FiZap, FiDownload } from 'react-icons/fi';

interface DeviceCardProps {
  device: Device;
  onUpdate: (deviceId: string) => void;
  onToggleAutoUpdate: (deviceId: string, value: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}

const getStatusColor = (status: Device['status']): string => {
  switch (status) {
    case 'online':
      return 'bg-green-100 text-green-800';
    case 'offline':
      return 'bg-red-100 text-red-800';
    case 'updating':
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export const DeviceCard: React.FC<DeviceCardProps> = ({ 
  device, 
  onUpdate, 
  onToggleAutoUpdate,
  onEdit,
  onDelete
}) => {
  const [expanded, setExpanded] = useState(true);
  const [isBlinking, setIsBlinking] = useState(false);

  // Blink animation every 5 seconds
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      // Use RAF for smoother animation
      requestAnimationFrame(() => {
        setTimeout(() => {
          setIsBlinking(false);
        }, 200);
      });
    }, 5000);

    return () => clearInterval(blinkInterval);
  }, []);

  const handleDownload = useCallback(async () => {
    try {
      if (!device.script_content) {
        throw new Error('No script content available');
      }

      // Extract filename from path or use default
      const filename = device.repo_path?.split('/').pop() || 'device-script.js';
      
      // Create blob from content
      const blob = new Blob([device.script_content], { type: 'text/javascript' });
      const downloadUrl = window.URL.createObjectURL(blob);
      
      // Create download link
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Cleanup
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Failed to download file. Please try again.');
    }
  }, [device.script_content, device.repo_path]);

  const toggleExpanded = useCallback(() => {
    setExpanded(prev => !prev);
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
      {/* Eyes */}
      <div className="flex justify-center space-x-4 mb-4">
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

      {/* Header with Title, Type, and Actions */}
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-2xl font-bold text-gray-900">{device.title}</h3>
          <p className="text-gray-500">{device.type}</p>
        </div>
        <div className="flex space-x-2">
          <button 
            onClick={onEdit}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Edit device"
          >
            <FaPencilAlt className="w-4 h-4" />
          </button>
          <button 
            onClick={onDelete}
            className="text-gray-400 hover:text-red-500 transition-colors"
            title="Delete device"
          >
            <FaTrash className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Value Display */}
      <div className="flex items-baseline space-x-2">
        <span className="text-6xl font-bold text-gray-900">{device.value.toFixed(1)}</span>
        <span className="text-2xl text-gray-500">{device.unit}</span>
      </div>

      {/* Status Badges */}
      <div className="flex space-x-2">
        <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(device.status)}`}>
          {device.status}
        </span>
        <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-sm flex items-center">
          <FiZap className="w-4 h-4 mr-1" />
          Script Ready
        </span>
      </div>

      {/* Expand/Collapse Button */}
      <button 
        onClick={toggleExpanded}
        className="flex items-center text-gray-500 hover:text-gray-700 transition-colors"
      >
        {expanded ? (
          <>
            <FaChevronUp className="w-4 h-4 mr-1" />
            Show less
          </>
        ) : (
          <>
            <FaChevronDown className="w-4 h-4 mr-1" />
            Show more
          </>
        )}
      </button>

      {/* Expandable Content */}
      {expanded && (
        <div className="space-y-4 pt-2">
          {/* Auto-update Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-gray-600">
              <FaSync className={`w-4 h-4 ${device.auto_update ? 'text-blue-500' : 'text-gray-400'}`} />
              <span>Auto-update {device.auto_update ? 'on' : 'off'}</span>
            </div>
            <button
              onClick={() => onToggleAutoUpdate(device.id, !device.auto_update)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                device.auto_update ? 'bg-blue-500' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  device.auto_update ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Repository Info */}
          <div className="space-y-2 text-gray-600">
            <div className="flex items-center space-x-2">
              <FaGithub className="w-4 h-4" />
              <a 
                href={device.repo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 truncate"
              >
                {device.repo_url}
              </a>
            </div>
            <div className="flex items-center space-x-2">
              <FaCodeBranch className="w-4 h-4" />
              <span>Branch: {device.repo_branch || 'main'}</span>
            </div>
            <div className="flex items-center space-x-2">
              <FaFolder className="w-4 h-4" />
              <span>Path: {device.repo_path || 'device-script.js'}</span>
            </div>
          </div>

          {/* Device Script Section */}
          <div className="flex items-center justify-between pt-2">
            <span className="font-medium">Device Script</span>
            <div className="flex space-x-2">
              <button
                onClick={() => onUpdate(device.id)}
                className="px-4 py-1 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors"
                title="Run device script"
              >
                Run Script
              </button>
              <button 
                onClick={handleDownload}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title="Download script"
              >
                <FiDownload className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};