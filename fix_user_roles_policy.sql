-- ==========================================
-- FIX: User Roles Visibility
-- Problem: Super Admin policy relies on reading the table, but users (even Super Admins) 
-- cannot read their own row to establish their role due to recursion/missing base policy.
-- ==========================================

-- 1. Allow users to view their own role (Base Bootstrap Policy)
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
CREATE POLICY "Users can view own role" ON public.user_roles
FOR SELECT USING (
    user_id = auth.uid()
);

-- 2. Ensure has_access_to_unit works correctly (Double Check)
-- The function is SECURITY DEFINER, so it shouldn't be affected by RLS on user_roles, 
-- but we recreate it just in case to ensure it uses the latest schema snapshot.
CREATE OR REPLACE FUNCTION public.has_access_to_unit(record_unit_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() 
    AND (
        unit_id = record_unit_id 
        OR role = 'super_admin'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
