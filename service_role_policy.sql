-- Add a policy to allow service role to access all users
CREATE POLICY "Service role can access all users"
ON public.users
FOR ALL
USING (true)
WITH CHECK (true);

-- This is a simpler alternative to the above if you prefer
-- ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
