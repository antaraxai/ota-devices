-- Add last_checked column to websites table
ALTER TABLE websites
ADD COLUMN last_checked TIMESTAMP WITH TIME ZONE;

-- Update existing rows to have a default value
UPDATE websites
SET last_checked = created_at;

-- Make the column not null with default value
ALTER TABLE websites
ALTER COLUMN last_checked SET NOT NULL,
ALTER COLUMN last_checked SET DEFAULT CURRENT_TIMESTAMP;