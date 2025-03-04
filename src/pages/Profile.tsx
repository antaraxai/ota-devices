import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useEffect } from 'react';
import { toast } from 'react-toastify';
import { FaUser, FaCog, FaBell, FaSignOutAlt, FaChartBar, FaHome, FaRocket, FaChevronLeft } from 'react-icons/fa';
import { useNotifications } from '../contexts/NotificationContext';

interface SubscriptionDetails {
  plan_name: string;
  status: string;
  current_period_end: string;
}

export default function Profile() {
  const { user, signOut } = useAuth();
  const { unreadCount, markAllAsRead } = useNotifications();
  const [subscriptionDetails, setSubscriptionDetails] = useState<SubscriptionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Ensure the page has the dashboard layout
  document.title = "Profile - Dashboard";

  // Helper function to format dates consistently
  const formatSubscriptionDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    
    try {
      // Check if timestamp is in seconds (Unix timestamp) or already a date string
      const date = typeof timestamp === 'number' || /^\d+$/.test(timestamp)
        ? new Date(Number(timestamp) * 1000) // Convert seconds to milliseconds
        : new Date(timestamp);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid date format:', timestamp);
        return 'N/A';
      }
      
      // Format date as Month DD, YYYY (e.g., January 1, 2023)
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'N/A';
    }
  };

  useEffect(() => {
    const fetchSubscriptionDetails = async () => {
      try {
        if (!user?.email) {
          console.log('No user email available');
          setLoading(false);
          return;
        }

        console.log('Fetching subscription details for:', user.email);

        // First try to get customer data using email
        const { data: customerData, error: customerError } = await supabase
          .from('customer')
          .select('*')
          .eq('email', user.email)
          .single();

        if (customerError && customerError.code !== 'PGRST116') { // PGRST116 is "not found"
          console.warn('Error fetching customer by email:', customerError);
        }

        console.log('Customer data:', customerData);

        // If we found a customer with this email
        if (customerData) {
          console.log('Found customer by email:', customerData.id);
          
          // Then fetch subscription using customer ID
          const { data: subscriptionData, error: subscriptionError } = await supabase
            .from('subscription')
            .select('*')
            .eq('customer', customerData.id)
            .single();

          if (subscriptionError && subscriptionError.code !== 'PGRST116') {
            console.warn('Error fetching subscription:', subscriptionError);
          }

          if (subscriptionData) {
            console.log('Found subscription:', subscriptionData.id);
            
            // If we have plan information
            if (subscriptionData.plan_id) {
              const { data: productData, error: productError } = await supabase
                .from('products')
                .select('*')
                .eq('id', subscriptionData.plan_id)
                .single();

              if (productError && productError.code !== 'PGRST116') {
                console.warn('Error fetching product:', productError);
              }

              // Normalize plan name for consistent display
              let planName = productData?.name || 'Pro Plan';
              planName = planName.toLowerCase().includes('pro') ? 'Pro Plan' : 
                         planName.toLowerCase().includes('free') ? 'Free Plan' : planName;
                
              setSubscriptionDetails({
                plan_name: planName,
                status: subscriptionData.status || 'active',
                current_period_end: formatSubscriptionDate(subscriptionData.current_period_end)
              });
              
              console.log('Subscription details set from product data');
              return;
            } else {
              // If plan_id is missing but we have other subscription data
              // Normalize plan name for consistent display
              let planName = subscriptionData.plan_name || 'Pro Plan';
              planName = planName.toLowerCase().includes('pro') ? 'Pro Plan' : 
                         planName.toLowerCase().includes('free') ? 'Free Plan' : planName;
                
              setSubscriptionDetails({
                plan_name: planName,
                status: subscriptionData.status || 'active',
                current_period_end: formatSubscriptionDate(subscriptionData.current_period_end)
              });
              
              console.log('Subscription details set from subscription data');
              return;
            }
          }
        } else {
          console.log('No customer found with email:', user.email);
          
          // Try alternative approach - check if user_id is stored in customer metadata
          const { data: altCustomers, error: altError } = await supabase
            .from('customer')
            .select('*');
            
          if (altError) {
            console.warn('Error fetching all customers:', altError);
          }
            
          if (altCustomers && altCustomers.length > 0) {
            console.log(`Checking ${altCustomers.length} customers for metadata match`);
            
            // Look for a customer that might have user_id in metadata
            const matchingCustomer = altCustomers.find(customer => 
              customer.metadata && 
              (customer.metadata.user_id === user.id || 
               customer.metadata.supabase_user_id === user.id));
               
            if (matchingCustomer) {
              console.log('Found customer via metadata match:', matchingCustomer.id);
              
              // Get subscription for this customer
              const { data: subscriptionData, error: subError } = await supabase
                .from('subscription')
                .select('*')
                .eq('customer', matchingCustomer.id)
                .single();
                
              if (subError && subError.code !== 'PGRST116') {
                console.warn('Error fetching subscription via metadata match:', subError);
              }
                
              if (subscriptionData) {
                console.log('Found subscription via metadata match:', subscriptionData.id);
                
                // Normalize plan name for consistent display
                let planName = subscriptionData.plan_name || 'Pro Plan';
                planName = planName.toLowerCase().includes('pro') ? 'Pro Plan' : 
                           planName.toLowerCase().includes('free') ? 'Free Plan' : planName;
                  
                setSubscriptionDetails({
                  plan_name: planName,
                  status: subscriptionData.status || 'active',
                  current_period_end: formatSubscriptionDate(subscriptionData.current_period_end)
                });
                
                console.log('Subscription details set from metadata match');
                return;
              }
            }
          }
        }
        
        // If we get here, we couldn't find subscription info
        console.log('No subscription found, checking user metadata');
        
        // Check if user metadata has plan information
        if (user.user_metadata && user.user_metadata.plan) {
          console.log('Found plan in user metadata:', user.user_metadata.plan);
          
          // Normalize plan name for consistent display
          let planName = user.user_metadata.plan;
          planName = planName.toLowerCase().includes('pro') ? 'Pro Plan' : 
                     planName.toLowerCase().includes('free') ? 'Free Plan' : planName;
          
          setSubscriptionDetails({
            plan_name: planName,
            status: 'active',
            current_period_end: 'N/A'
          });
          
          console.log('Subscription details set from user metadata');
        } else {
          // Default to Free Plan if no subscription found
          console.log('No subscription information found, defaulting to Free Plan');
          
          setSubscriptionDetails({
            plan_name: 'Free Plan',
            status: 'inactive',
            current_period_end: 'N/A'
          });
        }
      } catch (error) {
        console.error('Error fetching subscription details:', error);
        toast.error('Failed to fetch subscription details');
        
        // Set default subscription details on error
        setSubscriptionDetails({
          plan_name: 'Free Plan',
          status: 'inactive',
          current_period_end: 'N/A'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSubscriptionDetails();
  }, [user]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    );
  }

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
            onClick={() => window.location.href = '/dashboard'}
            className={`w-full flex items-center ${isSidebarCollapsed ? 'px-2' : 'px-4'} py-2 text-gray-700 hover:bg-gray-100 rounded-md ${isSidebarCollapsed ? 'justify-center' : ''}`}
          >
            <FaHome className="h-5 w-5" />
            <span className={`ml-3 transition-opacity duration-300 ${isSidebarCollapsed ? 'hidden' : 'block'}`}>
              Dashboard
            </span>
          </button>
          <button
            onClick={() => window.location.href = '/subscription'}
            className={`w-full flex items-center ${isSidebarCollapsed ? 'px-2' : 'px-4'} py-2 text-gray-700 hover:bg-gray-100 rounded-md ${isSidebarCollapsed ? 'justify-center' : ''}`}
          >
            <FaRocket className="h-5 w-5" />
            <span className={`ml-3 transition-opacity duration-300 ${isSidebarCollapsed ? 'hidden' : 'block'}`}>
              Subscription
            </span>
          </button>
          <button
            onClick={() => window.location.href = '/profile'}
            className={`w-full flex items-center ${isSidebarCollapsed ? 'px-2' : 'px-4'} py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${isSidebarCollapsed ? 'justify-center' : ''}`}
          >
            <FaUser className="h-5 w-5" />
            <span className={`ml-3 transition-opacity duration-300 ${isSidebarCollapsed ? 'hidden' : 'block'}`}>
              Profile
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
                </div>
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <div className="flex-1 p-8 bg-gray-100">
          <div className="max-w-3xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl font-semibold text-gray-900">Profile</h1>
              <p className="mt-1 text-sm text-gray-600">Manage your account settings and subscription details.</p>
            </div>
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Profile Information</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">Personal details and subscription.</p>
              </div>
              <div className="border-t border-gray-200">
                <dl>
                  <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500">Email address</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{user?.email}</dd>
                  </div>
                  <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500">Subscription plan</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                      {subscriptionDetails?.plan_name === 'Pro Plan' || subscriptionDetails?.plan_name === 'pro' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                          Pro Plan
                        </span>
                      ) : subscriptionDetails?.plan_name === 'Free Plan' || subscriptionDetails?.plan_name === 'free' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Free
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                          {subscriptionDetails?.plan_name}
                        </span>
                      )}
                    </dd>
                  </div>
                  <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500">Subscription status</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${subscriptionDetails?.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {subscriptionDetails?.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                      {subscriptionDetails?.status === 'active' && (
                        <p className="mt-1 text-xs text-gray-500">Your subscription is currently active and will automatically renew.</p>
                      )}
                    </dd>
                  </div>
                  <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500">Current period ends</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                      {subscriptionDetails?.current_period_end !== 'N/A' ? (
                        subscriptionDetails?.current_period_end
                      ) : (
                        <span className="text-gray-500">Not applicable</span>
                      )}
                    </dd>
                  </div>
                  <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500">Manage subscription</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                      <a
                        href="/subscription"
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        {subscriptionDetails?.plan_name === 'Free Plan' || subscriptionDetails?.plan_name === 'free' ? 'Upgrade Plan' : 'Manage Plan'}
                      </a>
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}