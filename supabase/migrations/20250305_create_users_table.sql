-- Create users table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_sign_in_at TIMESTAMP WITH TIME ZONE,
    user_metadata JSONB DEFAULT '{}'::JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create RLS policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Policy for users to view their own data
CREATE POLICY "Users can view their own data"
ON public.users
FOR SELECT
USING (auth.uid() = id);

-- Policy for users to update their own data
CREATE POLICY "Users can update their own data"
ON public.users
FOR UPDATE
USING (auth.uid() = id);

-- Policy for admins to view all users
CREATE POLICY "Admins can view all users"
ON public.users
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM auth.users
        WHERE auth.users.id = auth.uid()
        AND (
            (auth.users.raw_user_meta_data ? 'roles' AND auth.users.raw_user_meta_data->'roles' @> '["admin"]'::jsonb)
            OR auth.users.raw_user_meta_data->>'plan' = 'pro'
        )
    )
);

-- Policy for admins to update all users
CREATE POLICY "Admins can update all users"
ON public.users
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM auth.users
        WHERE auth.users.id = auth.uid()
        AND (
            (auth.users.raw_user_meta_data ? 'roles' AND auth.users.raw_user_meta_data->'roles' @> '["admin"]'::jsonb)
            OR auth.users.raw_user_meta_data->>'plan' = 'pro'
        )
    )
);

-- Policy for admins to delete users
CREATE POLICY "Admins can delete users"
ON public.users
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM auth.users
        WHERE auth.users.id = auth.uid()
        AND (
            (auth.users.raw_user_meta_data ? 'roles' AND auth.users.raw_user_meta_data->'roles' @> '["admin"]'::jsonb)
            OR auth.users.raw_user_meta_data->>'plan' = 'pro'
        )
    )
);

-- Create a trigger to sync user data from auth.users
CREATE OR REPLACE FUNCTION public.sync_user_data()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.users (id, email, created_at, user_metadata)
        VALUES (NEW.id, NEW.email, NEW.created_at, NEW.raw_user_meta_data);
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO public.users (id, email, last_sign_in_at, user_metadata, updated_at)
        VALUES (NEW.id, NEW.email, NEW.last_sign_in_at, NEW.raw_user_meta_data, NOW())
        ON CONFLICT (id) DO UPDATE
        SET 
            email = EXCLUDED.email,
            last_sign_in_at = EXCLUDED.last_sign_in_at,
            user_metadata = EXCLUDED.user_metadata,  -- Change this line
            updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS sync_user_data_trigger ON auth.users;
CREATE TRIGGER sync_user_data_trigger
AFTER INSERT OR UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_data();

-- Populate the users table with existing users
INSERT INTO public.users (id, email, created_at, last_sign_in_at, user_metadata)
SELECT 
    id, 
    email, 
    created_at, 
    last_sign_in_at, 
    raw_user_meta_data
FROM auth.users
ON CONFLICT (id) DO UPDATE
SET 
    email = EXCLUDED.email,
    last_sign_in_at = EXCLUDED.last_sign_in_at,
    user_metadata = EXCLUDED.user_metadata,
    updated_at = NOW();
