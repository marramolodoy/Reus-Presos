-- ==========================================
-- Productivity Module Migration
-- ==========================================

-- 1. Create table 'productivity_logs'
CREATE TABLE IF NOT EXISTS public.productivity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES public.units(id),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    process_numbers TEXT, -- Processes worked on
    activities TEXT, -- Tasks performed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete support
);

-- 2. Enable RLS
ALTER TABLE public.productivity_logs ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies (Unit-based access)
CREATE POLICY "Unit members can view productivity_logs" ON public.productivity_logs
FOR SELECT USING ( public.has_access_to_unit(unit_id) );

CREATE POLICY "Unit members can insert productivity_logs" ON public.productivity_logs
FOR INSERT WITH CHECK ( public.has_access_to_unit(unit_id) );

CREATE POLICY "Unit members can update productivity_logs" ON public.productivity_logs
FOR UPDATE USING ( public.has_access_to_unit(unit_id) );

CREATE POLICY "Unit members can delete productivity_logs" ON public.productivity_logs
FOR DELETE USING ( public.has_access_to_unit(unit_id) );

-- 4. Trigger for Auto-assign unit_id
DROP TRIGGER IF EXISTS set_unit_id_trigger ON public.productivity_logs;
CREATE TRIGGER set_unit_id_trigger
BEFORE INSERT ON public.productivity_logs
FOR EACH ROW EXECUTE FUNCTION public.set_unit_id();

-- 5. Grant access to authenticated users
GRANT ALL ON public.productivity_logs TO authenticated;
