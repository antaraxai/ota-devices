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

const deviceTags = [
  'thermostat',
  'light',
  'camera',
  'sensor',
  'switch',
  'security',
  'automation',
  'other'
];

export default function DeviceModal({ isOpen, onClose, onSubmit, device, title }: DeviceModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<CreateDeviceInput>({
    title: '',
    device_tag: '',
    auto_update: false,
    repo_type: 'gitlab',
    repo_url: 'https://gitlab.com/reka-dev/underground/antara',
    repo_branch: 'main',
    repo_path: 'src/templates/index.html',
    github_token: 'gldt-kcGncapSUAPx9BPW4cxC',
    github_username: 'gitlab+deploy-token-6867370'
  });
  const [createdDevice, setCreatedDevice] = useState<Device | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCustomTag, setIsCustomTag] = useState(false);
  const [customTagValue, setCustomTagValue] = useState('');

  const { downloadDeviceScriptFile } = useDeviceContext();

  useEffect(() => {
    if (device) {
      setFormData({
        title: device.title,
        device_tag: device.device_tag,
        auto_update: device.auto_update,
        repo_type: device.repo_type || 'gitlab',
        repo_url: device.repo_url || 'https://gitlab.com/reka-dev/underground/antara',
        repo_branch: device.repo_branch || 'main',
        repo_path: device.repo_path || 'src/templates/index.html',
        github_token: device.github_token || 'gldt-kcGncapSUAPx9BPW4cxC',
        github_username: device.github_username || 'gitlab+deploy-token-6867370'
      });
    } else {
      setFormData({
        title: '',
        device_tag: '',
        auto_update: false,
        repo_type: 'gitlab',
        repo_url: 'https://gitlab.com/reka-dev/underground/antara',
        repo_branch: 'main',
        repo_path: 'src/templates/index.html',
        github_token: 'gldt-kcGncapSUAPx9BPW4cxC',
        github_username: 'gitlab+deploy-token-6867370'
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

  const handleRepoTypeChange = (repoType: string) => {
    if (repoType === 'gitlab') {
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
  };

  const handleTagChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const value = e.target.value;
    if (value === 'custom') {
      setIsCustomTag(true);
      setFormData(prev => ({ ...prev, device_tag: customTagValue }));
    } else {
      setIsCustomTag(false);
      setFormData(prev => ({ ...prev, device_tag: value }));
    }
  };

  const handleCustomTagChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomTagValue(value);
    setFormData(prev => ({ ...prev, device_tag: value }));
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
                    <label className="block text-xl text-gray-700 mb-2">Device Tag</label>
                    <div className="space-y-2">
                      {!isCustomTag ? (
                        <div className="relative">
                          <select
                            name="device_tag"
                            value={formData.device_tag || ''}
                            onChange={handleTagChange}
                            className="appearance-none w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer pr-10"
                            required
                          >
                            <option value="" disabled>Select a device type</option>
                            {deviceTags.map((tag) => (
                              <option key={tag} value={tag} className="py-2">
                                {tag.charAt(0).toUpperCase() + tag.slice(1)}
                              </option>
                            ))}
                            <option value="custom" className="py-2">Create new tag...</option>
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                      ) : (
                        <div className="relative">
                          <input
                            type="text"
                            value={customTagValue}
                            onChange={handleCustomTagChange}
                            placeholder="Enter custom tag"
                            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setIsCustomTag(false);
                              setCustomTagValue('');
                              setFormData(prev => ({ ...prev, device_tag: '' }));
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full"
                          >
                            <svg className="h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-gray-500">
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
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div 
                      className={`bg-white rounded-lg p-4 border ${formData.repo_type === 'gitlab' ? 'border-[#FC6D26]' : 'border-gray-200'} cursor-pointer`}
                      onClick={() => handleRepoTypeChange('gitlab')}
                    >
                      <h4 className="text-lg mb-3 text-gray-900">Importing from GitLab</h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5 text-[#FC6D26] shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M23.955 13.587l-1.342-4.135-2.664-8.189a.455.455 0 0 0-.867 0L16.418 9.45H7.582L4.918 1.263a.455.455 0 0 0-.867 0L1.387 9.452.045 13.587a.924.924 0 0 0 .331 1.023L12 23.054l11.624-8.443a.924.924 0 0 0 .331-1.024" />
                          </svg>
                          <span className="text-sm text-gray-900 truncate">reka-dev/underground/antara</span>
                        </div>
                        <div className="flex items-center bg-gray-100 px-2 py-1 rounded-lg w-fit">
                          <svg className="w-4 h-4 mr-1 text-gray-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M6 3v12m0 0a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm12 0a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm0 0V8a2 2 0 0 0-2-2h-4l-2-2" />
                          </svg>
                          <span className="text-sm text-gray-700">main</span>
                        </div>
                      </div>
                    </div>

                    <div 
                      className={`bg-white rounded-lg p-4 border ${formData.repo_type === 'github' ? 'border-black' : 'border-gray-200'} cursor-pointer`}
                      onClick={() => handleRepoTypeChange('github')}
                    >
                      <h4 className="text-lg mb-3 text-gray-900">Importing from GitHub</h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <svg className="w-5 h-5 text-black shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                          </svg>
                          <span className="text-sm text-gray-900 truncate">username/repository</span>
                        </div>
                        <div className="flex items-center bg-gray-100 px-2 py-1 rounded-lg w-fit">
                          <svg className="w-4 h-4 mr-1 text-gray-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M6 3v12m0 0a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm12 0a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm0 0V8a2 2 0 0 0-2-2h-4l-2-2" />
                          </svg>
                          <span className="text-sm text-gray-700">main</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Repository Configuration Fields */}
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Repository URL</label>
                      <input
                        type="text"
                        name="repo_url"
                        value={formData.repo_url}
                        onChange={handleChange}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={formData.repo_type === 'gitlab' ? 'https://gitlab.com/username/repo' : 'https://github.com/username/repo'}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                      <input
                        type="text"
                        name="repo_branch"
                        value={formData.repo_branch}
                        onChange={handleChange}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="main"
                        required
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">File Path</label>
                      <input
                        type="text"
                        name="repo_path"
                        value={formData.repo_path}
                        onChange={handleChange}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="path/to/file.py"
                        required
                      />
                    </div>

                    {formData.repo_type === 'github' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">GitHub Username</label>
                          <input
                            type="text"
                            name="github_username"
                            value={formData.github_username}
                            onChange={handleChange}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="username"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">GitHub Token</label>
                          <input
                            type="password"
                            name="github_token"
                            value={formData.github_token}
                            onChange={handleChange}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter your GitHub token"
                            required
                          />
                        </div>
                      </>
                    )}
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
                      {createdDevice?.status === 'online' 
                        ? 'Your device is connected and ready to use.'
                        : createdDevice?.status === 'offline'
                        ? 'Your device is currently offline. Please check the connection.'
                        : createdDevice?.status === 'awaiting connection'
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
