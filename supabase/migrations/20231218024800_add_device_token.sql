-- Add device_token column to devices table
ALTER TABLE devices ADD COLUMN IF NOT EXISTS device_token TEXT;

-- Add comment for the device_token column
COMMENT ON COLUMN devices.device_token IS 'Token used for device authentication';
