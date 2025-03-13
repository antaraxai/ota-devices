-- SQL to create a custom users table without the foreign key constraint
-- This is a development-only solution and should not be used in production without careful consideration

-- Create a new table for managing users without the foreign key constraint
CREATE TABLE IF NOT EXISTS public.custom_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_sign_in_at TIMESTAMP WITH TIME ZONE,
  user_metadata JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true
);

-- Add appropriate indexes
CREATE INDEX IF NOT EXISTS idx_custom_users_email ON public.custom_users(email);

-- Add RLS policies (similar to what you might have on the original users table)
ALTER TABLE public.custom_users ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated users
CREATE POLICY "Allow authenticated users to view all users"
  ON public.custom_users
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow service role to manage all users
CREATE POLICY "Allow service role to manage all users"
  ON public.custom_users
  FOR ALL
  TO service_role
  USING (true);

-- Function to insert a new user
CREATE OR REPLACE FUNCTION public.insert_custom_user(
  p_email TEXT,
  p_user_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  INSERT INTO public.custom_users (
    email,
    user_metadata
  ) VALUES (
    p_email,
    p_user_metadata
  )
  RETURNING id INTO v_user_id;
  
  RETURN v_user_id;
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.insert_custom_user TO service_role;
