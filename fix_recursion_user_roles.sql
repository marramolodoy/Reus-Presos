-- ==========================================
-- FIX: Recursion in user_roles RLS
-- Problem: The policy "Super Admins can view all roles" queries 'user_roles' directly.
-- Since it's not a SECURITY DEFINER function, it triggers RLS on 'user_roles' again -> Infinite Loop -> 500 Error.
-- ==========================================

-- 1. Create a SECURITY DEFINER function to check Role securely
-- This bypasses RLS on the table it queries.
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 
-- security definer is KEY here!

-- 2. Drop the recursive policies
DROP POLICY IF EXISTS "Super Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super Admins can update all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super Admins can delete all roles" ON public.user_roles;

-- 3. Re-create policies using the safe function
CREATE POLICY "Super Admins can view all roles" ON public.user_roles
FOR SELECT USING (
  public.is_super_admin() 
  OR 
  user_id = auth.uid() -- Ensure base case is covered (view own)
);

CREATE POLICY "Super Admins can update all roles" ON public.user_roles
FOR UPDATE USING (
  public.is_super_admin()
);

CREATE POLICY "Super Admins can delete all roles" ON public.user_roles
FOR DELETE USING (
  public.is_super_admin()
);
