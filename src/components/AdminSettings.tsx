import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { FaFloppyDisk, FaArrowsRotate, FaGear, FaGlobe, FaEnvelope, FaLock, FaServer, FaTriangleExclamation, FaDatabase } from 'react-icons/fa6';

interface SystemSettings {
  id?: number;
  site_name: string;
  contact_email: string;
  support_email: string;
  allow_new_registrations: boolean;
  maintenance_mode: boolean;
  default_user_role: string;
  default_plan: string;
  max_devices_free: number;
  max_devices_pro: number;
  stripe_test_mode: boolean;
  notification_frequency: string;
  created_at?: string;
  updated_at?: string;
}

const defaultSettings: SystemSettings = {
  site_name: 'Antara',
  contact_email: 'contact@antara.com',
  support_email: 'support@antara.com',
  allow_new_registrations: true,
  maintenance_mode: false,
  default_user_role: 'user',
  default_plan: 'free',
  max_devices_free: 5,
  max_devices_pro: 50,
  stripe_test_mode: true,
  notification_frequency: 'daily'
};

const AdminSettings: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [activeTab, setActiveTab] = useState('general');
  const [usersTableExists, setUsersTableExists] = useState(true);
  const [tableExists, setTableExists] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
    checkUsersTableExists();
  }, []);

  const checkUsersTableExists = async () => {
    try {
      // Try to query the users table to see if it exists
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .limit(1);
      
      if (error) {
        // Check if the error is related to the table not existing
        if (error.code === '42P01') { // PostgreSQL error code for relation does not exist
          setUsersTableExists(false);
          return false;
        } else {
          console.error('Error checking users table:', error);
          return false;
        }
      } else {
        setUsersTableExists(true);
        return true;
      }
    } catch (err) {
      console.error('Error checking users table existence:', err);
      return false;
    }
  };

  const checkTableExists = async () => {
    try {
      // Try to query the table to see if it exists
      const { data, error } = await supabase
        .from('system_settings')
        .select('id')
        .limit(1);
      
      if (error) {
        // Check if the error is related to the table not existing
        if (error.code === '42P01') { // PostgreSQL error code for relation does not exist
          setTableExists(false);
          setError('The system_settings table does not exist in the database. Please run the migration script to create it.');
          return false;
        } else {
          setError(`Error checking system_settings table: ${error.message}`);
          return false;
        }
      } else {
        setTableExists(true);
        setError(null);
        return true;
      }
    } catch (err) {
      console.error('Error checking table existence:', err);
      setError('An unexpected error occurred while checking the system_settings table.');
      return false;
    }
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      
      // Check if settings table exists
      const tableExistsResult = await checkTableExists();
      
      if (!tableExistsResult) {
        // If table doesn't exist, we'll use defaults
        setSettings(defaultSettings);
        setLoading(false);
        return;
      }
      
      // Fetch settings
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .order('id', { ascending: false })
        .limit(1);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        setSettings(data[0]);
      } else {
        // No settings found, use defaults
        setSettings(defaultSettings);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      setMessage({
        type: 'error',
        text: 'Failed to load settings. Please try again later.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleToggleChange = (name: string) => {
    setSettings(prev => ({
      ...prev,
      [name]: !prev[name as keyof SystemSettings]
    }));
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numValue = parseInt(value, 10);
    
    if (!isNaN(numValue)) {
      setSettings(prev => ({
        ...prev,
        [name]: numValue
      }));
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      setMessage({ type: '', text: '' });
      
      // Check if table exists before attempting to save
      const tableExistsResult = await checkTableExists();
      
      if (!tableExistsResult) {
        setMessage({
          type: 'error',
          text: 'Cannot save settings: The system_settings table does not exist. Please run the migration script first.'
        });
        setSaving(false);
        return;
      }
      
      // Check if we need to update or insert
      let operation;
      if (settings.id) {
        // Update existing record
        operation = supabase
          .from('system_settings')
          .update({
            ...settings,
            updated_at: new Date().toISOString()
          })
          .eq('id', settings.id);
      } else {
        // Insert new record
        operation = supabase
          .from('system_settings')
          .insert({
            ...settings,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
      }
      
      const { error } = await operation;
      
      if (error) throw error;
      
      setMessage({
        type: 'success',
        text: 'Settings saved successfully!'
      });
      
      // Refresh settings to get the new ID if it was an insert
      fetchSettings();
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({
        type: 'error',
        text: 'Failed to save settings. Please try again.'
      });
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    if (window.confirm('Are you sure you want to reset all settings to default values?')) {
      setSettings(defaultSettings);
      setMessage({
        type: 'info',
        text: 'Settings reset to defaults. Click Save to apply changes.'
      });
    }
  };

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      </div>
    );
  }
  
  if (error || !tableExists) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <FaTriangleExclamation className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Database Setup Required</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>{error || 'The system_settings table does not exist in the database.'}</p>
                <p className="mt-2">To create the system_settings table, you need to run the migration script:</p>
                <div className="mt-2 bg-gray-800 text-white p-3 rounded-md overflow-x-auto">
                  <code>cd /path/to/project && npx supabase migration up</code>
                </div>
                <p className="mt-2">Or manually execute the SQL script located at:</p>
                <div className="mt-2 bg-gray-800 text-white p-3 rounded-md overflow-x-auto">
                  <code>supabase/migrations/20250304_create_system_settings_table.sql</code>
                </div>
                <p className="mt-2"><strong>Note:</strong> Make sure your user has 'admin' in the roles array in raw_user_meta_data.</p>
                <button 
                  onClick={fetchSettings}
                  className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <FaDatabase className="mr-2 h-4 w-4" />
                  Retry Connection
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
        <h3 className="text-lg leading-6 font-medium text-gray-900">System Settings</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          Configure global system settings and defaults
        </p>
      </div>
      
      {message.text && (
        <div className={`p-4 ${
          message.type === 'error' 
            ? 'bg-red-100 text-red-700' 
            : message.type === 'success'
              ? 'bg-green-100 text-green-700'
              : 'bg-blue-100 text-blue-700'
        }`}>
          {message.text}
        </div>
      )}
      
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px">
          <button
            onClick={() => setActiveTab('general')}
            className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
              activeTab === 'general'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FaGlobe className="inline-block mr-2" />
            General
          </button>
          <button
            onClick={() => setActiveTab('email')}
            className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
              activeTab === 'email'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FaEnvelope className="inline-block mr-2" />
            Email
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
              activeTab === 'security'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FaLock className="inline-block mr-2" />
            Security
          </button>
          <button
            onClick={() => setActiveTab('limits')}
            className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
              activeTab === 'limits'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FaServer className="inline-block mr-2" />
            Limits & Plans
          </button>
          <button
            onClick={() => setActiveTab('database')}
            className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
              activeTab === 'database'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FaDatabase className="inline-block mr-2" />
            Database
          </button>
        </nav>
      </div>
      
      <div className="p-6">
        {/* General Settings */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            <div>
              <label htmlFor="site_name" className="block text-sm font-medium text-gray-700">
                Site Name
              </label>
              <input
                type="text"
                name="site_name"
                id="site_name"
                value={settings.site_name}
                onChange={handleInputChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="maintenance_mode"
                name="maintenance_mode"
                checked={settings.maintenance_mode}
                onChange={() => handleToggleChange('maintenance_mode')}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="maintenance_mode" className="ml-2 block text-sm text-gray-900">
                Maintenance Mode
              </label>
              <span className="ml-2 text-xs text-gray-500">
                (When enabled, only admins can access the site)
              </span>
            </div>
            
            <div>
              <label htmlFor="notification_frequency" className="block text-sm font-medium text-gray-700">
                Default Notification Frequency
              </label>
              <select
                id="notification_frequency"
                name="notification_frequency"
                value={settings.notification_frequency}
                onChange={handleInputChange}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              >
                <option value="realtime">Real-time</option>
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
          </div>
        )}
        
        {/* Email Settings */}
        {activeTab === 'email' && (
          <div className="space-y-6">
            <div>
              <label htmlFor="contact_email" className="block text-sm font-medium text-gray-700">
                Contact Email
              </label>
              <input
                type="email"
                name="contact_email"
                id="contact_email"
                value={settings.contact_email}
                onChange={handleInputChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                This email will be displayed as the contact email on the site
              </p>
            </div>
            
            <div>
              <label htmlFor="support_email" className="block text-sm font-medium text-gray-700">
                Support Email
              </label>
              <input
                type="email"
                name="support_email"
                id="support_email"
                value={settings.support_email}
                onChange={handleInputChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                Support requests will be sent to this email
              </p>
            </div>
          </div>
        )}
        
        {/* Security Settings */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="allow_new_registrations"
                name="allow_new_registrations"
                checked={settings.allow_new_registrations}
                onChange={() => handleToggleChange('allow_new_registrations')}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="allow_new_registrations" className="ml-2 block text-sm text-gray-900">
                Allow New User Registrations
              </label>
            </div>
            
            <div>
              <label htmlFor="default_user_role" className="block text-sm font-medium text-gray-700">
                Default User Role
              </label>
              <select
                id="default_user_role"
                name="default_user_role"
                value={settings.default_user_role}
                onChange={handleInputChange}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Role assigned to new users upon registration
              </p>
            </div>
          </div>
        )}
        
        {/* Limits & Plans Settings */}
        {activeTab === 'limits' && (
          <div className="space-y-6">
            <div>
              <label htmlFor="default_plan" className="block text-sm font-medium text-gray-700">
                Default Plan for New Users
              </label>
              <select
                id="default_plan"
                name="default_plan"
                value={settings.default_plan}
                onChange={handleInputChange}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              >
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="max_devices_free" className="block text-sm font-medium text-gray-700">
                Maximum Devices (Free Plan)
              </label>
              <input
                type="number"
                name="max_devices_free"
                id="max_devices_free"
                min="1"
                max="100"
                value={settings.max_devices_free}
                onChange={handleNumberChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
            
            <div>
              <label htmlFor="max_devices_pro" className="block text-sm font-medium text-gray-700">
                Maximum Devices (Pro Plan)
              </label>
              <input
                type="number"
                name="max_devices_pro"
                id="max_devices_pro"
                min="1"
                max="1000"
                value={settings.max_devices_pro}
                onChange={handleNumberChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="stripe_test_mode"
                name="stripe_test_mode"
                checked={settings.stripe_test_mode}
                onChange={() => handleToggleChange('stripe_test_mode')}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="stripe_test_mode" className="ml-2 block text-sm text-gray-900">
                Stripe Test Mode
              </label>
              <span className="ml-2 text-xs text-gray-500">
                (Use Stripe test environment instead of production)
              </span>
            </div>
          </div>
        )}
        
        <div className="mt-8 flex justify-end space-x-3">
          <button
            type="button"
            onClick={resetToDefaults}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <FaArrowsRotate className="mr-2 -ml-1 h-4 w-4" />
            Reset to Defaults
          </button>
          <button
            type="button"
            onClick={saveSettings}
            disabled={saving}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <FaFloppyDisk className="mr-2 -ml-1 h-4 w-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        {/* Database Settings */}
        {activeTab === 'database' && (
          <div className="space-y-6">
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Database Tables</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  Manage database tables and run migrations
                </p>
              </div>
              <ul className="divide-y divide-gray-200">
                <li>
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${tableExists ? 'bg-green-100' : 'bg-red-100'}`}>
                          <FaDatabase className={`h-6 w-6 ${tableExists ? 'text-green-600' : 'text-red-600'}`} />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">System Settings Table</div>
                          <div className="text-sm text-gray-500">
                            {tableExists ? 'Table exists and is ready to use' : 'Table does not exist'}
                          </div>
                        </div>
                      </div>
                      <div>
                        {!tableExists && (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                            Migration Required
                          </span>
                        )}
                      </div>
                    </div>
                    {!tableExists && (
                      <div className="mt-4 bg-gray-50 p-4 rounded-md">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <FaTriangleExclamation className="h-5 w-5 text-yellow-400" />
                          </div>
                          <div className="ml-3">
                            <h3 className="text-sm font-medium text-yellow-800">Migration Required</h3>
                            <div className="mt-2 text-sm text-yellow-700">
                              <p>The system_settings table does not exist in your database. Run the following command to create it:</p>
                              <div className="mt-2 bg-gray-800 text-white p-3 rounded-md overflow-x-auto">
                                <code>cd /path/to/project && npx supabase migration up</code>
                              </div>
                              <p className="mt-2">This will run the migration script at:</p>
                              <div className="mt-1 bg-gray-800 text-white p-3 rounded-md overflow-x-auto">
                                <code>supabase/migrations/20250304_create_system_settings_table.sql</code>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </li>
                <li>
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${usersTableExists ? 'bg-green-100' : 'bg-red-100'}`}>
                          <FaDatabase className={`h-6 w-6 ${usersTableExists ? 'text-green-600' : 'text-red-600'}`} />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">Users Table</div>
                          <div className="text-sm text-gray-500">
                            {usersTableExists ? 'Table exists and is ready to use' : 'Table does not exist'}
                          </div>
                        </div>
                      </div>
                      <div>
                        {!usersTableExists && (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                            Migration Required
                          </span>
                        )}
                      </div>
                    </div>
                    {!usersTableExists && (
                      <div className="mt-4 bg-gray-50 p-4 rounded-md">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <FaTriangleExclamation className="h-5 w-5 text-yellow-400" />
                          </div>
                          <div className="ml-3">
                            <h3 className="text-sm font-medium text-yellow-800">Migration Required</h3>
                            <div className="mt-2 text-sm text-yellow-700">
                              <p>The users table does not exist in your database. Run the following command to create it:</p>
                              <div className="mt-2 bg-gray-800 text-white p-3 rounded-md overflow-x-auto">
                                <code>cd /path/to/project && npx supabase migration up</code>
                              </div>
                              <p className="mt-2">This will run the migration script at:</p>
                              <div className="mt-1 bg-gray-800 text-white p-3 rounded-md overflow-x-auto">
                                <code>supabase/migrations/20250305_create_users_table.sql</code>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSettings;
