import React from 'react';
import { Device } from '../types';
import { FaGithub, FaCodeBranch, FaFolder } from 'react-icons/fa';

interface DeviceDetailsModalProps {
  device: Device;
  isOpen: boolean;
  onClose: () => void;
}

export const DeviceDetailsModal: React.FC<DeviceDetailsModalProps> = ({
  device,
  isOpen,
  onClose,
}) => {
  const hasGitHubConfig = Boolean(device.repo_url && device.repo_path && device.github_token);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" onClick={onClose}>
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  {device.title} Details
                </h3>
                
                <div className="space-y-4">
                  {/* GitHub Configuration */}
                  {hasGitHubConfig && (
                    <div className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center text-gray-600">
                        <FaGithub className="w-5 h-5 mr-2" />
                        <a
                          href={device.repo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-600"
                        >
                          {device.repo_url}
                        </a>
                      </div>
                      <div className="flex items-center text-gray-600">
                        <FaCodeBranch className="w-5 h-5 mr-2" />
                        <span>Branch: {device.repo_branch || 'main'}</span>
                      </div>
                      <div className="flex items-center text-gray-600">
                        <FaFolder className="w-5 h-5 mr-2" />
                        <span>Path: {device.repo_path}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={onClose}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeviceDetailsModal;
