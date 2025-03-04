import { User } from '@supabase/supabase-js';

/**
 * Checks if a user has a specific role
 * @param user The user object from Supabase
 * @param role The role to check for
 * @returns boolean indicating if the user has the specified role
 */
export const hasRole = (user: User | null, role: string): boolean => {
  if (!user) return false;
  
  try {
    const roles = user.user_metadata?.roles;
    if (!roles) return false;
    
    // If roles is a string (for backward compatibility), convert to array
    if (typeof roles === 'string') {
      return roles === role;
    }
    
    // If roles is an array, check if it includes the role
    if (Array.isArray(roles)) {
      return roles.includes(role);
    }
    
    return false;
  } catch (error) {
    console.error('Error checking user role:', error);
    return false;
  }
};

/**
 * Checks if a user has admin role
 * @param user The user object from Supabase
 * @returns boolean indicating if the user has admin role
 */
export const isAdmin = (user: User | null): boolean => {
  return hasRole(user, 'admin');
};

/**
 * Gets all roles for a user
 * @param user The user object from Supabase
 * @returns Array of role strings or empty array if no roles
 */
export const getUserRoles = (user: User | null): string[] => {
  if (!user) return [];
  
  try {
    const roles = user.user_metadata?.roles;
    if (!roles) return [];
    
    // If roles is a string (for backward compatibility), convert to array
    if (typeof roles === 'string') {
      return [roles];
    }
    
    // If roles is an array, return it
    if (Array.isArray(roles)) {
      return roles;
    }
    
    return [];
  } catch (error) {
    console.error('Error getting user roles:', error);
    return [];
  }
};
