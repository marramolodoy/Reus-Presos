
-- 1. Drop the recursive policy
DROP POLICY IF EXISTS "Admins can view their unit roles" ON public.user_roles;

-- 2. Drop the overly permissive debug policy (if it exists)
DROP POLICY IF EXISTS "Enable read access for all users" ON public.user_roles;

-- 3. Create a secure function to look up the current user's unit
-- SAFETY: SECURITY DEFINER allows this function to read user_roles without triggering the RLS loop
CREATE OR REPLACE FUNCTION public.get_my_unit_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT unit_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 4. Re-create the Admin policy using the secure function
-- This allows any user to see roles within their own unit 
-- (effectively allowing Admins to manage their unit, and users to see teammates)
CREATE POLICY "Unit members can view their unit roles" ON public.user_roles
FOR SELECT USING (
  unit_id = public.get_my_unit_id()
);
