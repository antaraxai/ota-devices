-- Add admin relationship to custom_users table
-- This allows tracking which admin created which user

-- First, add the admin_id column to the custom_users table
ALTER TABLE public.custom_users 
ADD COLUMN admin_id UUID NULL;

-- We're intentionally NOT adding a foreign key constraint here
-- because the admin might be in auth.users but not in custom_users

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_custom_users_admin_id ON public.custom_users(admin_id);

-- Create a function to get all users created by a specific admin
CREATE OR REPLACE FUNCTION public.get_users_by_admin(admin_uuid UUID)
RETURNS SETOF public.custom_users
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM public.custom_users WHERE admin_id = admin_uuid;
$$;

-- Create a function to add a user under a specific admin
CREATE OR REPLACE FUNCTION public.add_user_under_admin(
  p_email TEXT,
  p_admin_id UUID,
  p_user_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_admin_exists BOOLEAN;
BEGIN
  -- First check if the admin exists in auth.users
  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE id = p_admin_id
  ) INTO v_admin_exists;
  
  -- Generate a new UUID if admin doesn't exist or is NULL
  IF p_admin_id IS NULL OR NOT v_admin_exists THEN
    v_user_id := gen_random_uuid();
  ELSE
    -- Use the admin_id as is
    v_user_id := gen_random_uuid();
  END IF;
  
  INSERT INTO public.custom_users (
    id,
    email,
    admin_id,
    user_metadata,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    p_email,
    CASE WHEN v_admin_exists THEN p_admin_id ELSE NULL END,
    p_user_metadata,
    now(),
    now()
  )
  RETURNING id INTO v_user_id;
  
  RETURN v_user_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_users_by_admin TO service_role;
GRANT EXECUTE ON FUNCTION public.add_user_under_admin TO service_role;
