ALTER TABLE websites
  ALTER COLUMN user_id TYPE uuid USING user_id::uuid;

ALTER TABLE websites
  ADD CONSTRAINT fk_user
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;