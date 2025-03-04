import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

/**
 * Check if a user has an active subscription
 * @param user The Supabase user object
 * @returns Promise<boolean> indicating if the user has an active subscription
 */
export const hasActiveSubscription = async (user: User | null): Promise<boolean> => {
  if (!user?.email) return false;
  
  try {
    // Check user metadata for subscription status
    // We'll rely solely on user metadata since we don't have permission to access the subscription tables
    if (user.user_metadata?.plan === 'pro' && user.user_metadata?.subscription_status === 'active') {
      return true;
    }
    
    // If the user has an admin role, they should have pro access
    if (user.user_metadata?.roles && Array.isArray(user.user_metadata.roles)) {
      if (user.user_metadata.roles.includes('admin')) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error in hasActiveSubscription:', error);
    return false;
  }
};

/**
 * Update user metadata with subscription information
 * @param user The Supabase user object
 * @param plan The plan type ('free' or 'pro')
 * @returns Promise<boolean> indicating if the update was successful
 */
export const updateUserSubscription = async (
  user: User | null, 
  plan: 'free' | 'pro'
): Promise<boolean> => {
  if (!user) return false;
  
  try {
    // Determine user role based on plan
    const roles = plan === 'pro' ? ['user', 'admin'] : ['user'];
    
    // Update user metadata
    const { error } = await supabase.auth.updateUser({
      data: {
        plan,
        roles,
        subscription_status: plan === 'pro' ? 'active' : 'inactive'
      }
    });
    
    if (error) {
      console.error('Error updating user subscription:', error);
      return false;
    }
    
    // Refresh the session to ensure updated metadata is available
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      console.error('Error refreshing session after subscription update:', refreshError);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error in updateUserSubscription:', error);
    return false;
  }
};
