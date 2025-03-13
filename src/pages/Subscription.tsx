import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaBell, FaUser, FaSignOutAlt, FaCheck, FaCrown, FaUserCircle } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { STRIPE_URLS, DEFAULT_TEST_MODE } from '../config/environment';
import { hasActiveSubscription } from '../utils/subscriptionUtils';
import MainSidebar from '../components/MainSidebar';

const SubscriptionPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut, plan, refreshUserData, isAdmin } = useAuth();
  
  // Debug auth values
  console.log('Subscription page - user:', user, 'isAdmin:', isAdmin, 'plan:', plan);
  const { unreadCount, markAllAsRead } = useNotifications();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isProSubscriber, setIsProSubscriber] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  // Use the default test mode from environment config
  const isTestMode = DEFAULT_TEST_MODE;
  const currentPath = location.pathname;

  // Check if user has an active subscription
  useEffect(() => {
    const checkSubscription = async () => {
      setIsLoading(true);
      try {
        // First check the plan from AuthContext
        if (plan === 'pro') {
          setIsProSubscriber(true);
        } else {
          // Double-check with the utility function
          const hasSubscription = await hasActiveSubscription(user);
          setIsProSubscriber(hasSubscription);
        }
      } catch (error) {
        console.error('Error checking subscription status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkSubscription();
  }, [user, plan]);

  const handleSubscribe = () => {
    // Define success and cancel URLs with multiple possible parameters
    const successUrl = encodeURIComponent(`${window.location.origin}/subscription/success?session_id={CHECKOUT_SESSION_ID}&checkout_session_id={CHECKOUT_SESSION_ID}&payment_intent={PAYMENT_INTENT}`);
    const cancelUrl = encodeURIComponent(`${window.location.origin}/subscription/failed`);
    
    // Get the appropriate Stripe checkout URL based on mode
    const mode = isTestMode ? 'test' : 'production';
    console.log(isTestMode);
    let stripeCheckoutUrl = STRIPE_URLS[mode].pro;
    console.log(stripeCheckoutUrl);
    
    // Add query parameters if they don't already exist in the URL
    if (!stripeCheckoutUrl.includes('?')) {
      stripeCheckoutUrl += '?';
    } else if (!stripeCheckoutUrl.endsWith('&') && !stripeCheckoutUrl.endsWith('?')) {
      stripeCheckoutUrl += '&';
    }
    
    // Add success and cancel URLs as query parameters
    stripeCheckoutUrl += `success_url=${successUrl}&cancel_url=${cancelUrl}`;
    
    // Add customer email if available
    if (user?.email) {
      stripeCheckoutUrl += `&customer_email=${encodeURIComponent(user.email)}`;
    }
    
    // Redirect to the checkout page
    window.location.href = stripeCheckoutUrl;
  };

  const handleFreeSubscribe = () => {
    // Define success and cancel URLs with multiple possible parameters
    const successUrl = encodeURIComponent(`${window.location.origin}/subscription/success?session_id={CHECKOUT_SESSION_ID}&checkout_session_id={CHECKOUT_SESSION_ID}&payment_intent={PAYMENT_INTENT}`);
    const cancelUrl = encodeURIComponent(`${window.location.origin}/subscription/failed`);
    
    // Get the appropriate Stripe checkout URL based on mode
    const mode = isTestMode ? 'test' : 'production';
    let stripeCheckoutUrl = STRIPE_URLS[mode].free;
    
    // Add query parameters if they don't already exist in the URL
    if (!stripeCheckoutUrl.includes('?')) {
      stripeCheckoutUrl += '?';
    } else if (!stripeCheckoutUrl.endsWith('&') && !stripeCheckoutUrl.endsWith('?')) {
      stripeCheckoutUrl += '&';
    }
    
    // Add success and cancel URLs as query parameters
    stripeCheckoutUrl += `success_url=${successUrl}&cancel_url=${cancelUrl}`;
    
    // Add customer email if available
    if (user?.email) {
      stripeCheckoutUrl += `&customer_email=${encodeURIComponent(user.email)}`;
    }
    
    // Redirect to the checkout page
    window.location.href = stripeCheckoutUrl;
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleContactUs = () => {
    window.location.href = 'mailto:enterprise@antara.com';
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <MainSidebar
        isSidebarCollapsed={isSidebarCollapsed}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
        currentPath={currentPath}
        isAdmin={isAdmin}
      />

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
                        onClick={() => window.location.href = '/profile'}
                        className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <FaUser className="mr-3 h-4 w-4" />
                        Profile
                      </button>
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
            {isLoading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
              </div>
            ) : isProSubscriber ? (
              <div className="text-center mb-12">
                <div className="flex justify-center mb-6">
                  <div className="h-24 w-24 rounded-full bg-indigo-100 flex items-center justify-center">
                    <FaCrown className="h-12 w-12 text-indigo-600" />
                  </div>
                </div>
                <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
                  You're on the Pro Plan!
                </h2>
                <p className="mt-4 text-xl text-gray-600">
                  Thank you for your subscription. You have access to all Pro features.
                </p>

                <div className="mt-12 max-w-lg mx-auto bg-white shadow-lg rounded-lg overflow-hidden">
                  <div className="px-6 py-8">
                    <div className="flex items-center justify-between">
                      <h3 className="text-2xl font-bold text-indigo-600">Pro Plan</h3>
                      <span className="px-3 py-1 text-sm text-white bg-indigo-600 rounded-full">Active</span>
                    </div>
                    <p className="mt-2 text-gray-600">Your subscription is active and will renew automatically.</p>
                    
                    <div className="mt-8">
                      <h4 className="text-lg font-medium text-gray-900">Your Pro Benefits:</h4>
                      <ul className="mt-4 space-y-3">
                        <li className="flex items-start">
                          <FaCheck className="h-5 w-5 text-green-500 mr-3 mt-0.5" />
                          <span>Unlimited websites</span>
                        </li>
                        <li className="flex items-start">
                          <FaCheck className="h-5 w-5 text-green-500 mr-3 mt-0.5" />
                          <span>Advanced monitoring features</span>
                        </li>
                        <li className="flex items-start">
                          <FaCheck className="h-5 w-5 text-green-500 mr-3 mt-0.5" />
                          <span>Priority support</span>
                        </li>
                        <li className="flex items-start">
                          <FaCheck className="h-5 w-5 text-green-500 mr-3 mt-0.5" />
                          <span>Custom alerts</span>
                        </li>
                        <li className="flex items-start">
                          <FaCheck className="h-5 w-5 text-green-500 mr-3 mt-0.5" />
                          <span>Admin privileges</span>
                        </li>
                      </ul>
                    </div>

                    <div className="mt-8">
                      <button
                        onClick={() => navigate('/dashboard')}
                        className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors duration-200"
                      >
                        Go to Dashboard
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="text-center mb-12">
                  <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
                    Choose Your Plan
                  </h2>
                  <p className="mt-4 text-xl text-gray-600">
                    Select the perfect plan for your needs
                  </p>
                </div>

                <div className="mt-12 space-y-4 sm:mt-16 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-6 lg:max-w-6xl lg:mx-auto">
                  {/* Free Tier */}
                  <div className="border border-gray-200 rounded-lg shadow-md divide-y divide-gray-200 bg-gradient-to-b from-white to-gray-50">
                    <div className="p-6">
                      <h3 className="text-lg leading-6 font-medium text-gray-800">Free</h3>
                      <p className="mt-4 text-sm text-gray-500">Get started with basic monitoring</p>
                      <p className="mt-8">
                        <span className="text-4xl font-extrabold text-gray-800">$0</span>
                        <span className="text-base font-medium text-gray-500">/month</span>
                      </p>
                      <button
                        onClick={handleFreeSubscribe}
                        className="mt-8 block w-full bg-gray-700 border border-gray-700 rounded-md py-3 text-sm font-semibold text-white text-center hover:bg-gray-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
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
                   <div className="border border-blue-200 rounded-lg shadow-lg divide-y divide-gray-200 bg-gradient-to-b from-white to-blue-50 ring-2 ring-blue-200 ring-opacity-50 transform scale-105 z-10">
                    <div className="p-6">
                      <h3 className="text-lg leading-6 font-medium text-blue-800">Pro</h3>
                      <p className="mt-4 text-sm text-gray-500">Advanced features for growing businesses</p>
                      <div className="mt-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Recommended
                        </span>
                      </div>
                      <p className="mt-8">
                        <span className="text-4xl font-extrabold text-blue-800">$9</span>
                        <span className="text-base font-medium text-gray-500">/month</span>
                      </p>
                      <button
                        onClick={handleSubscribe}
                        className="mt-8 block w-full bg-blue-600 border border-transparent rounded-md py-3 text-sm font-semibold text-white text-center hover:bg-blue-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
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

                  {/* Enterprise Tier */}
                  <div className="border border-indigo-200 rounded-lg shadow-lg divide-y divide-gray-200 bg-gradient-to-b from-white to-indigo-50 ring-2 ring-indigo-200 ring-opacity-50">
                    <div className="p-6">
                      <h3 className="text-lg leading-6 font-medium text-indigo-900">Enterprise</h3>
                      <p className="mt-4 text-sm text-gray-500">Custom solutions for large organizations</p>
                      <p className="mt-8">
                        <span className="text-2xl font-extrabold text-indigo-900">Contact Us</span>
                      </p>
                      <button
                        onClick={handleContactUs}
                        className="mt-8 block w-full bg-indigo-800 border border-transparent rounded-md py-3 text-sm font-semibold text-white text-center hover:bg-indigo-900 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                      >
                        Get in Touch
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
                          <span className="text-sm text-gray-500">Dedicated account manager</span>
                        </li>
                        <li className="flex space-x-3">
                          <svg className="flex-shrink-0 h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm text-gray-500">24/7 premium support</span>
                        </li>
                        <li className="flex space-x-3">
                          <svg className="flex-shrink-0 h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm text-gray-500">Custom integrations</span>
                        </li>
                        <li className="flex space-x-3">
                          <svg className="flex-shrink-0 h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm text-gray-500">SLA guarantees</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default SubscriptionPage;