import { createContext, useContext, useEffect, useState } from 'react'
import { User, AuthError, Provider } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { log } from 'node:console'

interface AuthContextType {
  user: User | null
  loading: boolean
  plan: string
  roles: string[]
  isAdmin: boolean
  refreshUserData: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  signInWithProvider: (provider: Provider) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [plan, setPlan] = useState<string>('free')
  const [roles, setRoles] = useState<string[]>(['user'])
  const [isAdmin, setIsAdmin] = useState<boolean>(false)

  // Track last refresh time to prevent rate limiting
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0);
  const MIN_REFRESH_INTERVAL = 5000; // 5 seconds minimum between refreshes

  // Function to refresh user data from the current session
  const refreshUserData = async () => {
    try {
      // Check if we've refreshed recently to avoid rate limits
      const now = Date.now();
      if (now - lastRefreshTime < MIN_REFRESH_INTERVAL) {
        console.log('Skipping refresh to avoid rate limits - too soon since last refresh');
        return;
      }
      
      setLastRefreshTime(now);
      
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        if (error.message?.includes('rate limit')) {
          console.warn('Rate limit reached during session refresh. Using existing session data.');
          // Continue with current user data instead of failing
        } else {
          console.error('Error refreshing session:', error);
          return;
        }
      }
      
      const currentUser = data?.session?.user ?? user;
      if (!currentUser) {
        setUser(null);
        setPlan('free');
        setRoles(['user']);
        setIsAdmin(false);
        return;
      }
      
      setUser(currentUser);
      
      const metadata = currentUser.user_metadata;
      console.log('User metadata:', metadata);
      
      // Update plan
      const userPlan = metadata?.plan || 'free';
      setPlan(userPlan);
      console.log('Setting plan to:', userPlan);
      
      // Update roles
      let userRoles: string[] = ['user'];
      
      if (metadata?.roles) {
        if (typeof metadata.roles === 'string') {
          userRoles = [metadata.roles];
        } else if (Array.isArray(metadata.roles)) {
          userRoles = metadata.roles;
        }
      }
      
      setRoles(userRoles);
      console.log('Setting roles to:', userRoles);
      
      // Check if user is admin
      setIsAdmin(userRoles.includes('admin'));
    } catch (error) {
      console.error('Error in refreshUserData:', error);
    }
  };

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        const metadata = currentUser.user_metadata;
        console.log('Initial user metadata:', metadata);
        
        // Update plan
        const userPlan = metadata?.plan || 'free';
        setPlan(userPlan);
        console.log('Setting initial plan to:', userPlan);
        
        // Update roles
        let userRoles: string[] = ['user'];
        
        if (metadata?.roles) {
          if (typeof metadata.roles === 'string') {
            userRoles = [metadata.roles];
          } else if (Array.isArray(metadata.roles)) {
            userRoles = metadata.roles;
          }
        }
        
        setRoles(userRoles);
        console.log('Setting initial roles to:', userRoles);
        
        // Check if user is admin
        setIsAdmin(userRoles.includes('admin'));
      }
      setLoading(false);
    })

    // Listen for changes on auth state (sign in, sign out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        const metadata = currentUser.user_metadata;
        console.log('Auth state change - user metadata:', metadata);
        
        // Update plan
        const userPlan = metadata?.plan || 'free';
        setPlan(userPlan);
        console.log('Setting plan to:', userPlan);
        
        // Update roles
        let userRoles: string[] = ['user'];
        
        if (metadata?.roles) {
          if (typeof metadata.roles === 'string') {
            userRoles = [metadata.roles];
          } else if (Array.isArray(metadata.roles)) {
            userRoles = metadata.roles;
          }
        }
        
        setRoles(userRoles);
        console.log('Setting roles to:', userRoles);
        
        // Check if user is admin
        setIsAdmin(userRoles.includes('admin'));
      } else {
        setPlan('free');
        setRoles(['user']);
        setIsAdmin(false);
      }
      setLoading(false);
    })

    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email: string, password: string) => {
    // First, check if the user has a subscription
    // const { data: subscriptionData, error: subscriptionError } = await supabase
    //   .from('subscription')
    //   .select('attrs')
    //   .eq('email', email)
    //   .single();

    // if (subscriptionError && subscriptionError.code !== 'PGRST116') {
    //   throw subscriptionError;
    // }

    // // Get the plan ID from the subscription attrs
    // const planId = subscriptionData?.attrs?.plan?.id;

    // // If we have a plan ID, look up the product details
    // let isPro = false;
    // if (planId) {
    //   const { data: productData, error: productError } = await supabase
    //     .from('products')
    //     .select('*')
    //     .eq('id', planId)
    //     .single();

    //   if (productError) {
    //     throw productError;
    //   }

    //   // Determine if this is a pro plan based on the product data
    //   isPro = productData?.type === 'pro';
    // }

    // const userRole = isPro ? ['user', 'admin'] : ['user'];

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          roles: "user",
          plan: "free"
        }
      }
    });
    if (error) throw error;
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;

    // Get user metadata using auth.getUser()
    const { data: { user } } = await supabase.auth.getUser();
    const metadata = user?.user_metadata;
    console.log('User metadata:', metadata);

    // Get roles from metadata or default to basic user role
    const roles = metadata?.roles || ['user'];
    await updateUserRole(roles);

    // Update user roles based on subscription status
    const { data: subscriptionData, error: subscriptionError } = await supabase
      .from('subscription')
      .select('attrs')
      .eq('email', email)
      .single();

    // If no subscription found or other error, default to basic user role
    if (subscriptionError && subscriptionError.code !== 'PGRST116') {
      console.warn('Error fetching subscription:', subscriptionError);
      await updateUserRole(['user']);
      return;
    }

    // Get the plan ID from the subscription attrs
    const planId = subscriptionData?.attrs?.plan?.id;

    // If no plan ID found, default to basic user role
    if (!planId) {
      await updateUserRole(['user']);
      return;
    }

    // Look up the product details
    const { data: productData, error: productError } = await supabase
      .from('products')
      .select('type')
      .eq('id', planId)
      .single();

    if (productError) {
      console.warn('Error fetching product:', productError);
      await updateUserRole(['user']);
      return;
    }

    // Determine user role based on subscription type
    const userRole = productData?.type === 'pro' ? ['user', 'admin'] : ['user'];
    await updateUserRole(userRole);
  }

  // Helper function to update user role
  const updateUserRole = async (roles: string[]) => {
    const { error: updateError } = await supabase.auth.updateUser({
      data: { roles }
    });
    if (updateError) throw updateError;
  }

  const signInWithProvider = async (provider: Provider) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })
    if (error) throw error
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  const value = {
    user,
    loading,
    plan,
    roles,
    isAdmin,
    refreshUserData,
    signIn,
    signUp,
    signOut,
    signInWithProvider
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
