import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaChevronLeft, FaHome, FaRocket, FaChartBar, FaBell, FaUser, FaCog, FaSignOutAlt } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';

const SubscriptionPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { unreadCount, markAllAsRead } = useNotifications();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const handleFreeSubscribe = () => {
    const successUrl = encodeURIComponent(`${window.location.origin}/subscription/success`);
    const cancelUrl = encodeURIComponent(`${window.location.origin}/subscription/failed`);
    const checkoutUrl = new URL('https://buy.stripe.com/test_5kAdRB4qrdfF4PmbIJ');
    
    // Add success and cancel URLs as searchParams
    checkoutUrl.searchParams.append('success_url', successUrl);
    checkoutUrl.searchParams.append('cancel_url', cancelUrl);
    
    // Add additional parameters to improve the checkout experience
    checkoutUrl.searchParams.append('allow_promotion_codes', 'true');
    checkoutUrl.searchParams.append('mode', 'subscription');
    
    // Redirect to the checkout page
    window.location.href = checkoutUrl.toString();
  };

  const handleSubscribe = () => {
    const successUrl = encodeURIComponent(`${window.location.origin}/subscription/success`);
    const cancelUrl = encodeURIComponent(`${window.location.origin}/subscription/failed`);
    const checkoutUrl = new URL('https://buy.stripe.com/test_6oEdRB7CD7VlbdKfYY');
    
    // Add success and cancel URLs as searchParams
    checkoutUrl.searchParams.append('success_url', successUrl);
    checkoutUrl.searchParams.append('cancel_url', cancelUrl);
    
    // Add additional parameters to improve the checkout experience
    checkoutUrl.searchParams.append('allow_promotion_codes', 'true');
    checkoutUrl.searchParams.append('mode', 'subscription');
    
    // Redirect to the checkout page
    window.location.href = checkoutUrl.toString();
  };

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
          <button
            onClick={() => navigate('/dashboard')}
            className={`w-full flex items-center ${isSidebarCollapsed ? 'px-2' : 'px-4'} py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors duration-200 ${isSidebarCollapsed ? 'justify-center' : ''}`}
          >
            <FaHome className="h-5 w-5" />
            <span className={`ml-3 transition-opacity duration-300 ${isSidebarCollapsed ? 'hidden' : 'block'}`}>
              Dashboard
            </span>
          </button>
          <button
            onClick={() => navigate('/subscription')}
            className={`w-full flex items-center ${isSidebarCollapsed ? 'px-2' : 'px-4'} py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${isSidebarCollapsed ? 'justify-center' : ''}`}
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
        <main className="py-6 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
                Choose Your Plan
              </h2>
              <p className="mt-4 text-xl text-gray-600">
                Select the perfect plan for your needs
              </p>
            </div>

            <div className="mt-12 space-y-4 sm:mt-16 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-8 lg:max-w-4xl lg:mx-auto">
              {/* Free Tier */}
              <div className="border border-gray-200 rounded-lg shadow-sm divide-y divide-gray-200">
                <div className="p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Free</h3>
                  <p className="mt-4 text-sm text-gray-500">Get started with basic monitoring</p>
                  <p className="mt-8">
                    <span className="text-4xl font-extrabold text-gray-900">$0</span>
                    <span className="text-base font-medium text-gray-500">/month</span>
                  </p>
                  <button
                    onClick={handleFreeSubscribe}
                    className="mt-8 block w-full bg-gray-800 border border-gray-800 rounded-md py-3 text-sm font-semibold text-white text-center hover:bg-gray-900 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                  >
                    Get Started
                  </button>
                </div>
                <div className="pt-6 pb-8 px-6">
                  <h4 className="text-sm font-medium text-gray-900 tracking-wide">What's included</h4>
                  <ul className="mt-6 space-y-4">
                    <li className="flex space-x-3">
                      <svg className="flex-shrink-0 h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm text-gray-500">Up to 5 websites</span>
                    </li>
                    <li className="flex space-x-3">
                      <svg className="flex-shrink-0 h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm text-gray-500">Basic monitoring</span>
                    </li>
                    <li className="flex space-x-3">
                      <svg className="flex-shrink-0 h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm text-gray-500">Email notifications</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Pro Tier */}
              <div className="border border-gray-200 rounded-lg shadow-sm divide-y divide-gray-200">
                <div className="p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Pro</h3>
                  <p className="mt-4 text-sm text-gray-500">Advanced features for growing businesses</p>
                  <p className="mt-8">
                    <span className="text-4xl font-extrabold text-gray-900">$29</span>
                    <span className="text-base font-medium text-gray-500">/month</span>
                  </p>
                  <button
                    onClick={handleSubscribe}
                    className="mt-8 block w-full bg-indigo-600 border border-transparent rounded-md py-3 text-sm font-semibold text-white text-center hover:bg-indigo-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  >
                    Subscribe Now
                  </button>
                </div>
                <div className="pt-6 pb-8 px-6">
                  <h4 className="text-sm font-medium text-gray-900 tracking-wide">What's included</h4>
                  <ul className="mt-6 space-y-4">
                    <li className="flex space-x-3">
                      <svg className="flex-shrink-0 h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm text-gray-500">Unlimited websites</span>
                    </li>
                    <li className="flex space-x-3">
                      <svg className="flex-shrink-0 h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm text-gray-500">Advanced monitoring</span>
                    </li>
                    <li className="flex space-x-3">
                      <svg className="flex-shrink-0 h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm text-gray-500">Priority support</span>
                    </li>
                    <li className="flex space-x-3">
                      <svg className="flex-shrink-0 h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm text-gray-500">Custom alerts</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default SubscriptionPage;