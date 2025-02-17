import React, { useState, useEffect } from 'react';
import { Device } from '../types';
import { FaGithub, FaCodeBranch, FaFolder, FaInfo, FaPencilAlt, FaComments, FaDownload, FaTerminal, FaDesktop } from 'react-icons/fa';
import { format } from 'date-fns';
import { useDevices } from '../contexts/DeviceContext';
import { toast } from 'react-toastify';
import DeviceController from './DeviceController';
import ChatPanel from './ChatPanel';
// import DemoView from './DemoView';

type TabType = 'info' | 'edit' | 'chat' | 'controller';

interface DeviceDrawerProps {
  device: Device;
  isOpen: boolean;
  onClose: () => void;
  onSave?: (updatedDevice: Device) => void;
  initialTab?: TabType;
}

export const DeviceDrawer: React.FC<DeviceDrawerProps> = ({
  device,
  isOpen,
  onClose,
  onSave,
  initialTab = 'info',
}) => {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [editedDevice, setEditedDevice] = useState<Device>(device);
  const [isDownloading, setIsDownloading] = useState(false);
  const hasGitHubConfig = Boolean(device.repo_url && device.repo_path && device.github_token);
  const { updateDevice, downloadDeviceScriptFile } = useDevices();

  useEffect(() => {
    setEditedDevice(device);
  }, [device]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

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
      case 'controller':
        return <DeviceController deviceId={device.id} />;
      // case 'demo':
      //   return <DemoView deviceId={device.id} />;
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
                  <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${
                    editedDevice.status === 'ONLINE'
                      ? 'bg-green-100 text-green-800'
                      : editedDevice.status === 'OFFLINE'
                      ? 'bg-red-100 text-red-800'
                      : editedDevice.status === 'AWAITING_CONNECTION'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {editedDevice.status === 'ONLINE' ? 'Online' :
                     editedDevice.status === 'OFFLINE' ? 'Offline' :
                     editedDevice.status === 'AWAITING_CONNECTION' ? 'Awaiting connection' :
                     'Unknown'}
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
                  <span className="text-gray-900">{editedDevice.device_tag}</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <span className="font-medium w-28">Status:</span>
                  <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${
                    editedDevice.status === 'ONLINE'
                      ? 'bg-green-100 text-green-800'
                      : editedDevice.status === 'OFFLINE'
                      ? 'bg-red-100 text-red-800'
                      : editedDevice.status === 'AWAITING_CONNECTION'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {editedDevice.status === 'ONLINE' ? 'Online' :
                     editedDevice.status === 'OFFLINE' ? 'Offline' :
                     editedDevice.status === 'AWAITING_CONNECTION' ? 'Awaiting connection' :
                     'Unknown'}
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
                  <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${
                    editedDevice.status === 'ONLINE'
                      ? 'bg-green-100 text-green-800'
                      : editedDevice.status === 'OFFLINE'
                      ? 'bg-red-100 text-red-800'
                      : editedDevice.status === 'AWAITING_CONNECTION'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {editedDevice.status === 'ONLINE' ? 'Online' :
                     editedDevice.status === 'OFFLINE' ? 'Offline' :
                     editedDevice.status === 'AWAITING_CONNECTION' ? 'Awaiting connection' :
                     'Unknown'}
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
                    value={editedDevice.device_tag || ''}
                    onChange={(e) => handleInputChange('device_tag', e.target.value)}
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
        return <ChatPanel deviceId={device.id} />;
    }
  };

  return (
    <div
      className={`fixed inset-y-0 right-0 w-[48rem] bg-white shadow-xl transform transition-transform duration-300 ease-in-out z-50 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">Device Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <span className="sr-only">Close panel</span>
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px">
          <button
            onClick={() => setActiveTab('info')}
            className={`${
              activeTab === 'info'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } flex-1 py-4 px-1 text-center border-b-2 font-medium text-sm items-center justify-center inline-flex`}
          >
            <FaInfo className="mr-2" />
            Info
          </button>
          <button
            onClick={() => setActiveTab('edit')}
            className={`${
              activeTab === 'edit'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } flex-1 py-4 px-1 text-center border-b-2 font-medium text-sm items-center justify-center inline-flex`}
          >
            <FaPencilAlt className="mr-2" />
            Edit
          </button>
          <button
            onClick={() => setActiveTab('controller')}
            className={`${
              activeTab === 'controller'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } flex items-center whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}
          >
            <FaDesktop className="mr-2" />
            Device Control
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`${
              activeTab === 'chat'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } flex-1 py-4 px-1 text-center border-b-2 font-medium text-sm items-center justify-center inline-flex`}
          >
            <FaComments className="mr-2" />
            Chat
          </button>
          {/* <button
            onClick={() => setActiveTab('demo')}
            className={`${
              activeTab === 'demo'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } flex-1 py-4 px-1 text-center border-b-2 font-medium text-sm items-center justify-center inline-flex`}
          >
            <FaDesktop className="mr-2" />
            Demo
          </button> */}
        </nav>
      </div>

      {/* Content */}
      <div className="relative z-50 flex flex-col flex-1 bg-white overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default DeviceDrawer;
