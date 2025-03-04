import { User } from '@supabase/supabase-js';
import { supabase } from '../config';

interface UserMetadata {
  roles?: string[];
  customer_id?: string;
  subscription_status?: string;
}

export const getUserRoles = async (userId: string): Promise<string[]> => {
  try {
    const { data: { user }, error } = await supabase.auth.admin.getUserById(userId);
    
    if (error) {
      console.error('Error fetching user:', error);
      return [];
    }

    if (!user) {
      console.warn('No user found');
      return [];
    }

    const metadata = user.user_metadata as UserMetadata;
    console.log(metadata);
    
    return metadata.roles || [];
  } catch (error) {
    console.error('Error in getUserRoles:', error);
    return [];
  }
};

export const getCurrentUserRoles = async (): Promise<string[]> => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('Error fetching current user:', error);
      return [];
    }

    if (!user) {
      console.warn('No current user found');
      return [];
    }

    const metadata = user.user_metadata as UserMetadata;
    return metadata.roles || [];
  } catch (error) {
    console.error('Error in getCurrentUserRoles:', error);
    return [];
  }
};

export const hasRole = async (user: User | null, role: string): Promise<boolean> => {
  if (!user) return false;
  
  try {
    const metadata = user.user_metadata as UserMetadata;
    return metadata.roles?.includes(role) || false;
  } catch (error) {
    console.error('Error in hasRole:', error);
    return false;
  }
};