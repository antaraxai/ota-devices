import { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDevices } from '../contexts/DeviceContext';
import { useNotifications } from '../contexts/NotificationContext';
import { FaUser, FaCog, FaBell, FaSignOutAlt, FaPlus, FaChartBar, FaTrash, FaEdit, FaTable, FaTh, FaGithub } from 'react-icons/fa';
import { DeviceCard } from '../components/DeviceCard';
import DeviceTable from '../components/DeviceTable';
import DeviceModal from '../components/DeviceModal';
import { CreateDeviceInput } from '../types/device';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const { devices, loading, createDevice, updateDevice, deleteDevice } = useDevices();
  const { unreadCount, markAllAsRead } = useNotifications();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [expandedDevices, setExpandedDevices] = useState<Set<string>>(new Set());
  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleCreateDevice = async (data: CreateDeviceInput) => {
    try {
      const newDevice = await createDevice(data);
      return newDevice;
    } catch (error) {
      console.error('Error creating device:', error);
      throw error;
    }
  };

  const handleUpdateDevice = async (data: CreateDeviceInput) => {
    try {
      if (!selectedDevice) {
        throw new Error('No device selected for update');
      }
      await updateDevice(selectedDevice.id, data);
      setSelectedDevice(null);
    } catch (error) {
      console.error('Error updating device:', error);
      throw error;
    }
  };

  const handleDeleteDevice = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this device?')) {
      await deleteDevice(id);
    }
  };

  const handleToggleExpand = useCallback((deviceId: string) => {
    setExpandedDevices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(deviceId)) {
        newSet.delete(deviceId);
      } else {
        newSet.add(deviceId);
      }
      return newSet;
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="text-2xl font-bold text-indigo-600">Antara</span>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <button 
                  onClick={() => {
                    setIsNotificationMenuOpen(!isNotificationMenuOpen);
                    if (unreadCount > 0) markAllAsRead();
                  }}
                  className="p-2 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-full relative"
                >
                  <FaBell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-500 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </button>
                
                {isNotificationMenuOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5">
                    <div className="px-4 py-2 text-sm font-medium text-gray-700 border-b border-gray-100">
                      Notifications
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {devices.filter(d => d.script_content).map(device => (
                        <div key={`notification-${device.id}`} className="px-4 py-3 hover:bg-gray-50">
                          <div className="flex items-start">
                            <div className="flex-shrink-0">
                              <FaGithub className="h-5 w-5 text-gray-400" />
                            </div>
                            <div className="ml-3">
                              <p className="text-sm font-medium text-gray-900">
                                {device.title}
                              </p>
                              <p className="text-sm text-gray-500">
                                Script updated from GitHub
                              </p>
                              <p className="mt-1 text-xs text-gray-400">
                                {new Date(device.updated_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="relative">
                <button
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="flex items-center space-x-2 p-2 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center">
                    <FaUser className="h-4 w-4 text-white" />
                  </div>
                </button>
                
                {isProfileMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5">
                    <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-100">
                      {user?.email}
                    </div>
                    <button
                      onClick={() => {/* TODO: Implement settings */}}
                      className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <FaCog className="mr-3 h-4 w-4" />
                      Settings
                    </button>
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <FaSignOutAlt className="mr-3 h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Quick Actions */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-3">
                <button
                  onClick={() => {
                    setSelectedDevice(null);
                    setIsDeviceModalOpen(true);
                  }}
                  className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <FaPlus className="mr-2 h-4 w-4" />
                  Add New Device
                </button>
                <button className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                  <FaChartBar className="mr-2 h-4 w-4" />
                  View Analytics
                </button>
              </div>
            </div>
          </div>

          {/* Connected Devices */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h1 className="text-2xl font-semibold text-gray-900">Connected Devices</h1>
                  <div className="flex space-x-4">
                    <div className="flex space-x-2 bg-gray-100 p-1 rounded-lg">
                      <button
                        onClick={() => setViewMode('card')}
                        className={`p-2 rounded ${viewMode === 'card' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                        title="Card View"
                      >
                        <FaTh className="h-5 w-5 text-gray-600" />
                      </button>
                      <button
                        onClick={() => setViewMode('table')}
                        className={`p-2 rounded ${viewMode === 'table' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                        title="Table View"
                      >
                        <FaTable className="h-5 w-5 text-gray-600" />
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedDevice(null);
                        setIsDeviceModalOpen(true);
                      }}
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <FaPlus className="-ml-1 mr-2 h-5 w-5" />
                      Add Device
                    </button>
                  </div>
                </div>

                {loading ? (
                  <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                  </div>
                ) : viewMode === 'card' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 p-4">
                    {devices.map((device) => (
                      <DeviceCard
                        key={device.id}
                        device={device}
                        onUpdate={() => updateDevice(device.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <DeviceTable
                    devices={devices}
                    onUpdate={updateDevice}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Device Modal */}
      <DeviceModal
        isOpen={isDeviceModalOpen}
        onClose={() => {
          setIsDeviceModalOpen(false);
          setSelectedDevice(null);
        }}
        onSubmit={selectedDevice ? handleUpdateDevice : handleCreateDevice}
        device={selectedDevice}
        title={selectedDevice ? 'Edit Device' : 'Add New Device'}
      />
    </div>
  );
}
