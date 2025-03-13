-- Function to create a user in public.users without requiring an auth.users entry
-- This bypasses the foreign key constraint by temporarily disabling the trigger
CREATE OR REPLACE FUNCTION create_user_without_auth(
  user_email TEXT,
  user_full_name TEXT DEFAULT '',
  user_plan TEXT DEFAULT 'free',
  user_roles TEXT[] DEFAULT ARRAY['user'],
  user_subscription_status TEXT DEFAULT 'active'
) RETURNS VOID AS $$
DECLARE
  new_user_id UUID;
BEGIN
  -- Generate a new UUID for the user
  new_user_id := gen_random_uuid();
  
  -- Temporarily disable the foreign key constraint trigger
  -- This is the key part that allows us to insert without an auth.users entry
  ALTER TABLE public.users DISABLE TRIGGER ALL;
  
  -- Insert the new user into public.users
  INSERT INTO public.users (
    id,
    email,
    created_at,
    last_sign_in_at,
    user_metadata,
    updated_at
  ) VALUES (
    new_user_id,
    user_email,
    NOW(),
    NULL,
    jsonb_build_object(
      'full_name', user_full_name,
      'plan', user_plan,
      'roles', user_roles,
      'subscription_status', user_subscription_status
    ),
    NOW()
  );
  
  -- Re-enable the trigger
  ALTER TABLE public.users ENABLE TRIGGER ALL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to the service role
GRANT EXECUTE ON FUNCTION create_user_without_auth TO service_role;
