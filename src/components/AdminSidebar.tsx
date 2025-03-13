import React from 'react';
import { Link } from 'react-router-dom';
import { FaChevronLeft, FaHouse, FaRocket, FaGear, FaShieldHalved, FaUsers, FaClipboard } from 'react-icons/fa6';

interface AdminSidebarProps {
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  currentPath: string;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({ 
  isSidebarCollapsed, 
  setIsSidebarCollapsed,
  currentPath
}) => {

  // Main routes are now directly used in the JSX

  // Define routes
  const adminSubRoutes = [
    { path: '/admin/users', name: 'User Management', icon: FaUsers },
    { path: '/admin/settings', name: 'Admin Settings', icon: FaGear },
    { path: '/admin/logs', name: 'Admin Logs', icon: FaClipboard },
  ];

  return (
    <div className={`${isSidebarCollapsed ? 'w-16' : 'w-64'} bg-white border-r border-gray-200 min-h-screen transition-all duration-300 ease-in-out relative`}>
      <div className="flex items-center justify-center h-16 border-b border-gray-200">
        <span className={`text-xl font-bold text-gray-700 transition-opacity duration-300 ${isSidebarCollapsed ? 'opacity-0' : 'opacity-100'}`}>
          Admin Panel
        </span>
      </div>
      <button
        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        className="absolute -right-3 top-20 bg-white border border-gray-200 rounded-full p-1 shadow-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <FaChevronLeft className={`h-4 w-4 text-gray-600 transition-transform duration-300 ${isSidebarCollapsed ? 'rotate-180' : ''}`} />
      </button>
      <nav className="mt-6 px-2 space-y-4">
        {/* Dashboard */}
        <Link
          to="/dashboard"
          className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'px-4'} py-3
            ${currentPath === '/dashboard' 
              ? 'text-indigo-600 font-medium' 
              : 'text-gray-700 hover:text-gray-900'}`}
        >
          <FaHouse className={`${isSidebarCollapsed ? 'h-6 w-6' : 'h-5 w-5 text-gray-500'}`} />
          <span className={`ml-3 text-base transition-opacity duration-300 ${isSidebarCollapsed ? 'hidden' : 'block'}`}>
            Dashboard
          </span>
        </Link>

        {/* Subscription */}
        <Link
          to="/subscription"
          className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'px-4'} py-3
            ${currentPath === '/subscription' 
              ? 'text-indigo-600 font-medium' 
              : 'text-gray-700 hover:text-gray-900'}`}
        >
          <FaRocket className={`${isSidebarCollapsed ? 'h-6 w-6' : 'h-5 w-5 text-gray-500'}`} />
          <span className={`ml-3 text-base transition-opacity duration-300 ${isSidebarCollapsed ? 'hidden' : 'block'}`}>
            Subscription
          </span>
        </Link>

        {/* Admin Panel section with sub-items */}
        <div className="mt-4">
          {/* Admin Panel Header */}
          <Link
            to="/admin"
            className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'px-4'} py-3
              ${currentPath === '/admin' 
                ? 'text-indigo-600 font-medium' 
                : 'text-gray-700 hover:text-gray-900'}`}
          >
            <FaShieldHalved className={`${isSidebarCollapsed ? 'h-6 w-6' : 'h-5 w-5 text-gray-500'}`} />
            <span className={`ml-3 text-base font-medium transition-opacity duration-300 ${isSidebarCollapsed ? 'hidden' : 'block'} text-indigo-600`}>
              Admin Panel
            </span>
          </Link>

          {/* Admin Sub-items */}
          {!isSidebarCollapsed && (
            <div className="ml-6 mt-2 border-l border-gray-200 pl-3">
              {adminSubRoutes.map((route) => {
                const isActive = currentPath === route.path;
                const Icon = route.icon;
                
                return (
                  <Link
                    key={route.path}
                    to={route.path}
                    className={`w-full flex items-center px-3 py-2
                      ${isActive 
                        ? 'text-indigo-600 font-medium' 
                        : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    <Icon className="h-4 w-4 text-gray-500" />
                    <span className="ml-2 text-sm">
                      {route.name}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </nav>
    </div>
  );
};

export default AdminSidebar;
