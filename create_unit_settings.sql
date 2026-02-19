-- Create unit_settings table
CREATE TABLE IF NOT EXISTS public.unit_settings (
    unit TEXT PRIMARY KEY,
    court_name TEXT,
    app_title TEXT,
    app_subtitle TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.unit_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Allow read access to users in the same unit
CREATE POLICY "Users can view settings of their unit"
ON public.unit_settings
FOR SELECT
USING (
    unit IN (
        SELECT unit FROM public.user_roles WHERE user_id = auth.uid()
    )
);

-- Policy: Allow insert/update access to admins in the same unit
-- Note: usage involves upsert, so we need INSERT and UPDATE policies
CREATE POLICY "Admins can update settings of their unit"
ON public.unit_settings
FOR UPDATE
USING (
    unit IN (
        SELECT unit FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
    )
)
WITH CHECK (
    unit IN (
        SELECT unit FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
    )
);

CREATE POLICY "Admins can insert settings for their unit"
ON public.unit_settings
FOR INSERT
WITH CHECK (
    unit IN (
        SELECT unit FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.unit_settings TO authenticated;
