import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';

// Define permission types
export type Permission = 
  | 'view_admin_panel'
  | 'manage_users'
  | 'system_settings'
  | 'view_analytics'
  | 'manage_devices'
  | 'advanced_features'
  | 'api_access';

// Define role-permission mappings
const rolePermissions: Record<string, Permission[]> = {
  user: [
    'manage_devices',
  ],
  admin: [
    'view_admin_panel',
    'manage_users',
    'system_settings',
    'view_analytics',
    'manage_devices',
    'advanced_features',
    'api_access',
  ],
};

/**
 * Custom hook for checking user permissions based on roles
 */
export const useRolePermissions = () => {
  const { roles } = useAuth();
  
  // Compute all permissions for the user based on their roles
  const permissions = useMemo(() => {
    const permissionSet = new Set<Permission>();
    
    // Add permissions for each role the user has
    roles.forEach(role => {
      const permsForRole = rolePermissions[role] || [];
      permsForRole.forEach(perm => permissionSet.add(perm));
    });
    
    return Array.from(permissionSet);
  }, [roles]);
  
  // Check if the user has a specific permission
  const hasPermission = (permission: Permission): boolean => {
    return permissions.includes(permission);
  };
  
  return {
    permissions,
    hasPermission,
  };
};

export default useRolePermissions;
