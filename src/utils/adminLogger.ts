import { supabase } from '../lib/supabase';

export interface AdminLogEntry {
  action: string;
  details: any;
  performed_by: string;
  target_user_id?: string;
  ip_address?: string;
  timestamp?: string;
}

/**
 * Logs an admin action to the database for audit purposes
 * 
 * @param entry The log entry to record
 * @returns Promise resolving to the result of the database operation
 */
/**
 * Checks if the admin_logs table exists in the database
 * @returns Promise resolving to a boolean indicating if the table exists
 */
export const checkAdminLogsTableExists = async (): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('admin_logs')
      .select('id')
      .limit(1);
    
    if (error && error.code === '42P01') { // PostgreSQL error code for relation does not exist
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error checking admin_logs table:', error);
    return false;
  }
};

/**
 * Logs an admin action to the database for audit purposes
 * Falls back to local storage if the database table doesn't exist
 * 
 * @param entry The log entry to record
 * @returns Promise resolving to the result of the database operation
 */
export const logAdminAction = async (entry: AdminLogEntry) => {
  try {
    // Set timestamp if not provided
    if (!entry.timestamp) {
      entry.timestamp = new Date().toISOString();
    }
    
    // Get client IP if available
    if (!entry.ip_address && typeof window !== 'undefined') {
      try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        entry.ip_address = data.ip;
      } catch (error) {
        console.warn('Could not determine client IP address', error);
        entry.ip_address = 'unknown';
      }
    }
    
    // Check if table exists before attempting to insert
    const tableExists = await checkAdminLogsTableExists();
    
    if (!tableExists) {
      console.warn('Admin logs table does not exist, falling back to local storage');
      // Store in local storage
      const existingLogs = JSON.parse(localStorage.getItem('admin_logs') || '[]');
      existingLogs.push(entry);
      localStorage.setItem('admin_logs', JSON.stringify(existingLogs));
      return null;
    }
    
    // Insert log entry into the admin_logs table
    const { data, error } = await supabase
      .from('admin_logs')
      .insert([entry]);
    
    if (error) {
      console.error('Error logging admin action:', error);
      
      // Fallback to local storage if database insert fails
      const existingLogs = JSON.parse(localStorage.getItem('admin_logs') || '[]');
      existingLogs.push(entry);
      localStorage.setItem('admin_logs', JSON.stringify(existingLogs));
      
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Error in logAdminAction:', error);
    // Don't throw the error to prevent disrupting the main application flow
    return null;
  }
};

/**
 * Retrieves admin logs from the database
 * 
 * @param limit Maximum number of logs to retrieve
 * @param offset Offset for pagination
 * @param filters Optional filters for the logs
 * @returns Promise resolving to the admin logs
 */
/**
 * Retrieves admin logs from the database
 * Falls back to local storage if the database table doesn't exist
 * 
 * @param limit Maximum number of logs to retrieve
 * @param offset Offset for pagination
 * @param filters Optional filters for the logs
 * @returns Promise resolving to the admin logs
 */
export const getAdminLogs = async (
  limit: number = 100, 
  offset: number = 0,
  filters: { 
    action?: string, 
    performed_by?: string,
    target_user_id?: string,
    from_date?: string,
    to_date?: string
  } = {}
) => {
  try {
    // Check if table exists before attempting to query
    const tableExists = await checkAdminLogsTableExists();
    
    if (!tableExists) {
      console.warn('Admin logs table does not exist, falling back to local storage');
      // Return logs from local storage
      const localLogs = JSON.parse(localStorage.getItem('admin_logs') || '[]');
      
      // Apply filters manually for local storage logs
      let filteredLogs = [...localLogs];
      
      if (filters.action) {
        filteredLogs = filteredLogs.filter(log => log.action === filters.action);
      }
      
      if (filters.performed_by) {
        filteredLogs = filteredLogs.filter(log => log.performed_by === filters.performed_by);
      }
      
      if (filters.target_user_id) {
        filteredLogs = filteredLogs.filter(log => log.target_user_id === filters.target_user_id);
      }
      
      if (filters.from_date) {
        filteredLogs = filteredLogs.filter(log => log.timestamp >= filters.from_date);
      }
      
      if (filters.to_date) {
        filteredLogs = filteredLogs.filter(log => log.timestamp <= filters.to_date);
      }
      
      // Sort by timestamp descending
      filteredLogs.sort((a, b) => new Date(b.timestamp || '').getTime() - new Date(a.timestamp || '').getTime());
      
      // Apply pagination
      return filteredLogs.slice(offset, offset + limit);
    }
    
    let query = supabase
      .from('admin_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);
    
    // Apply filters if provided
    if (filters.action) {
      query = query.eq('action', filters.action);
    }
    
    if (filters.performed_by) {
      query = query.eq('performed_by', filters.performed_by);
    }
    
    if (filters.target_user_id) {
      query = query.eq('target_user_id', filters.target_user_id);
    }
    
    if (filters.from_date) {
      query = query.gte('timestamp', filters.from_date);
    }
    
    if (filters.to_date) {
      query = query.lte('timestamp', filters.to_date);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching admin logs:', error);
      
      // Fallback to local storage if database query fails
      const localLogs = JSON.parse(localStorage.getItem('admin_logs') || '[]');
      
      return localLogs;
    }
    
    return data;
  } catch (error) {
    console.error('Error in getAdminLogs:', error);
    return [];
  }
};
