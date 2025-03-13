-- Drop existing policies for system_settings
DROP POLICY IF EXISTS "Allow admins to read settings" ON public.system_settings;
DROP POLICY IF EXISTS "Allow admins to modify settings" ON public.system_settings;
DROP POLICY IF EXISTS "Temporary allow all authenticated users to read settings" ON public.system_settings;

-- Create updated policies for system_settings
CREATE POLICY "Allow admins to read settings" 
  ON public.system_settings 
  FOR SELECT 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->'roles' ? 'admin'
    )
  );

CREATE POLICY "Allow admins to modify settings" 
  ON public.system_settings 
  FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->'roles' ? 'admin'
    )
  );

-- Temporary policy for debugging - allows all authenticated users to read settings
CREATE POLICY "Temporary allow all authenticated users to read settings" 
  ON public.system_settings 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Drop existing policies for admin_logs
DROP POLICY IF EXISTS "Allow admins to read logs" ON public.admin_logs;
DROP POLICY IF EXISTS "Allow admins to insert logs" ON public.admin_logs;

-- Create updated policies for admin_logs
CREATE POLICY "Allow admins to read logs" 
  ON public.admin_logs 
  FOR SELECT 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->'roles' ? 'admin'
    )
  );

CREATE POLICY "Allow admins to insert logs" 
  ON public.admin_logs 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->'roles' ? 'admin'
    )
  );

-- Temporary policy for debugging - allows all authenticated users to read logs
CREATE POLICY "Temporary allow all authenticated users to read logs" 
  ON public.admin_logs 
  FOR SELECT 
  TO authenticated 
  USING (true);
