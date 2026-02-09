-- Fix RLS Policies for civil_cases
-- Dropping old policies
DROP POLICY IF EXISTS "Users can manage their own civil cases" ON civil_cases;
DROP POLICY IF EXISTS "Unit Insert" ON civil_cases;
DROP POLICY IF EXISTS "Unit Update" ON civil_cases;
DROP POLICY IF EXISTS "Unit Delete" ON civil_cases;
DROP POLICY IF EXISTS "Unit Isolation Select" ON civil_cases;
DROP POLICY IF EXISTS "Team members can view civil cases of same unit" ON civil_cases;
DROP POLICY IF EXISTS "Team members can update civil cases of same unit" ON civil_cases;

-- Enabling RLS
ALTER TABLE civil_cases ENABLE ROW LEVEL SECURITY;

-- Creating new policies aligned with granular permissions

-- SELECT: Same unit AND view permission
CREATE POLICY "Unit Select" ON civil_cases
FOR SELECT
USING (
    check_same_unit(user_id) AND 
    has_permission(auth.uid(), 'civil', 'view')
);

-- INSERT: Same unit AND edit permission
CREATE POLICY "Unit Insert" ON civil_cases
FOR INSERT
WITH CHECK (
    check_same_unit(user_id) AND 
    has_permission(auth.uid(), 'civil', 'edit')
);

-- UPDATE: Same unit AND (edit OR admin permission)
CREATE POLICY "Unit Update" ON civil_cases
FOR UPDATE
USING (
    check_same_unit(user_id) AND (
        has_permission(auth.uid(), 'civil', 'edit') OR 
        has_permission(auth.uid(), 'civil', 'admin')
    )
);

-- DELETE: Same unit AND admin permission
CREATE POLICY "Unit Delete" ON civil_cases
FOR DELETE
USING (
    check_same_unit(user_id) AND 
    has_permission(auth.uid(), 'civil', 'admin')
);
