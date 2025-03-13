import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  FaUserPen, 
  FaUserSlash, 
  FaUserCheck, 
  FaUserGear, 
  FaMagnifyingGlass, 
  FaFilter, 
  FaSort, 
  FaCheck, 
  FaTrashCan, 
  FaUserPlus,
  FaArrowsRotate
} from 'react-icons/fa6';
import { createClient } from '@supabase/supabase-js';

interface User {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  admin_id?: string; // ID of the admin who created this user
  user_metadata: {
    plan?: string;
    roles?: string[];
    subscription_status?: string;
    full_name?: string;
  };
}

// Create a separate client with service role for admin operations
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const serviceRoleClient = SUPABASE_URL && SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  // Explicitly set the service role to bypass RLS
  global: {
    headers: {
      'x-supabase-role': 'service_role'
    }
  }
}) : null;

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlan, setFilterPlan] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    email: '',
    full_name: '',
    plan: 'free',
    roles: ['user'],
    subscription_status: 'active'
  });
  const [editForm, setEditForm] = useState({
    plan: '',
    roles: [] as string[],
    subscription_status: '',
    full_name: ''
  });
  const [createForm, setCreateForm] = useState({
    email: '',
    password: '',
    full_name: '',
    plan: 'free',
    roles: ['user'] as string[],
    subscription_status: 'inactive'
  });
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error' | 'warning', message: string } | null>(null);
  const [filterByAdmin, setFilterByAdmin] = useState(false);
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
    
    // Get current admin ID on component mount and ensure admin exists in custom_users
    const setupCurrentAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentAdminId(user.id);
        
        // Ensure the current admin exists in the custom_users table
        await ensureAdminInCustomUsers(user.id, user.email || '', user.user_metadata);
      }
    };
    
    setupCurrentAdmin();
  }, []);
  
  // Function to ensure the current admin exists in the custom_users table
  const ensureAdminInCustomUsers = async (adminId: string, email: string, metadata: any) => {
    if (!serviceRoleClient) return;
    
    try {
      // Check if admin already exists in custom_users
      const { data: existingAdmin, error: checkError } = await serviceRoleClient
        .from('custom_users')
        .select('id')
        .eq('id', adminId)
        .maybeSingle();
      
      // If admin doesn't exist in custom_users, add them
      if (!existingAdmin && !checkError) {
        console.log('Adding current admin to custom_users table');
        
        const { data: insertedAdmin, error: insertError } = await serviceRoleClient
          .from('custom_users')
          .insert([
            {
              id: adminId,
              email: email,
              user_metadata: metadata || {},
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              admin_id: null // Admin has no admin
            }
          ])
          .select()
          .single();
          
        if (insertError) {
          console.error('Error adding admin to custom_users:', insertError);
        } else {
          console.log('Successfully added admin to custom_users:', insertedAdmin);
        }
      }
    } catch (error) {
      console.error('Error ensuring admin exists in custom_users:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Get the current user to check if they're an admin
      const { data: { user } } = await supabase.auth.getUser();
      const isAdmin = user?.user_metadata?.roles?.includes('admin') || user?.user_metadata?.plan === 'pro';
      
      if (!isAdmin) {
        throw new Error('You do not have admin privileges to view users');
      }
      
      if (!serviceRoleClient) {
        throw new Error('Service role client not available. Check your environment variables.');
      }
      
      // Try to fetch users from the custom_users table first
      try {
        const { data: customUsers, error: customError } = await serviceRoleClient
          .from('custom_users')
          .select('*')
          .order('created_at', { ascending: false });
        
        // If custom_users table exists and has data, use it
        if (!customError && customUsers && customUsers.length > 0) {
          console.log('Successfully fetched users from custom_users table:', customUsers.length);
          setUsers(customUsers || []);
          return; // Exit early if we successfully got users
        } else if (customError && customError.code === '42P01') {
          console.log('custom_users table does not exist yet, trying standard users table');
        } else if (customError) {
          console.error('Error accessing custom_users table:', customError);
          console.error('Error details:', JSON.stringify(customError, null, 2));
        }
        
        // Try the regular users table next
        const { data: publicUsers, error: publicError } = await serviceRoleClient
          .from('users')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (!publicError && publicUsers && publicUsers.length > 0) {
          console.log('Successfully fetched users from public table:', publicUsers.length);
          // If we have data in the public users table, use that
          const transformedUsers = publicUsers.map(user => ({
            id: user.id,
            email: user.email || '',
            created_at: user.created_at,
            last_sign_in_at: user.last_sign_in_at,
            user_metadata: user.user_metadata || {}
          }));
          
          setUsers(transformedUsers || []);
          return; // Exit early if we successfully got users
        } else if (publicError) {
          console.error('Error accessing users table:', publicError);
          console.error('Error details:', JSON.stringify(publicError, null, 2));
        }
        
        // Try with schema specification
        const { data: schemaUsers, error: schemaError } = await serviceRoleClient
          .from('public.users')
          .select('*')
          .order('created_at', { ascending: false });
          
        if (!schemaError && schemaUsers && schemaUsers.length > 0) {
          console.log('Successfully fetched users using schema specification:', schemaUsers.length);
          const transformedUsers = schemaUsers.map(user => ({
            id: user.id,
            email: user.email || '',
            created_at: user.created_at,
            last_sign_in_at: user.last_sign_in_at,
            user_metadata: user.user_metadata || {}
          }));
          
          setUsers(transformedUsers || []);
          return;
        } else if (schemaError) {
          console.error('Error with schema approach:', schemaError);
        }
      } catch (tableError) {
        console.error('Exception accessing users tables:', tableError);
      }
      
      // Fallback to auth API if all table approaches fail
      console.log('Falling back to auth API for user data');
      const { data: authUsers, error: authError } = await serviceRoleClient.auth.admin.listUsers();
      
      if (authError) {
        console.error('Error with auth API:', authError);
        throw authError;
      }
      
      // Transform the auth users to match our User interface
      const transformedUsers = authUsers.users.map(user => ({
        id: user.id,
        email: user.email || '',
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
        user_metadata: user.user_metadata || {}
      }));
      
      setUsers(transformedUsers || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      setActionMessage({ 
        type: 'error', 
        message: 'Failed to fetch users. Make sure you have admin privileges.' 
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Function to handle user deletion
  const deleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }
    
    if (!serviceRoleClient) {
      setActionMessage({ type: 'error', message: 'Service role client not available. Check your environment variables.' });
      return;
    }
    
    try {
      // Delete user using the auth admin API with service role client
      const { error } = await serviceRoleClient.auth.admin.deleteUser(userId);
      
      if (error) throw error;
      
      // Update local state
      setUsers(prev => prev.filter(user => user.id !== userId));
      setActionMessage({ type: 'success', message: 'User deleted successfully' });
    } catch (error) {
      console.error('Error deleting user:', error);
      setActionMessage({ type: 'error', message: 'Failed to delete user' });
    }
  };
  
  // Function to toggle user active status
  const toggleUserStatus = async (user: User) => {
    const newStatus = user.user_metadata?.subscription_status === 'active' ? 'inactive' : 'active';
    
    if (!serviceRoleClient) {
      setActionMessage({ type: 'error', message: 'Service role client not available. Check your environment variables.' });
      return;
    }
    
    try {
      // Update user metadata using the auth admin API with service role client
      const { error } = await serviceRoleClient.auth.admin.updateUserById(
        user.id,
        { 
          user_metadata: {
            ...user.user_metadata,
            subscription_status: newStatus
          }
        }
      );
      
      if (error) throw error;
      
      // Update local state
      setUsers(prev => 
        prev.map(u => 
          u.id === user.id 
            ? { 
                ...u, 
                user_metadata: {
                  ...u.user_metadata,
                  subscription_status: newStatus
                }
              } 
            : u
        )
      );
      
      setActionMessage({ 
        type: 'success', 
        message: `User ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully` 
      });
    } catch (error) {
      console.error('Error updating user status:', error);
      setActionMessage({ type: 'error', message: 'Failed to update user status' });
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilterPlan(e.target.value);
  };

  const handleSortChange = (field: string) => {
    if (sortBy === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('asc');
    }
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setEditForm({
      plan: user.user_metadata?.plan || '',
      roles: user.user_metadata?.roles || [],
      subscription_status: user.user_metadata?.subscription_status || '',
      full_name: user.user_metadata?.full_name || ''
    });
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedUser(null);
  };

  const openCreateModal = () => {
    setIsCreateModalOpen(true);
    setCreateForm({
      email: '',
      password: '',
      full_name: '',
      plan: 'free',
      roles: ['user'],
      subscription_status: 'inactive'
    });
  };

  const closeCreateModal = () => {
    setIsCreateModalOpen(false);
    // Reset the form
    setNewUserForm({
      email: '',
      full_name: '',
      plan: 'free',
      roles: ['user'],
      subscription_status: 'active'
    });
  };

  const handleCreateFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCreateForm(prev => ({ ...prev, [name]: value }));
  };

  const handleCreateRoleChange = (role: string) => {
    setCreateForm(prev => {
      const roles = [...prev.roles];
      if (roles.includes(role)) {
        return { ...prev, roles: roles.filter(r => r !== role) };
      } else {
        return { ...prev, roles: [...roles, role] };
      }
    });
  };

  const createUser = async () => {
    if (!serviceRoleClient) {
      setActionMessage({ type: 'error', message: 'Service role client not available. Check your environment variables.' });
      return;
    }

    // Validate form
    if (!newUserForm.email) {
      setActionMessage({ type: 'error', message: 'Email is required' });
      return;
    }

    try {
      setLoading(true);
      
      // Check if the user already exists in custom_users table
      let tableExists = true;
      let { data: existingUsers, error: checkError } = await serviceRoleClient
        .from('custom_users')
        .select('email')
        .eq('email', newUserForm.email)
        .maybeSingle();
      
      // If the custom_users table doesn't exist yet, check the original users table
      if (checkError && checkError.code === '42P01') { // Table doesn't exist error code
        tableExists = false;
        const result = await serviceRoleClient
          .from('users')
          .select('email')
          .eq('email', newUserForm.email)
          .maybeSingle();
        
        existingUsers = result.data;
        checkError = result.error;
      }
      
      if (checkError && checkError.code !== '42P01') {
        throw checkError;
      }
      
      if (existingUsers) {
        throw new Error('A user with this email already exists');
      }
      
      // Create the user metadata
      const userMetadata = {
        full_name: newUserForm.full_name || '',
        plan: newUserForm.plan || 'free',
        roles: newUserForm.roles || ['user'],
        subscription_status: newUserForm.subscription_status || 'active'
      };
      
      // Try to create the user in the custom_users table first
      if (tableExists) {
        // Get the current admin's ID
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        
        // Ensure the admin exists in custom_users table
        if (currentUser) {
          await ensureAdminInCustomUsers(currentUser.id, currentUser.email || '', currentUser.user_metadata);
        }
        
        // Generate a random UUID for the new user
        const newUserId = crypto.randomUUID();
        
        const { data: insertedUser, error: insertError } = await serviceRoleClient
          .from('custom_users')
          .insert([
            {
              id: newUserId,
              email: newUserForm.email,
              user_metadata: userMetadata,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              // Set admin_id to current user's ID after ensuring they exist in the table
              admin_id: currentUser?.id
            }
          ])
          .select()
          .single();
        
        if (!insertError) {
          console.log('User created successfully in custom_users table:', insertedUser);
          
          // Refresh the user list to include the new user
          await fetchUsers();
          
          setActionMessage({ 
            type: 'success', 
            message: 'User created successfully!' 
          });
          
          closeCreateModal();
          return;
        } else {
          console.error('Error inserting into custom_users table:', insertError);
          // Continue to try other methods
        }
      }
      
      // If custom_users table doesn't exist or insertion failed, try using the function to add user under admin
      // Get the current admin's ID if we haven't already
      const { data: { user: currentAdmin } } = await supabase.auth.getUser();
      
      // Ensure the admin exists in the custom_users table
      if (currentAdmin) {
        await ensureAdminInCustomUsers(currentAdmin.id, currentAdmin.email || '', currentAdmin.user_metadata);
      }
      
      const { data: functionResult, error: functionError } = await serviceRoleClient.rpc(
        'add_user_under_admin',
        { 
          p_email: newUserForm.email,
          p_admin_id: currentAdmin?.id,
          p_user_metadata: userMetadata 
        }
      );
      
      if (!functionError && functionResult) {
        console.log('User created successfully via function:', functionResult);
        
        // Refresh the user list to include the new user
        await fetchUsers();
        
        setActionMessage({ 
          type: 'success', 
          message: 'User created successfully via database function!' 
        });
        
        closeCreateModal();
        return;
      } else if (functionError) {
        console.error('Error creating user via function:', functionError);
      }
      
      // If all else fails, try the admin API approach
      const tempPassword = 'Temp123!@#';
      
      const { data: newUser, error: createError } = await serviceRoleClient.auth.admin.createUser({
        email: newUserForm.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: userMetadata
      });
      
      if (createError) {
        console.error('Error creating user via admin API:', createError);
        
        // As a last resort, fall back to UI-only approach
        const timestamp = new Date().toISOString();
        const mockUserId = `demo-${Date.now()}`;
        
        // Create a temporary user object for UI display
        const tempUser: User = {
          id: mockUserId,
          email: newUserForm.email,
          created_at: timestamp,
          last_sign_in_at: null,
          user_metadata: userMetadata
        };
        
        // Add the temporary user to the local state
        setUsers(prev => [tempUser, ...prev]);
        
        setActionMessage({ 
          type: 'warning', 
          message: `User added to UI for demonstration only. All database methods failed.` 
        });
      } else {
        console.log('User created successfully via admin API:', newUser);
        
        // Refresh the user list to include the new user
        await fetchUsers();
        
        setActionMessage({ 
          type: 'success', 
          message: `User created successfully! Temporary password: ${tempPassword}` 
        });
      }
      
      closeCreateModal();
    } catch (error: any) {
      console.error('Error creating user:', error);
      setActionMessage({ 
        type: 'error', 
        message: `Failed to create user: ${error.message || 'Unknown error'}` 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const handleRoleChange = (role: string, formType: 'edit' | 'new' = 'edit') => {
    if (formType === 'edit') {
      setEditForm(prev => {
        const roles = [...prev.roles];
        if (roles.includes(role)) {
          return { ...prev, roles: roles.filter(r => r !== role) };
        } else {
          return { ...prev, roles: [...roles, role] };
        }
      });
    } else {
      setNewUserForm(prev => {
        const roles = [...prev.roles];
        if (roles.includes(role)) {
          return { ...prev, roles: roles.filter(r => r !== role) };
        } else {
          return { ...prev, roles: [...roles, role] };
        }
      });
    }
  };
  
  const handleNewUserFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewUserForm(prev => ({ ...prev, [name]: value }));
  };

  const updateUser = async () => {
    if (!selectedUser) return;
    
    if (!serviceRoleClient) {
      setActionMessage({ type: 'error', message: 'Service role client not available. Check your environment variables.' });
      return;
    }
    
    try {
      // Update user metadata using the auth admin API with service role client
      const { error } = await serviceRoleClient.auth.admin.updateUserById(
        selectedUser.id,
        { 
          user_metadata: {
            ...selectedUser.user_metadata,
            plan: editForm.plan,
            roles: editForm.roles,
            subscription_status: editForm.subscription_status,
            full_name: editForm.full_name
          }
        }
      );
      
      if (error) throw error;
      
      // Update local state
      setUsers(prev => 
        prev.map(user => 
          user.id === selectedUser.id 
            ? { 
                ...user, 
                user_metadata: {
                  ...user.user_metadata,
                  plan: editForm.plan,
                  roles: editForm.roles,
                  subscription_status: editForm.subscription_status,
                  full_name: editForm.full_name
                }
              } 
            : user
        )
      );
      
      setActionMessage({ type: 'success', message: 'User updated successfully' });
      closeEditModal();
    } catch (error) {
      console.error('Error updating user:', error);
      setActionMessage({ type: 'error', message: 'Failed to update user' });
    }
  };

  const filteredUsers = users
    .filter(user => {
      // Search filter
      const matchesSearch = 
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.user_metadata?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      // Plan filter
      const matchesPlan = 
        filterPlan === 'all' || 
        user.user_metadata?.plan === filterPlan;
      
      // Admin filter - only show users created by current admin if filter is enabled
      const matchesAdmin = !filterByAdmin || user.admin_id === currentAdminId;
      
      return matchesSearch && matchesPlan && matchesAdmin;
    })
    .sort((a, b) => {
      // Sorting
      if (sortBy === 'email') {
        return sortDirection === 'asc' 
          ? a.email.localeCompare(b.email)
          : b.email.localeCompare(a.email);
      } else if (sortBy === 'created_at') {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      } else if (sortBy === 'plan') {
        const planA = a.user_metadata?.plan || '';
        const planB = b.user_metadata?.plan || '';
        return sortDirection === 'asc'
          ? planA.localeCompare(planB)
          : planB.localeCompare(planA);
      }
      return 0;
    });

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
        <h3 className="text-lg leading-6 font-medium text-gray-900">User Management</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          View and manage all users in the system
        </p>
      </div>
      
      {actionMessage && actionMessage.message && (
        <div className={`p-4 ${actionMessage.type === 'error' ? 'bg-red-100 text-red-700' : 
                           actionMessage.type === 'warning' ? 'bg-yellow-100 text-yellow-700' : 
                           'bg-green-100 text-green-700'}`}>
          {actionMessage.message}
        </div>
      )}
      
      <div className="p-6">
        <div className="bg-gray-50 p-4 rounded-lg mb-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            {/* Search - 4 columns */}
            <div className="md:col-span-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaMagnifyingGlass className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search users..."
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  value={searchTerm}
                  onChange={handleSearch}
                />
              </div>
            </div>
            
            {/* Plan Filter - 2 columns */}
            <div className="md:col-span-2">
              <div className="flex items-center">
                <FaFilter className="h-5 w-5 text-gray-400 mr-2" />
                <select
                  className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  value={filterPlan}
                  onChange={handleFilterChange}
                >
                  <option value="all">All Plans</option>
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
            </div>
            
            {/* My Users Filter - 2 columns */}
            <div className="md:col-span-2">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="filterByAdmin"
                  checked={filterByAdmin}
                  onChange={(e) => setFilterByAdmin(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="filterByAdmin" className="ml-2 text-sm font-medium text-gray-900">
                  My Users Only
                </label>
              </div>
            </div>
            
            {/* Action Buttons - 4 columns */}
            <div className="md:col-span-4 flex justify-end space-x-2">
              <button
                onClick={openCreateModal}
                className="inline-flex items-center justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <FaUserPlus className="h-5 w-5 mr-2" />
                Add User
              </button>
              <button
                onClick={fetchUsers}
                className="inline-flex items-center justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <FaArrowsRotate className="h-5 w-5 mr-2" />
                Refresh
              </button>
            </div>
          </div>
        </div>
        
        {actionMessage && (
          <div className={`mb-4 p-4 rounded-md ${actionMessage.type === 'success' ? 'bg-green-50 text-green-800 border border-green-100' : actionMessage.type === 'warning' ? 'bg-yellow-50 text-yellow-800 border border-yellow-100' : 'bg-red-50 text-red-800 border border-red-100'}`}>
            {actionMessage.message}
          </div>
        )}
        
        {loading ? (
          <div className="flex flex-col justify-center items-center h-64 bg-white shadow rounded-lg">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
            <p className="text-gray-500">Loading users...</p>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                  <th 
                    scope="col" 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSortChange('email')}
                  >
                    <div className="flex items-center">
                      Email
                      {sortBy === 'email' && (
                        <FaSort className="ml-1 h-4 w-4" />
                      )}
                    </div>
                  </th>
                  <th 
                    scope="col" 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSortChange('created_at')}
                  >
                    <div className="flex items-center">
                      Joined
                      {sortBy === 'created_at' && (
                        <FaSort className="ml-1 h-4 w-4" />
                      )}
                    </div>
                  </th>
                  <th 
                    scope="col" 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSortChange('plan')}
                  >
                    <div className="flex items-center">
                      Plan
                      {sortBy === 'plan' && (
                        <FaSort className="ml-1 h-4 w-4" />
                      )}
                    </div>
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Roles
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Admin
                  </th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider relative group">
                    <div className="flex items-center justify-center">
                      <span>User Management Options</span>
                      <span className="ml-1 text-gray-400 cursor-help">
                        <FaUserGear className="h-4 w-4 inline" />
                        <div className="absolute z-10 hidden group-hover:block bg-white shadow-lg rounded-md p-3 text-sm text-left text-gray-700 w-64 right-0 mt-2">
                          <p className="font-semibold mb-2">Available actions:</p>
                          <ul className="list-disc pl-5 space-y-1">
                            <li><span className="text-indigo-600 font-medium">Edit</span>: Modify user details and permissions</li>
                            <li><span className="text-amber-600 font-medium">Deactivate</span>: Temporarily disable user access</li>
                            <li><span className="text-green-600 font-medium">Activate</span>: Re-enable user access</li>
                            <li><span className="text-red-600 font-medium">Delete</span>: Permanently remove the user</li>
                          </ul>
                        </div>
                      </span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center">
                        <FaUserSlash className="h-12 w-12 text-gray-400 mb-3" />
                        <p className="text-gray-500 text-lg font-medium mb-1">No users found</p>
                        <p className="text-gray-400 text-sm">Try adjusting your search or filter criteria</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(user => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{user.email}</div>
                        <div className="text-sm text-gray-500">{user.user_metadata?.full_name || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.user_metadata?.plan === 'pro' 
                            ? 'bg-green-100 text-green-800' 
                            : user.user_metadata?.plan === 'enterprise'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-gray-100 text-gray-800'
                        }`}>
                          {user.user_metadata?.plan || 'Free'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.user_metadata?.roles?.join(', ') || 'user'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.user_metadata?.subscription_status === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {user.user_metadata?.subscription_status || 'inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.admin_id === currentAdminId ? (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            Your User
                          </span>
                        ) : user.admin_id ? (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                            Other Admin
                          </span>
                        ) : (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                            No Admin
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex justify-center space-x-2">
                          <button
                            onClick={() => openEditModal(user)}
                            className="inline-flex items-center px-2.5 py-1.5 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded transition-colors"
                            title="Edit user details, roles, and subscription plan"
                          >
                            <FaUserPen className="h-4 w-4" />
                          </button>
                          
                          <button
                            onClick={() => toggleUserStatus(user)}
                            className={`inline-flex items-center px-2.5 py-1.5 rounded transition-colors ${user.user_metadata?.subscription_status === 'active' 
                              ? 'text-amber-600 hover:text-amber-900 hover:bg-amber-50' 
                              : 'text-green-600 hover:text-green-900 hover:bg-green-50'}`}
                            title={user.user_metadata?.subscription_status === 'active' 
                              ? 'Temporarily disable user access to the system' 
                              : 'Re-enable user access to the system'}
                          >
                            {user.user_metadata?.subscription_status === 'active' ? 
                              <FaUserSlash className="h-4 w-4" /> : 
                              <FaUserCheck className="h-4 w-4" />}
                          </button>
                          
                          <button
                            onClick={() => deleteUser(user.id)}
                            className="inline-flex items-center px-2.5 py-1.5 text-red-600 hover:text-red-900 hover:bg-red-50 rounded transition-colors"
                            title="Permanently remove this user from the system"
                          >
                            <FaTrashCan className="h-4 w-4" />
                          </button>
                          </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
      
      {/* Create User Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Create New User</h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                Add a new user to the system
              </p>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={newUserForm.email}
                    onChange={handleNewUserFormChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    required
                  />
                </div>
                

                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    name="full_name"
                    value={newUserForm.full_name}
                    onChange={handleNewUserFormChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Plan
                  </label>
                  <select
                    name="plan"
                    value={newUserForm.plan}
                    onChange={handleNewUserFormChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  >
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subscription Status
                  </label>
                  <select
                    name="subscription_status"
                    value={newUserForm.subscription_status}
                    onChange={handleNewUserFormChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Roles
                  </label>
                  <div className="mt-1 space-y-2">
                    <div className="flex items-center">
                      <input
                        id="new-role-user"
                        type="checkbox"
                        checked={newUserForm.roles.includes('user')}
                        onChange={() => handleRoleChange('user', 'new')}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <label htmlFor="new-role-user" className="ml-2 block text-sm text-gray-700">
                        User
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                        id="new-role-admin"
                        type="checkbox"
                        checked={newUserForm.roles.includes('admin')}
                        onChange={() => handleRoleChange('admin', 'new')}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <label htmlFor="new-role-admin" className="ml-2 block text-sm text-gray-700">
                        Admin
                      </label>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={createUser}
                  disabled={loading}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center"
                >
                  {loading ? (
                    <>
                      <span className="animate-spin h-4 w-4 mr-2 border-t-2 border-b-2 border-white rounded-full"></span>
                      Creating...
                    </>
                  ) : (
                    <>
                      <FaUserPlus className="mr-2" />
                      Create User
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Edit User Modal */}
      {isEditModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Edit User</h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                {selectedUser.email}
              </p>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  name="full_name"
                  value={editForm.full_name}
                  onChange={handleEditFormChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Plan
                </label>
                <select
                  name="plan"
                  value={editForm.plan}
                  onChange={handleEditFormChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="">Select Plan</option>
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subscription Status
                </label>
                <select
                  name="subscription_status"
                  value={editForm.subscription_status}
                  onChange={handleEditFormChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="">Select Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="trial">Trial</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Roles
                </label>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="role-user"
                      checked={editForm.roles.includes('user')}
                      onChange={() => handleRoleChange('user')}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="role-user" className="ml-2 block text-sm text-gray-900">
                      User
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="role-admin"
                      checked={editForm.roles.includes('admin')}
                      onChange={() => handleRoleChange('admin')}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="role-admin" className="ml-2 block text-sm text-gray-900">
                      Admin
                    </label>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={closeEditModal}
                  className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Cancel
                </button>
                <button
                  onClick={updateUser}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
