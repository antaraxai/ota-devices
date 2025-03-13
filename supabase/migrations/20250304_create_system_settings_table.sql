-- Create system_settings table for storing global application configuration
CREATE TABLE IF NOT EXISTS public.system_settings (
  id SERIAL PRIMARY KEY,
  site_name TEXT NOT NULL DEFAULT 'Antara',
  contact_email TEXT NOT NULL DEFAULT 'contact@antara.com',
  support_email TEXT NOT NULL DEFAULT 'support@antara.com',
  allow_new_registrations BOOLEAN NOT NULL DEFAULT true,
  maintenance_mode BOOLEAN NOT NULL DEFAULT false,
  default_user_role TEXT NOT NULL DEFAULT 'user',
  default_plan TEXT NOT NULL DEFAULT 'free',
  max_devices_free INTEGER NOT NULL DEFAULT 5,
  max_devices_pro INTEGER NOT NULL DEFAULT 50,
  stripe_test_mode BOOLEAN NOT NULL DEFAULT true,
  notification_frequency TEXT NOT NULL DEFAULT 'daily',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add RLS policies
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users with admin role to read settings
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

-- Create policy to allow authenticated users with admin role to insert/update settings
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

-- Insert default settings if table is empty
INSERT INTO public.system_settings (
  site_name, 
  contact_email, 
  support_email, 
  allow_new_registrations, 
  maintenance_mode, 
  default_user_role, 
  default_plan, 
  max_devices_free, 
  max_devices_pro, 
  stripe_test_mode, 
  notification_frequency
)
SELECT 
  'Antara', 
  'contact@antara.com', 
  'support@antara.com', 
  true, 
  false, 
  'user', 
  'free', 
  5, 
  50, 
  true, 
  'daily'
WHERE NOT EXISTS (SELECT 1 FROM public.system_settings LIMIT 1);

-- Add comment to table
COMMENT ON TABLE public.system_settings IS 'Stores global system configuration settings';
