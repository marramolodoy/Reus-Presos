-- ==========================================
-- Migration V2.1: Sticky Notes Support
-- ==========================================

-- 1. Add 'unit_id' to 'sticky_notes'
ALTER TABLE public.sticky_notes ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.units(id);

-- 2. Backfill 'unit_id'
UPDATE public.sticky_notes t
SET unit_id = ur.unit_id
FROM public.user_roles ur
WHERE t.user_id = ur.user_id AND t.unit_id IS NULL;

-- 3. Update RLS Policies for Sticky Notes
ALTER TABLE public.sticky_notes ENABLE ROW LEVEL SECURITY;

-- Remove old policies (if any)
DROP POLICY IF EXISTS "Users can view sticky notes of same unit" ON public.sticky_notes;
DROP POLICY IF EXISTS "Unit members can view sticky_notes" ON public.sticky_notes;

-- Create new policies using common function
CREATE POLICY "Unit members can view sticky_notes" ON public.sticky_notes
FOR SELECT USING ( public.has_access_to_unit(unit_id) );

CREATE POLICY "Unit members can insert sticky_notes" ON public.sticky_notes
FOR INSERT WITH CHECK ( public.has_access_to_unit(unit_id) );

CREATE POLICY "Unit members can update sticky_notes" ON public.sticky_notes
FOR UPDATE USING ( public.has_access_to_unit(unit_id) );

CREATE POLICY "Unit members can delete sticky_notes" ON public.sticky_notes
FOR DELETE USING ( public.has_access_to_unit(unit_id) );

-- 4. Trigger for Auto-assign (reuse existing function)
DROP TRIGGER IF EXISTS set_unit_id_trigger ON public.sticky_notes;
CREATE TRIGGER set_unit_id_trigger
BEFORE INSERT ON public.sticky_notes
FOR EACH ROW EXECUTE FUNCTION public.set_unit_id();
