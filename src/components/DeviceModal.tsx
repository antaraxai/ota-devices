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
    repo_type: 'github',
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
        repo_type: device.repo_type || 'github',
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
        repo_type: 'github',
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
    
    // Handle repo_type change specially
    if (name === 'repo_type') {
      if (value === 'gitlab') {
        // Set hardcoded values for GitLab
        setFormData(prev => ({
          ...prev,
          repo_type: 'gitlab',
          repo_url: 'https://gitlab.com/reka-dev/underground/antara',
          repo_branch: 'main',
          repo_path: 'src/templates/index.html',
          github_token: 'gldt-kcGncapSUAPx9BPW4cxC',
          github_username: 'gitlab+deploy-token-6867370'
        }));
      } else {
        // Reset values for GitHub
        setFormData(prev => ({
          ...prev,
          repo_type: 'github',
          repo_url: '',
          repo_branch: 'main',
          repo_path: '',
          github_token: '',
          github_username: ''
        }));
      }
    } else {
      // Handle other form field changes normally
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
      }));
    }
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
                <h3 className="text-2xl font-normal text-gray-900 mb-8">
                  Step 2 of 3: Repository Integration
                </h3>
                <div className="space-y-6">
                  <div>
                    <label className="block text-lg text-gray-700 mb-2">Repository Type</label>
                    <select
                      name="repo_type"
                      value={formData.repo_type}
                      onChange={handleChange}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="github">GitHub</option>
                      <option value="gitlab">GitLab</option>
                    </select>
                  </div>

                  {formData.repo_type === 'github' ? (
                    <>
                      <div>
                        <label className="block text-lg text-gray-700 mb-2">Repository URL</label>
                        <input
                          type="text"
                          name="repo_url"
                          value={formData.repo_url}
                          onChange={handleChange}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="https://github.com/username/repo"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-lg text-gray-700 mb-2">Branch</label>
                        <input
                          type="text"
                          name="repo_branch"
                          value={formData.repo_branch}
                          onChange={handleChange}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="main"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-lg text-gray-700 mb-2">File Path</label>
                        <input
                          type="text"
                          name="repo_path"
                          value={formData.repo_path}
                          onChange={handleChange}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="path/to/file.py"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-lg text-gray-700 mb-2">GitHub Username</label>
                        <input
                          type="text"
                          name="github_username"
                          value={formData.github_username}
                          onChange={handleChange}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="username"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-lg text-gray-700 mb-2">GitHub Token</label>
                        <input
                          type="password"
                          name="github_token"
                          value={formData.github_token}
                          onChange={handleChange}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter your GitHub token"
                          required
                        />
                        <p className="mt-1 text-sm text-gray-500">
                          Create a GitHub Personal Access Token with repo scope
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="bg-white rounded-lg p-6 border border-gray-200">
                      <h4 className="text-xl mb-4 text-gray-900">Importing from GitLab</h4>
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <svg className="w-6 h-6 text-[#FC6D26] shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M23.955 13.587l-1.342-4.135-2.664-8.189a.455.455 0 0 0-.867 0L16.418 9.45H7.582L4.918 1.263a.455.455 0 0 0-.867 0L1.387 9.452.045 13.587a.924.924 0 0 0 .331 1.023L12 23.054l11.624-8.443a.924.924 0 0 0 .331-1.024" />
                          </svg>
                          <span className="text-lg text-gray-900">reka-dev/underground/antara</span>
                        </div>
                        <div className="flex items-center bg-gray-100 px-3 py-1 rounded-lg w-fit">
                          <svg className="w-4 h-4 mr-2 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M6 3v12m0 0a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm12 0a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm0 0V8a2 2 0 0 0-2-2h-4l-2-2" />
                          </svg>
                          <span className="text-gray-700">main</span>
                        </div>
                      </div>
                    </div>
                  )}
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
                        createdDevice?.status === 'ONLINE'
                          ? 'bg-green-100 text-green-800'
                          : createdDevice?.status === 'OFFLINE'
                          ? 'bg-red-100 text-red-800'
                          : createdDevice?.status === 'AWAITING_CONNECTION'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {createdDevice?.status === 'ONLINE' ? 'Online' :
                         createdDevice?.status === 'OFFLINE' ? 'Offline' :
                         createdDevice?.status === 'AWAITING_CONNECTION' ? 'Awaiting connection' :
                         'Unknown'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mb-4">
                      {createdDevice?.status === 'ONLINE' 
                        ? 'Your device is connected and ready to use.'
                        : createdDevice?.status === 'OFFLINE'
                        ? 'Your device is currently offline. Please check the connection.'
                        : createdDevice?.status === 'AWAITING_CONNECTION'
                        ? 'Your device has been created. Download and install the agent on your device to establish the connection.'
                        : 'Device status unknown.'}
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
