import React from 'react';
import { Link } from 'react-router-dom';
import { FaChevronLeft, FaHouse, FaRocket, FaShieldHalved } from 'react-icons/fa6';

interface MainSidebarProps {
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  currentPath: string;
  isAdmin: boolean;
}

const MainSidebar: React.FC<MainSidebarProps> = ({ 
  isSidebarCollapsed, 
  setIsSidebarCollapsed,
  currentPath,
  isAdmin
}) => {
  // Debug isAdmin value
  console.log('MainSidebar isAdmin:', isAdmin, 'currentPath:', currentPath);

  // Define main routes
  const mainRoutes = [
    { path: '/dashboard', name: 'Dashboard', icon: FaHouse },
    { path: '/subscription', name: 'Subscription', icon: FaRocket },
  ];

  // Add admin panel route if user is admin
  const allRoutes = isAdmin ? 
    [...mainRoutes, { path: '/admin', name: 'Admin Panel', icon: FaShieldHalved }] : 
    mainRoutes;

  return (
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
      <nav className="mt-6 px-2 space-y-4">
        {allRoutes.map((route) => {
          const isActive = currentPath === route.path;
          const Icon = route.icon;
          const isAdminPanel = route.path === '/admin';
          
          return (
            <Link
              key={route.path}
              to={route.path}
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'px-4'} py-3
                ${isActive 
                  ? 'text-indigo-600 font-medium' 
                  : 'text-gray-700 hover:text-gray-900'}`}
            >
              <Icon className={`${isSidebarCollapsed ? 'h-6 w-6' : 'h-5 w-5 text-gray-500'}`} />
              <span className={`ml-3 text-base transition-opacity duration-300 ${isSidebarCollapsed ? 'hidden' : 'block'} ${isAdminPanel && isActive ? 'text-indigo-600' : ''}`}>
                {route.name}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default MainSidebar;
