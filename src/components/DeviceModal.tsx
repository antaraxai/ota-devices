import { useState, useEffect } from 'react';
import { Device, DeviceType, CreateDeviceInput } from '../types/device';
import { useDeviceContext } from '../contexts/DeviceContext';
import { supabase } from '../lib/supabase';

interface DeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateDeviceInput) => Promise<Device>;
  device?: Device;
  title: string;
}

export default function DeviceModal({ isOpen, onClose, onSubmit, device, title }: DeviceModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<CreateDeviceInput>({
    title: '',
    tag: '',
    auto_update: false,
    repo_url: '',
    repo_branch: 'main',
    repo_path: '',
    github_token: '',
    github_username: '',
  });
  const [createdDevice, setCreatedDevice] = useState<Device | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { downloadDeviceScriptFile } = useDeviceContext();

  useEffect(() => {
    if (device) {
      setFormData({
        title: device.title,
        tag: device.tag,
        auto_update: device.auto_update,
        repo_url: device.repo_url || '',
        repo_branch: device.repo_branch || 'main',
        repo_path: device.repo_path || '',
        github_token: device.github_token || '',
        github_username: device.github_username || '',
      });
    } else {
      setFormData({
        title: '',
        tag: '',
        auto_update: false,
        repo_url: '',
        repo_branch: 'main',
        repo_path: '',
        github_token: '',
        github_username: '',
      });
    }
    setCurrentStep(1);
    setCreatedDevice(null);
  }, [device, isOpen]);

  useEffect(() => {
    if (createdDevice) {
      // Subscribe to device updates
      const channel = supabase
        .channel(`device_${createdDevice.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'devices',
            filter: `id=eq.${createdDevice.id}`
          },
          (payload) => {
            console.log('Device update:', payload);
            setCreatedDevice(prev => ({
              ...prev!,
              ...payload.new
            }));
          }
        )
        .subscribe();

      // Cleanup subscription
      return () => {
        channel.unsubscribe();
      };
    }
  }, [createdDevice?.id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (currentStep === 1) {
        setCurrentStep(2);
      } else if (currentStep === 2) {
        setIsSubmitting(true);
        console.log('Creating device with data:', formData);
        const newDevice = await onSubmit(formData);
        console.log('Device created:', newDevice);
        setCreatedDevice(newDevice);
        setCurrentStep(3);
      } else {
        onClose();
      }
    } catch (error) {
      console.error('Error submitting device:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadAgent = async () => {
    console.log('Current device:', createdDevice);
    if (!createdDevice) {
      console.error('No device created yet');
      return;
    }

    try {
      await downloadDeviceScriptFile(createdDevice);
    } catch (error) {
      console.error('Error downloading agent:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">{title}</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {currentStep === 1 ? (
              <>
                <h3 className="text-2xl font-normal text-gray-900 mb-8">Step 1 of 3: Basic Information</h3>
                <div className="space-y-6">
                  <div>
                    <label className="block text-lg text-gray-700 mb-2">Device Name</label>
                    <input
                      type="text"
                      name="title"
                      value={formData.title}
                      onChange={handleChange}
                      className="block w-full rounded-lg border-gray-300 bg-gray-50 p-3 text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Enter device name"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-lg text-gray-700 mb-2">Device Tag</label>
                    <input
                      type="text"
                      name="tag"
                      value={formData.tag}
                      onChange={handleChange}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter device tag (e.g., thermostat, light, camera)"
                      required
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      This tag helps identify and group your devices
                    </p>
                  </div>

                  <div className="flex items-center pt-4">
                    <input
                      type="checkbox"
                      name="auto_update"
                      checked={formData.auto_update}
                      onChange={handleChange}
                      className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label className="ml-3 text-lg text-gray-700">
                      Enable Auto Update
                    </label>
                  </div>
                </div>
              </>
            ) : currentStep === 2 ? (
              <>
                <h3 className="text-2xl font-normal text-gray-900 mb-8">Step 2 of 3: GitHub Integration</h3>
                <div className="space-y-6">
                  <div>
                    <label className="block text-lg text-gray-700 mb-2">Repository URL</label>
                    <input
                      type="text"
                      name="repo_url"
                      value={formData.repo_url}
                      onChange={handleChange}
                      className="block w-full rounded-lg border-gray-300 bg-gray-50 p-3 text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="https://github.com/username/repo"
                    />
                  </div>

                  <div>
                    <label className="block text-lg text-gray-700 mb-2">Branch</label>
                    <input
                      type="text"
                      name="repo_branch"
                      value={formData.repo_branch}
                      onChange={handleChange}
                      className="block w-full rounded-lg border-gray-300 bg-gray-50 p-3 text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="main"
                    />
                  </div>

                  <div>
                    <label className="block text-lg text-gray-700 mb-2">File Path</label>
                    <input
                      type="text"
                      name="repo_path"
                      value={formData.repo_path}
                      onChange={handleChange}
                      className="block w-full rounded-lg border-gray-300 bg-gray-50 p-3 text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="path/to/file.py"
                    />
                  </div>

                  <div>
                    <label className="block text-lg text-gray-700 mb-2">GitHub Username</label>
                    <input
                      type="text"
                      name="github_username"
                      value={formData.github_username}
                      onChange={handleChange}
                      className="block w-full rounded-lg border-gray-300 bg-gray-50 p-3 text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="username"
                    />
                  </div>

                  <div>
                    <label className="block text-lg text-gray-700 mb-2">GitHub Token</label>
                    <input
                      type="password"
                      name="github_token"
                      value={formData.github_token}
                      onChange={handleChange}
                      className="block w-full rounded-lg border-gray-300 bg-gray-50 p-3 text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="ghp_xxxxxxxxxxxxxx"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-2xl font-normal text-gray-900 mb-8">Step 3 of 3: Download Agent</h3>
                <div className="space-y-6">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-medium text-gray-500">Status</span>
                      <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${
                        createdDevice?.status === 'online'
                          ? 'bg-green-100 text-green-800'
                          : createdDevice?.status === 'offline'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {createdDevice?.status === 'online' ? 'Online' :
                         createdDevice?.status === 'offline' ? 'Offline' :
                         'Awaiting connection'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mb-4">
                      {createdDevice?.status === 'online' 
                        ? 'Your device is connected and ready to use.'
                        : createdDevice?.status === 'offline'
                        ? 'Your device is currently offline. Please check the connection.'
                        : 'Your device has been created. Download and install the agent on your device to establish the connection.'}
                    </div>
                    <button
                      type="button"
                      onClick={handleDownloadAgent}
                      className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                      Download Agent
                    </button>
                  </div>
                </div>
              </>
            )}

            <div className="mt-6 flex justify-end space-x-3">
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={() => setCurrentStep(currentStep - 1)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Back
                </button>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {currentStep === 3 ? 'Done' : (currentStep === 2 ? (isSubmitting ? 'Creating...' : 'Create') : 'Next')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
