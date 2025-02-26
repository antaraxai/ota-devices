import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { FaUser, FaCog, FaBell, FaSignOutAlt, FaChartBar, FaHome, FaRocket, FaChevronLeft } from 'react-icons/fa';
import DeploymentPreview from '../components/DeploymentPreview';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const { unreadCount, markAllAsRead } = useNotifications();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className={`${isSidebarCollapsed ? 'w-16' : 'w-64'} bg-white border-r border-gray-200 min-h-screen transition-all duration-300 ease-in-out relative`}>
        <div className="flex items-center justify-center h-16 border-b border-gray-200">
          <span className={`text-2xl font-bold text-indigo-600 transition-opacity duration-300 ${isSidebarCollapsed ? 'opacity-0' : 'opacity-100'}`}>
            Antara
          </span>
        </div>
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute -right-3 top-20 bg-white border border-gray-200 rounded-full p-1 shadow-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <FaChevronLeft className={`h-4 w-4 text-gray-600 transition-transform duration-300 ${isSidebarCollapsed ? 'rotate-180' : ''}`} />
        </button>
        <nav className="mt-6 px-4 space-y-4">
          <a href="#" className={`flex items-center ${isSidebarCollapsed ? 'px-2' : 'px-4'} py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
            <FaHome className="h-5 w-5" />
            <span className={`ml-3 transition-opacity duration-300 ${isSidebarCollapsed ? 'hidden' : 'block'}`}>
              Dashboard
            </span>
          </a>
          <button
            onClick={() => window.location.href = '/subscription'}
            className={`w-full flex items-center ${isSidebarCollapsed ? 'px-2' : 'px-4'} py-2 text-gray-700 hover:bg-gray-100 rounded-md ${isSidebarCollapsed ? 'justify-center' : ''}`}
          >
            <FaRocket className="h-5 w-5" />
            <span className={`ml-3 transition-opacity duration-300 ${isSidebarCollapsed ? 'hidden' : 'block'}`}>
              Upgrade to Pro
            </span>
          </button>
          <button className={`w-full flex items-center ${isSidebarCollapsed ? 'px-2' : 'px-4'} py-2 text-gray-700 hover:bg-gray-100 rounded-md ${isSidebarCollapsed ? 'justify-center' : ''}`}>
            <FaChartBar className="h-5 w-5" />
            <span className={`ml-3 transition-opacity duration-300 ${isSidebarCollapsed ? 'hidden' : 'block'}`}>
              Analytics
            </span>
          </button>
        </nav>
      </div>

      <div className="flex-1">
        {/* Top Navigation */}
        <nav className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-end h-16">
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
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5 z-50">
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
        <main className="py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">Deployments</h1>
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="p-6">
              <DeploymentPreview />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
