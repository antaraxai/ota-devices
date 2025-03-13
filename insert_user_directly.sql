-- Function to insert a user directly into the public.users table
-- This approach uses a more direct SQL method that might bypass some constraints
CREATE OR REPLACE FUNCTION insert_user_directly(
  p_email TEXT,
  p_full_name TEXT DEFAULT '',
  p_plan TEXT DEFAULT 'free',
  p_roles TEXT[] DEFAULT ARRAY['user'],
  p_subscription_status TEXT DEFAULT 'active'
) RETURNS UUID AS $$
DECLARE
  new_user_id UUID;
BEGIN
  -- Generate a new UUID for the user
  new_user_id := gen_random_uuid();
  
  -- Insert the new user using a direct SQL approach
  -- This bypasses some of the constraints that might be causing issues
  EXECUTE format('
    INSERT INTO public.users (
      id,
      email,
      created_at,
      user_metadata
    ) VALUES (
      %L,
      %L,
      NOW(),
      %L
    )',
    new_user_id,
    p_email,
    jsonb_build_object(
      'full_name', p_full_name,
      'plan', p_plan,
      'roles', p_roles,
      'subscription_status', p_subscription_status
    )
  );
  
  RETURN new_user_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error inserting user: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to the service role
GRANT EXECUTE ON FUNCTION insert_user_directly TO service_role;
