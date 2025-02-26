import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { FaGlobe, FaClock, FaCheckCircle, FaTimesCircle, FaSpinner, FaExpand, FaTimes, FaLink, FaBell, FaEdit, FaTrash } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';

interface Website {
  id: string;
  user_id: string; // Changed from number to string to match auth user id
  name: string;
  url: string;
  created_at: string;
  status: string;
  notify_on_status_change: boolean;
  check_frequency: string;
}

interface AddWebsiteFormData {
  name: string;
  url: string;
  notify_on_status_change: boolean;
  check_frequency: string;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'online':
      return <FaCheckCircle className="h-4 w-4 text-green-500" />;
    case 'offline':
      return <FaTimesCircle className="h-4 w-4 text-red-500" />;
    case 'pending':
      return <FaSpinner className="h-4 w-4 text-yellow-500 animate-spin" />;
    default:
      return <FaTimesCircle className="h-4 w-4 text-gray-400" />;
  }
};

class WebsiteErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-600">Failed to load website preview</p>
          <p className="text-sm text-red-500">The website cannot be embedded due to security restrictions</p>
        </div>
      );
    }
    return this.props.children;
  }
}


const DeploymentPreview: React.FC = () => {
  const { user } = useAuth();
  const [websites, setWebsites] = useState<Website[]>([]);
  const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState<AddWebsiteFormData>({
    name: '',
    url: '',
    notify_on_status_change: true,
    check_frequency: 'daily'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedWebsiteForAction, setSelectedWebsiteForAction] = useState<Website | null>(null);

  const fetchWebsites = async () => {
    try {
      if (!user) return;

      const { data, error } = await supabase
        .from('websites')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching websites:', error);
        toast.error('Failed to fetch websites');
        return;
      }

      setWebsites(data || []);
    } catch (error) {
      console.error('Error fetching websites:', error);
      toast.error('Failed to fetch websites');
    }
  };

  const checkWebsiteStatus = async (url: string): Promise<string> => {
    const cacheKey = `status_${url}`;
    const cachedStatus = sessionStorage.getItem(cacheKey);
    const cacheExpiry = sessionStorage.getItem(`${cacheKey}_expiry`);

    // Return cached status if still valid (5 minutes cache)
    if (cachedStatus && cacheExpiry && Number(cacheExpiry) > Date.now()) {
      return cachedStatus;
    }

    let retries = 1; // Reduced from 2 to 1
    const baseDelay = 10000; // Increased from 5000 to 10000
    const maxDelay = 60000; // Increased from 30000 to 60000

    while (retries >= 0) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // Increased timeout

        const faviconUrl = new URL('/favicon.ico', url).href;
        const response = await fetch(faviconUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; WebsiteStatusChecker/1.0)',
            'Accept': 'image/favicon,*/*'
          },
          mode: 'no-cors',
          cache: 'no-store'
        });

        clearTimeout(timeoutId);

        // Cache the successful status
        const status = 'online';
        sessionStorage.setItem(cacheKey, status);
        sessionStorage.setItem(`${cacheKey}_expiry`, String(Date.now() + 5 * 60 * 1000)); // 5 minutes cache

        return status;
      } catch (error) {
        retries--;
        if (retries >= 0) {
          const jitter = Math.random() * 2000; // Increased jitter
          const delay = Math.min(baseDelay * Math.pow(2, 1 - retries) + jitter, maxDelay);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.warn(`Failed to check status for ${url}:`, error);
          // If we've exhausted retries, mark as offline
          return 'offline';
        }
      }
    }
    return 'offline';
  };

  // Helper function to delay execution
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <FaCheckCircle className="h-4 w-4 text-green-500" />;
      case 'offline':
        return <FaTimesCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <FaSpinner className="h-4 w-4 text-yellow-500 animate-spin" />;
      default:
        return <FaTimesCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const MAX_CONCURRENT_REQUESTS = 1;
  const REQUEST_TIMEOUT = 15000;
  const CIRCUIT_BREAKER_THRESHOLD = 5;
  const CIRCUIT_BREAKER_RESET_TIME = 60000;

  class RequestQueue {
    private queue: Array<() => Promise<void>> = [];
    private running = 0;
    private failureCount = 0;
    private lastFailureTime = 0;
    private isCircuitOpen = false;

    async add(task: () => Promise<void>) {
      this.queue.push(task);
      this.processNext();
    }

    private async processNext() {
      if (this.running >= MAX_CONCURRENT_REQUESTS || this.queue.length === 0) {
        return;
      }

      if (this.isCircuitOpen) {
        if (Date.now() - this.lastFailureTime > CIRCUIT_BREAKER_RESET_TIME) {
          this.resetCircuitBreaker();
        } else {
          return;
        }
      }

      this.running++;
      const task = this.queue.shift();
      if (task) {
        try {
          await task();
          this.failureCount = 0;
        } catch (error) {
          this.handleFailure();
        } finally {
          this.running--;
          this.processNext();
        }
      }
    }

    private handleFailure() {
      this.failureCount++;
      this.lastFailureTime = Date.now();
      if (this.failureCount >= CIRCUIT_BREAKER_THRESHOLD) {
        this.isCircuitOpen = true;
      }
    }

    private resetCircuitBreaker() {
      this.isCircuitOpen = false;
      this.failureCount = 0;
    }
  }

  const requestQueue = new RequestQueue();

  // Modify checkWebsitesStatus to prevent infinite recursion
  const checkWebsitesStatus = async () => {
    const websitesCopy = [...websites];
    
    for (const website of websitesCopy) {
      await requestQueue.add(async () => {
        try {
          const newStatus = await checkWebsiteStatus(website.url);
          
          if (newStatus !== website.status) {
            if (website.notify_on_status_change) {
              await handleStatusChangeNotification(website, newStatus);
            }
            await updateWebsiteStatus(website, newStatus);
          }
        } catch (error) {
          console.error(`Error processing website ${website.name}:`, error);
        }
      });
    }
  };

  // Modify useEffect to prevent dependency cycle
  useEffect(() => {
    if (user) {
      fetchWebsites();
      checkWebsitesStatus();
    }
  }, [user]);

  // Separate useEffect for periodic checks
  useEffect(() => {
    if (user && websites.length > 0) {
      checkWebsitesStatus();
    }
  }, [user, websites.length]);

  // Wrap website previews with error boundary
  const renderWebsitePreview = (website: Website) => {
    return (
      <WebsiteErrorBoundary key={website.id}>
        <iframe
          src={website.url}
          className="w-full h-full border-0"
          title={`Preview of ${website.name}`}
          sandbox="allow-same-origin allow-scripts"
        />
      </WebsiteErrorBoundary>
    );
  };

  const handleStatusChangeNotification = async (website: Website, newStatus: string) => {
    // Function temporarily disabled
    // console.log('Status change notification disabled:', {
    //   website: website.name,
    //   oldStatus: website.status,
    //   newStatus
    // });
    return;
  
    try {
      const response = await fetch('http://localhost:3000', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: user?.email,
          subject: `Status Change: ${website.name}`,
          html: `Website ${website.name} (${website.url}) status changed from ${website.status} to ${newStatus}`
        })
      });
  
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send email notification');
      }
  
      toast.success('Email notification sent successfully');
    } catch (error) {
      console.error('Error sending email notification:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send email notification');
    }
  };

  const updateWebsiteStatus = async (website: Website, newStatus: string) => {
    if (!website?.id) {
      console.error('Invalid website ID');
      return;
    }

    let retries = 1;
    let updated = false;
    
    while (retries >= 0 && !updated) {
      try {
        const { error: updateError } = await supabase
          .from('websites')
          .update({ 
            status: newStatus,
            last_checked: new Date().toISOString()
          })
          .eq('id', website.id)
          .select(); // Add select() to validate the update
          
        if (!updateError) {
          updated = true;
        } else {
          console.error('Failed to update website status:', updateError);
          retries--;
          if (retries >= 0) await delay(10000);
        }
      } catch (error) {
        console.error('Error updating website status:', error);
        retries--;
        if (retries >= 0) await delay(10000);
      }
    }
  };

  useEffect(() => {
    if (user) {
      fetchWebsites();
      
      // Initial check
      checkWebsitesStatus();
      
      // Set up interval for periodic checks
      const intervalId = setInterval(checkWebsitesStatus, Math.max(30, Math.min(...websites.map(w => w.check_frequency))) * 1000);
      
      return () => {
        clearInterval(intervalId);
      };
    }
  }, [user, websites]);
  
  const handleAddWebsite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (!user) {
        throw new Error('User must be logged in to add a website');
      }

      const { data, error } = await supabase
        .from('websites')
        .insert([{
          name: formData.name,
          url: formData.url,
          status: 'pending',
          created_at: new Date().toISOString(),
          user_id: user.id,
          notify_on_status_change: formData.notify_on_status_change
        }])
        .select()
        .single();

      if (error) throw error;

      setShowAddModal(false);
      setFormData({
        name: '',
        url: '',
        notify_on_status_change: true
      });
      await fetchWebsites();
    } catch (error) {
      console.error('Error adding website:', error);
      toast.error('Failed to add website. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFrequencyChange = async (website: Website, frequency: string) => {
    try {
      const { error } = await supabase
        .from('websites')
        .update({ check_frequency: frequency })
        .eq('id', website.id);
      
      if (error) throw error;
      
      setWebsites(websites.map(w => 
        w.id === website.id 
          ? { ...w, check_frequency: frequency }
          : w
      ));
      toast.success(`Check frequency updated to ${frequency} for ${website.name}`);
    } catch (error) {
      console.error('Error updating check frequency:', error);
      toast.error('Failed to update check frequency');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleEditWebsite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('websites')
        .update({
          name: formData.name,
          url: formData.url,
          status: 'pending'
        })
        .eq('id', selectedWebsiteForAction?.id);

      if (error) throw error;

      setShowEditModal(false);
      setFormData({ name: '', url: '' });
      setSelectedWebsiteForAction(null);
      await fetchWebsites(); // Refresh the list
    } catch (error) {
      console.error('Error updating website:', error);
      alert('Failed to update website. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteWebsite = async () => {
    try {
      const { error } = await supabase
        .from('websites')
        .delete()
        .eq('id', selectedWebsiteForAction?.id);

      if (error) throw error;

      setShowDeleteModal(false);
      setSelectedWebsiteForAction(null);
      await fetchWebsites(); // Refresh the list
    } catch (error) {
      console.error('Error deleting website:', error);
      alert('Failed to delete website. Please try again.');
    }
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Website Deployments</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Add Website
        </button>
      </div>

      {/* Website List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {websites.length === 0 ? (
          <div className="p-8 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No websites found</h3>
            <p className="text-gray-500">Add your first website to start monitoring</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {websites.map(website => (
              <div key={website.id} className="p-6 hover:bg-gray-50 transition-colors duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      {getStatusIcon(website.status)}
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">{website.name}</h3>
                      <p className="text-sm text-gray-500">{website.url}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        setSelectedWebsiteForAction(website);
                        setShowEditModal(true);
                      }}
                      className="p-2 text-gray-400 hover:text-gray-500"
                    >
                      <FaEdit className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedWebsiteForAction(website);
                        setShowDeleteModal(true);
                      }}
                      className="p-2 text-gray-400 hover:text-red-500"
                    >
                      <FaTrash className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Website Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Add Website</h3>
            <form onSubmit={handleAddWebsite}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    name="name"
                    id="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="url" className="block text-sm font-medium text-gray-700">URL</label>
                  <input
                    type="url"
                    name="url"
                    id="url"
                    value={formData.url}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    required
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="notify_on_status_change"
                    id="notify_on_status_change"
                    checked={formData.notify_on_status_change}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="notify_on_status_change" className="ml-2 block text-sm text-gray-700">
                    Notify me when status changes
                  </label>
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {isSubmitting ? 'Adding...' : 'Add Website'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Website Modal */}
      {showEditModal && selectedWebsiteForAction && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Website</h3>
            <form onSubmit={handleEditWebsite}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    name="name"
                    id="edit-name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="edit-url" className="block text-sm font-medium text-gray-700">URL</label>
                  <input
                    type="url"
                    name="url"
                    id="edit-url"
                    value={formData.url}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    required
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedWebsiteForAction(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedWebsiteForAction && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Delete Website</h3>
            <p className="text-gray-500 mb-4">Are you sure you want to delete {selectedWebsiteForAction.name}? This action cannot be undone.</p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedWebsiteForAction(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteWebsite}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeploymentPreview;