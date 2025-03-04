import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaCheckCircle, FaSpinner } from 'react-icons/fa';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';

const SubscriptionSuccess: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(true);
  const [planType, setPlanType] = useState<string>('');
  // Track if we've already attempted to update the user to prevent multiple calls
  const [updateAttempted, setUpdateAttempted] = useState(false);

  useEffect(() => {
    const updateUserMetadata = async () => {
      // Prevent multiple update attempts
      if (updateAttempted) {
        console.log('Update already attempted, skipping to prevent rate limit issues');
        return;
      }

      try {
        setIsProcessing(true);
        setUpdateAttempted(true); // Mark that we've attempted an update
        
        if (!user?.email) {
          console.error('No user email found, cannot update subscription');
          toast.error('User information not available');
          setIsProcessing(false);
          return;
        }

        // Get the session_id from URL params
        const params = new URLSearchParams(location.search);
        const sessionId = params.get('session_id');
        const checkoutSessionId = params.get('checkout_session_id');
        const paymentIntentId = params.get('payment_intent');
        
        // Use any available ID for tracking
        const trackingId = sessionId || checkoutSessionId || paymentIntentId;

        if (!trackingId) {
          console.log('No session ID or tracking ID found in URL, proceeding with direct update');
        } else {
          console.log('Processing subscription with tracking ID:', trackingId);
        }

        // Check if user already has pro plan to avoid unnecessary updates
        if (user.user_metadata?.plan === 'pro' && 
            user.user_metadata?.subscription_status === 'active' &&
            user.user_metadata?.roles?.includes('admin')) {
          console.log('User already has Pro plan and admin role, skipping update');
          setPlanType('pro');
          setIsProcessing(false);
          return;
        }

        // Since we're on the success page, we'll directly update the user to Pro plan
        console.log('Setting plan type to: pro');
        setPlanType('pro');
        
        // Directly update user metadata with Pro plan and admin role
        const { error: updateError } = await supabase.auth.updateUser({
          data: {
            subscription_status: 'active',
            plan: 'pro',
            roles: ['user', 'admin']
          }
        });

        if (updateError) {
          console.error('Error updating user metadata:', updateError);
          
          // Special handling for rate limit errors
          if (updateError.message?.includes('rate limit')) {
            toast.error('Update rate limit reached. Please try again in a few minutes.');
          } else {
            toast.error('Failed to update user information');
          }
          
          setIsProcessing(false);
          return;
        }
        
        console.log('Successfully updated user to Pro plan with admin role');
        
        // Only refresh the session if the update was successful
        try {
          const { data: sessionData, error: sessionError } = await supabase.auth.refreshSession();
          
          if (sessionError) {
            console.error('Error refreshing session:', sessionError);
            // Continue even if refresh fails - the update was successful
          } else {
            console.log('Session refreshed successfully with new metadata:', sessionData.session?.user.user_metadata);
          }
        } catch (refreshError) {
          console.error('Exception during session refresh:', refreshError);
          // Continue even if refresh fails - the update was successful
        }
        
        toast.success('Subscription information updated successfully');
        setIsProcessing(false);
      } catch (error) {
        console.error('Error in subscription process:', error);
        toast.error('An error occurred during the subscription process');
        setIsProcessing(false);
      }
    };

    updateUserMetadata();
  }, [user, location]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
        {isProcessing ? (
          <>
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100 mb-4">
              <FaSpinner className="h-6 w-6 text-indigo-600 animate-spin" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Processing Your Subscription</h2>
            <p className="text-gray-600 mb-8">
              Please wait while we update your account information...
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <FaCheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Payment Successful!</h2>
            <p className="text-gray-600 mb-8">
              {planType === 'pro' 
                ? "Thank you for subscribing to our Pro plan. Your account has been upgraded with Pro features and admin access."
                : "Thank you for your subscription. Your account has been updated successfully."}
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full bg-indigo-600 text-white rounded-md py-2 px-4 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              disabled={isProcessing}
            >
              Return to Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default SubscriptionSuccess;