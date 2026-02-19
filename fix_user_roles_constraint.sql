-- Drop legacy constraint on user_roles
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_unit_check;

-- Optional: Drop the legacy unit column if it's no longer needed
-- (Checking if we can safely drop it, or just make it nullable first)
-- For now, let's just drop the constraint to fix the error.

-- Make unit nullable just in case
ALTER TABLE public.user_roles ALTER COLUMN unit DROP NOT NULL;
