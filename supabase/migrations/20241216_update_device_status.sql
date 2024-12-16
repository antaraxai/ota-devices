-- First, modify the enum type to include new values
ALTER TYPE device_status ADD VALUE 'online' AFTER 'Normal';
ALTER TYPE device_status ADD VALUE 'offline' AFTER 'online';
