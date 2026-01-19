-- Add new columns to civil_cases table for status tracking and responsible server
ALTER TABLE civil_cases
ADD COLUMN IF NOT EXISTS is_concluded BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS concluded_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS responsible_server TEXT;

-- Create index for performance on status queries if needed
CREATE INDEX IF NOT EXISTS idx_civil_cases_is_concluded ON civil_cases(is_concluded);
