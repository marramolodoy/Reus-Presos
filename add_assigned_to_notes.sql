-- Migration to add assigned_to to sticky_notes

ALTER TABLE public.sticky_notes 
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id);

-- Optional: Add a comment or description
COMMENT ON COLUMN public.sticky_notes.assigned_to IS 'User ID of the team member assigned to this note';

-- Create a notification function (optional, but good for future)
-- For now, we relies on the frontend to create the notification record 
-- or we can use a trigger.
