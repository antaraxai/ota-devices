import React, { useState, useEffect, useCallback } from 'react';
import { Device } from '../types';
import { FaGithub, FaCodeBranch, FaFolder, FaSync, FaChevronUp, FaChevronDown, FaPencilAlt, FaTrash } from 'react-icons/fa';
import { FiZap, FiDownload } from 'react-icons/fi';
import { useDevices } from '../contexts/DeviceContext';
import { toast } from 'react-toastify'; // Assuming you have a toast library

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
  const { downloadGitHubFile } = useDevices();
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

  const handleFetchFromGitHub = async () => {
    try {
      await downloadGitHubFile(device.id);
    } catch (error) {
      console.error('Error downloading script:', error);
    }
  };

  const handleDownloadScript = useCallback(async () => {
    try {
      if (!device.script_content) {
        toast.error('No script content available');
        return;
      }

      // Get filename from repo_path or fallback to a default name
      const filename = device.repo_path 
        ? device.repo_path.split('/').pop() || 'script.js'
        : `${device.title.toLowerCase().replace(/\s+/g, '-')}-script.js`;

      // Create a blob from the script content
      const blob = new Blob([device.script_content], { type: 'text/javascript' });
      const url = URL.createObjectURL(blob);

      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the URL
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading script:', error);
      toast.error('Failed to download script');
    }
  }, [device.script_content, device.repo_path, device.title]);

  const hasGitHubConfig = Boolean(device.repo_url && device.repo_path && device.github_token);

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

          {/* GitHub integration section */}
          {hasGitHubConfig && (
            <div className="mt-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FaGithub className="text-gray-600" />
                  <span className="text-sm text-gray-600">GitHub Connected</span>
                </div>
                <button
                  onClick={handleFetchFromGitHub}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                >
                  <FaSync className="w-4 h-4" />
                  <span>Fetch Latest</span>
                </button>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                <div className="flex items-center space-x-2">
                  <FaCodeBranch className="w-3 h-3" />
                  <span>{device.repo_branch || 'main'}</span>
                </div>
                <div className="flex items-center space-x-2 mt-1">
                  <FaFolder className="w-3 h-3" />
                  <span>{device.repo_path}</span>
                </div>
              </div>
            </div>
          )}

          {/* Device Script Section */}
          <div className="mt-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">Device Script</span>
              {device.script_content && (
                <div className="flex space-x-2">
                  <button
                    onClick={handleDownloadScript}
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                    title="Download script"
                  >
                    <FiDownload className="w-4 h-4" />
                    <span>Download</span>
                  </button>
                </div>
              )}
            </div>
            {device.script_content ? (
              <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                {device.script_content.slice(0, 100)}...
              </pre>
            ) : (
              <p className="text-sm text-gray-500 mt-2">
                {hasGitHubConfig ? 'Click "Fetch Latest" to get the script from GitHub' : 'No script available'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};