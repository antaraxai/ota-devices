import React, { useState, useEffect } from 'react';
import { getAdminLogs, AdminLogEntry } from '../utils/adminLogger';
import { FaMagnifyingGlass, FaFilter, FaDownload, FaCalendarDays, FaUser, FaTriangleExclamation, FaDatabase } from 'react-icons/fa6';
import { supabase } from '../lib/supabase';

const AdminLogs: React.FC = () => {
  const [logs, setLogs] = useState<AdminLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [performedBy, setPerformedBy] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [tableExists, setTableExists] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const logsPerPage = 20;

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter, fromDate, toDate, performedBy]);

  const checkTableExists = async () => {
    try {
      // Try to query the table to see if it exists
      const { data, error } = await supabase
        .from('admin_logs')
        .select('id')
        .limit(1);
      
      if (error) {
        // Check if the error is related to the table not existing
        if (error.code === '42P01') { // PostgreSQL error code for relation does not exist
          setTableExists(false);
          setError('The admin_logs table does not exist in the database. Please run the migration script to create it.');
        } else {
          setError(`Error checking admin_logs table: ${error.message}`);
        }
      } else {
        setTableExists(true);
        setError(null);
      }
    } catch (err) {
      console.error('Error checking table existence:', err);
      setError('An unexpected error occurred while checking the admin_logs table.');
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // First check if the table exists
      await checkTableExists();
      
      // If table doesn't exist, don't try to fetch logs
      if (!tableExists) {
        setLoading(false);
        return;
      }
      
      const filters = {
        action: actionFilter || undefined,
        performed_by: performedBy || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined
      };
      
      const data = await getAdminLogs(logsPerPage, page * logsPerPage, filters);
      setLogs(data || []);
      
      // For simplicity, we're assuming there are more pages if we got a full page of logs
      setTotalPages(Math.max(1, Math.ceil((data?.length || 0) / logsPerPage)));
    } catch (error) {
      console.error('Error fetching admin logs:', error);
      setError('An error occurred while fetching admin logs. Check the console for details.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleActionFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setActionFilter(e.target.value);
    setPage(0); // Reset to first page when filter changes
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'from' | 'to') => {
    if (type === 'from') {
      setFromDate(e.target.value);
    } else {
      setToDate(e.target.value);
    }
    setPage(0); // Reset to first page when filter changes
  };

  const handlePerformedByChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPerformedBy(e.target.value);
    setPage(0); // Reset to first page when filter changes
  };

  const exportLogs = () => {
    // Filter logs based on search term
    const filteredLogs = logs.filter(log => 
      JSON.stringify(log).toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    // Convert to CSV
    const headers = ['Timestamp', 'Action', 'Performed By', 'Target User', 'IP Address', 'Details'];
    const csvContent = [
      headers.join(','),
      ...filteredLogs.map(log => [
        log.timestamp,
        log.action,
        log.performed_by,
        log.target_user_id || '',
        log.ip_address || '',
        JSON.stringify(log.details).replace(/,/g, ';') // Replace commas in JSON to avoid CSV parsing issues
      ].join(','))
    ].join('\n');
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `admin_logs_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter logs based on search term
  const filteredLogs = logs.filter(log => 
    JSON.stringify(log).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
        <h3 className="text-lg leading-6 font-medium text-gray-900">Admin Action Logs</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          View and search through all administrative actions
        </p>
      </div>
      
      <div className="p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6 justify-between">
          <div className="relative flex-grow max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FaMagnifyingGlass className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search logs..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={searchTerm}
              onChange={handleSearch}
            />
          </div>
          
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex items-center">
              <FaFilter className="h-5 w-5 text-gray-400 mr-2" />
              <select
                className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                value={actionFilter}
                onChange={handleActionFilterChange}
              >
                <option value="">All Actions</option>
                <option value="user_update">User Update</option>
                <option value="user_role_change">Role Change</option>
                <option value="settings_update">Settings Update</option>
                <option value="subscription_change">Subscription Change</option>
              </select>
            </div>
            
            <button
              onClick={exportLogs}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <FaDownload className="mr-2 h-4 w-4" />
              Export
            </button>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex items-center">
            <FaCalendarDays className="h-5 w-5 text-gray-400 mr-2" />
            <input
              type="date"
              placeholder="From Date"
              className="block w-full py-2 px-3 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={fromDate}
              onChange={(e) => handleDateChange(e, 'from')}
            />
          </div>
          
          <div className="flex items-center">
            <FaCalendarDays className="h-5 w-5 text-gray-400 mr-2" />
            <input
              type="date"
              placeholder="To Date"
              className="block w-full py-2 px-3 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={toDate}
              onChange={(e) => handleDateChange(e, 'to')}
            />
          </div>
          
          <div className="flex items-center flex-grow">
            <FaUser className="h-5 w-5 text-gray-400 mr-2" />
            <input
              type="text"
              placeholder="Performed By (email)"
              className="block w-full py-2 px-3 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={performedBy}
              onChange={handlePerformedByChange}
            />
          </div>
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        ) : error || !tableExists ? (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <FaTriangleExclamation className="h-5 w-5 text-yellow-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Database Setup Required</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>{error || 'The admin_logs table does not exist in the database.'}</p>
                  <p className="mt-2">To create the admin_logs table, you need to run the migration script:</p>
                  <div className="mt-2 bg-gray-800 text-white p-3 rounded-md overflow-x-auto">
                    <code>cd /path/to/project && npx supabase migration up</code>
                  </div>
                  <p className="mt-2">Or manually execute the SQL script located at:</p>
                  <div className="mt-2 bg-gray-800 text-white p-3 rounded-md overflow-x-auto">
                    <code>supabase/migrations/20250304_create_admin_logs_table.sql</code>
                  </div>
                  <p className="mt-2"><strong>Note:</strong> Make sure your user has 'admin' in the roles array in raw_user_meta_data.</p>
                  <button 
                    onClick={fetchLogs}
                    className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <FaDatabase className="mr-2 h-4 w-4" />
                    Retry Connection
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Performed By
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Target User
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      IP Address
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                        No logs found
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(log.timestamp || '').toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            log.action.includes('update') 
                              ? 'bg-blue-100 text-blue-800' 
                              : log.action.includes('delete')
                                ? 'bg-red-100 text-red-800'
                                : 'bg-green-100 text-green-800'
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {log.performed_by}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {log.target_user_id || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {log.ip_address || 'Unknown'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          <div className="max-w-xs overflow-hidden text-ellipsis">
                            {typeof log.details === 'object' 
                              ? JSON.stringify(log.details, null, 2) 
                              : String(log.details)}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 sm:px-6 mt-4">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${
                    page === 0
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                  disabled={page >= totalPages - 1}
                  className={`ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${
                    page >= totalPages - 1
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{page * logsPerPage + 1}</span> to{' '}
                    <span className="font-medium">
                      {Math.min((page + 1) * logsPerPage, page * logsPerPage + filteredLogs.length)}
                    </span>{' '}
                    of <span className="font-medium">{totalPages * logsPerPage}</span> results
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => setPage(Math.max(0, page - 1))}
                      disabled={page === 0}
                      className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium ${
                        page === 0
                          ? 'text-gray-300 cursor-not-allowed'
                          : 'text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <span className="sr-only">Previous</span>
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                    {[...Array(Math.min(5, totalPages))].map((_, i) => {
                      const pageNum = page - 2 + i;
                      if (pageNum < 0 || pageNum >= totalPages) return null;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            page === pageNum
                              ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum + 1}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                      disabled={page >= totalPages - 1}
                      className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium ${
                        page >= totalPages - 1
                          ? 'text-gray-300 cursor-not-allowed'
                          : 'text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <span className="sr-only">Next</span>
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminLogs;
