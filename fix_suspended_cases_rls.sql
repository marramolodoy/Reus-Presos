-- Migration to fix RLS and create table suspended_cases if it does not exist

-- 1. Create table suspended_cases if it doesn't exist
CREATE TABLE IF NOT EXISTS public.suspended_cases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    case_number TEXT,
    penal_type TEXT,
    suspension_date DATE,
    suspension_end_date DATE,
    prescription_date DATE,
    obs TEXT,
    user_id UUID,
    unit_id UUID REFERENCES public.units(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1.5 Add the column if the table already existed before this fix
ALTER TABLE public.suspended_cases ADD COLUMN IF NOT EXISTS suspension_end_date DATE;

-- 2. Enable RLS on suspended_cases
ALTER TABLE public.suspended_cases ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies to prevent conflicts
DO $$
BEGIN
    DROP POLICY IF EXISTS "Unit members can view suspended_cases" ON public.suspended_cases;
    DROP POLICY IF EXISTS "Unit members can insert suspended_cases" ON public.suspended_cases;
    DROP POLICY IF EXISTS "Unit members can update suspended_cases" ON public.suspended_cases;
    DROP POLICY IF EXISTS "Unit members can delete suspended_cases" ON public.suspended_cases;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 4. Create proper policies using the has_access_to_unit function
CREATE POLICY "Unit members can view suspended_cases" ON public.suspended_cases
    FOR SELECT USING ( public.has_access_to_unit(unit_id) );

CREATE POLICY "Unit members can insert suspended_cases" ON public.suspended_cases
    FOR INSERT WITH CHECK ( public.has_access_to_unit(unit_id) );

CREATE POLICY "Unit members can update suspended_cases" ON public.suspended_cases
    FOR UPDATE USING ( public.has_access_to_unit(unit_id) );

CREATE POLICY "Unit members can delete suspended_cases" ON public.suspended_cases
    FOR DELETE USING ( public.has_access_to_unit(unit_id) );

-- 5. Add trigger for auto-assign unit_id
DROP TRIGGER IF EXISTS set_unit_id_trigger_suspended_cases ON public.suspended_cases;
CREATE TRIGGER set_unit_id_trigger_suspended_cases
    BEFORE INSERT ON public.suspended_cases
    FOR EACH ROW EXECUTE FUNCTION public.set_unit_id();

-- 6. Add policy to allow all users/superadmins to view without unit constraint if it fails (fallback)
-- Note: the function public.has_access_to_unit(unit_id) handles super_admin access too.
