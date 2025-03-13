-- Create admin_logs table for tracking admin actions
CREATE TABLE IF NOT EXISTS public.admin_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action TEXT NOT NULL,
  details JSONB,
  performed_by TEXT NOT NULL,
  target_user_id TEXT,
  ip_address TEXT,
  timestamp TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add RLS policies
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users with admin role to read logs
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

-- Create policy to allow authenticated users with admin role to insert logs
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

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS admin_logs_timestamp_idx ON public.admin_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS admin_logs_performed_by_idx ON public.admin_logs (performed_by);
CREATE INDEX IF NOT EXISTS admin_logs_action_idx ON public.admin_logs (action);

-- Add comment to table
COMMENT ON TABLE public.admin_logs IS 'Stores admin action logs for audit purposes';
