import React, { useState, useEffect } from 'react';
import { Device } from '../types';
import { FaGithub, FaCodeBranch, FaFolder, FaInfo, FaPencilAlt, FaComments, FaDownload } from 'react-icons/fa';
import { format } from 'date-fns';
import { useDevices } from '../contexts/DeviceContext';
import { toast } from 'react-toastify';

type TabType = 'info' | 'edit' | 'chat';

interface DeviceDrawerProps {
  device: Device;
  isOpen: boolean;
  onClose: () => void;
  onSave?: (updatedDevice: Device) => void;
}

export const DeviceDrawer: React.FC<DeviceDrawerProps> = ({
  device,
  isOpen,
  onClose,
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('info');
  const [editedDevice, setEditedDevice] = useState<Device>(device);
  const [isDownloading, setIsDownloading] = useState(false);
  const hasGitHubConfig = Boolean(device.repo_url && device.repo_path && device.github_token);
  const { updateDevice, downloadDeviceScriptFile } = useDevices();

  useEffect(() => {
    setEditedDevice(device);
  }, [device]);

  const handleInputChange = (field: keyof Device, value: string) => {
    setEditedDevice(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = () => {
    onSave?.(editedDevice);
    setActiveTab('info');
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not available';
    return format(new Date(dateString), 'PPpp');
  };

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      await downloadDeviceScriptFile(device);
      toast.success('Script downloaded successfully');
    } catch (error) {
      console.error('Error downloading script:', error);
      toast.error('Failed to download script');
    } finally {
      setIsDownloading(false);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'info':
        return (
          <div className="space-y-8">
            {/* Installation Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 pb-2 border-b border-gray-200">
                Installation Details
              </h3>
              <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                <div className="flex items-center text-gray-600">
                  <span className="font-medium w-36">Status:</span>
                  <span className={`text-sm px-3 py-1 rounded-full ${
                    editedDevice.installation_status === 'Installed'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {editedDevice.installation_status || 'Not Installed'}
                  </span>
                </div>
                <div className="flex items-center text-gray-600">
                  <span className="font-medium w-36">Last Download:</span>
                  <span className="text-sm">
                    {formatDate(editedDevice.timestamp_download)}
                  </span>
                </div>
                <div className="flex items-center text-gray-600">
                  <span className="font-medium w-36">First Install:</span>
                  <span className="text-sm">
                    {formatDate(editedDevice.timestamp_first_install)}
                  </span>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <button
                    className="flex items-center text-blue-500 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleDownload}
                    disabled={isDownloading}
                  >
                    <FaDownload className="mr-2" />
                    {isDownloading ? 'Downloading...' : 'Download Latest Script'}
                  </button>
                </div>
              </div>
            </div>

            {/* Basic Device Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 pb-2 border-b border-gray-200">
                Basic Information
              </h3>
              <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                <div className="flex items-center text-gray-600">
                  <span className="font-medium w-28">Title:</span>
                  <span className="text-sm">{editedDevice.title}</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <span className="font-medium w-28">Tag:</span>
                  <span className="text-sm">{editedDevice.tag}</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <span className="font-medium w-28">Status:</span>
                  <span className={`text-sm px-3 py-1 rounded-full ${
                    editedDevice.status.toLowerCase() === 'online'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {editedDevice.status}
                  </span>
                </div>
              </div>
            </div>

            {/* GitHub Configuration */}
            {hasGitHubConfig && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 pb-2 border-b border-gray-200">
                  GitHub Configuration
                </h3>
                <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                  <div className="flex items-center text-gray-600">
                    <span className="font-medium w-28">Repository:</span>
                    <a
                      href={editedDevice.repo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-500 hover:text-blue-600 hover:underline"
                    >
                      {editedDevice.repo_url}
                    </a>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <span className="font-medium w-28">Branch:</span>
                    <span className="text-sm">
                      {editedDevice.repo_branch || 'main'}
                    </span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <span className="font-medium w-28">Path:</span>
                    <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                      {editedDevice.repo_path}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* OTA Updates */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 pb-2 border-b border-gray-200">
                OTA Updates
              </h3>
              <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                <div className="flex items-center text-gray-600">
                  <span className="font-medium w-28">Status:</span>
                  <span className={`text-sm px-3 py-1 rounded-full ${
                    editedDevice.github_status === 'up-to-date' ? 'bg-green-100 text-green-800' :
                    editedDevice.github_status === 'updating' ? 'bg-blue-100 text-blue-800' :
                    editedDevice.github_status === 'error' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {editedDevice.github_status || 'Not checked'}
                  </span>
                </div>
                
                {editedDevice.github_error && (
                  <div className="flex items-start text-gray-600">
                    <span className="font-medium w-28">Error:</span>
                    <span className="text-sm text-red-600 bg-red-50 px-3 py-1 rounded-lg">
                      {editedDevice.github_error}
                    </span>
                  </div>
                )}
                
                {editedDevice.last_github_check && (
                  <div className="flex items-center text-gray-600">
                    <span className="font-medium w-28">Last Check:</span>
                    <span className="text-sm">
                      {new Date(editedDevice.last_github_check).toLocaleString()}
                    </span>
                  </div>
                )}

                <div className="flex items-start text-gray-600">
                  <span className="font-medium w-28">File Path:</span>
                  <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                    {editedDevice.repo_path || 'Not set'}
                  </code>
                </div>

                <div className="pt-4 border-t border-gray-200 space-y-4">
                  <div className="flex items-center text-gray-600">
                    <span className="font-medium w-28">Version:</span>
                    <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">1.0.0</span>
                  </div>

                  <div className="flex items-center text-gray-600">
                    <span className="font-medium w-28">Last Update:</span>
                    <span className="text-sm">
                      {new Date().toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center text-gray-600">
                    <span className="font-medium w-28">Next Update:</span>
                    <span className="text-sm">
                      Not scheduled
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'edit':
        return (
          <div className="space-y-8">
            {/* Installation Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 pb-2 border-b border-gray-200">
                Installation Details
              </h3>
              <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                <div className="flex items-center text-gray-600">
                  <span className="font-medium w-36">Status:</span>
                  <span className={`text-sm px-3 py-1 rounded-full ${
                    editedDevice.installation_status === 'Installed'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {editedDevice.installation_status || 'Not Installed'}
                  </span>
                </div>
                <div className="flex items-center text-gray-600">
                  <span className="font-medium w-36">Last Download:</span>
                  <span className="text-sm">
                    {formatDate(editedDevice.timestamp_download)}
                  </span>
                </div>
                <div className="flex items-center text-gray-600">
                  <span className="font-medium w-36">First Install:</span>
                  <span className="text-sm">
                    {formatDate(editedDevice.timestamp_first_install)}
                  </span>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <button
                    className="flex items-center text-blue-500 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleDownload}
                    disabled={isDownloading}
                  >
                    <FaDownload className="mr-2" />
                    {isDownloading ? 'Downloading...' : 'Download Latest Script'}
                  </button>
                </div>
              </div>
            </div>

            {/* Basic Device Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 pb-2 border-b border-gray-200">
                Basic Information
              </h3>
              <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                <div className="flex items-center text-gray-600">
                  <span className="font-medium w-28">Title:</span>
                  <input
                    type="text"
                    className="flex-1 text-sm p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                    value={editedDevice.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                  />
                </div>
                <div className="flex items-center text-gray-600">
                  <span className="font-medium w-28">Tag:</span>
                  <input
                    type="text"
                    className="flex-1 text-sm p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                    value={editedDevice.tag || ''}
                    onChange={(e) => handleInputChange('type', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* GitHub Configuration */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 pb-2 border-b border-gray-200">
                GitHub Configuration
              </h3>
              <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                <div className="flex items-center text-gray-600">
                  <span className="font-medium w-28">Repository:</span>
                  <input
                    type="text"
                    className="flex-1 text-sm p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                    value={editedDevice.repo_url || ''}
                    onChange={(e) => handleInputChange('repo_url', e.target.value)}
                  />
                </div>
                <div className="flex items-center text-gray-600">
                  <span className="font-medium w-28">Branch:</span>
                  <input
                    type="text"
                    className="flex-1 text-sm p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                    value={editedDevice.repo_branch || ''}
                    onChange={(e) => handleInputChange('repo_branch', e.target.value)}
                  />
                </div>
                <div className="flex items-center text-gray-600">
                  <span className="font-medium w-28">Path:</span>
                  <input
                    type="text"
                    className="flex-1 text-sm p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                    value={editedDevice.repo_path || ''}
                    onChange={(e) => handleInputChange('repo_path', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 'chat':
        return (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Chat messages will go here */}
              <div className="text-center text-gray-500">
                Chat functionality coming soon...
              </div>
            </div>
            <div className="p-4 border-t border-gray-200">
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Type a message..."
                  className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <button
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity z-40"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 h-full w-[480px] bg-white shadow-xl transform transition-transform duration-300 ease-in-out z-50 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">
                {editedDevice.title}
              </h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Tabs */}
            <div className="flex space-x-1">
              <button
                onClick={() => setActiveTab('info')}
                className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'info'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <FaInfo className="mr-2" />
                Info
              </button>
              <button
                onClick={() => setActiveTab('edit')}
                className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'edit'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <FaPencilAlt className="mr-2" />
                Edit
              </button>
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'chat'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <FaComments className="mr-2" />
                Chat
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              {renderTabContent()}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            {activeTab === 'edit' ? (
              <div className="flex space-x-3">
                <button
                  onClick={() => setActiveTab('info')}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Save Changes
                </button>
              </div>
            ) : activeTab === 'info' && (
              <button
                className={`w-full py-2.5 px-4 rounded-lg text-white text-sm font-medium transition-colors ${
                  editedDevice.github_status === 'updating'
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600'
                }`}
                disabled={editedDevice.github_status === 'updating'}
              >
                {editedDevice.github_status === 'updating' ? 'Updating...' : 'Check for Updates'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default DeviceDrawer;
