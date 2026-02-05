-- Migration: fix_team_visibility
-- Purpose: Allow team members within the same unit (Comarca) to view and update each other's records.

-- 1. Update Policies for Civil Cases
DROP POLICY IF EXISTS "Users can view their own civil cases" ON civil_cases;
DROP POLICY IF EXISTS "Enable read access for own data" ON civil_cases;
DROP POLICY IF EXISTS "Team members can view civil cases of same unit" ON civil_cases;

CREATE POLICY "Team members can view civil cases of same unit"
ON civil_cases FOR SELECT
USING (
  auth.uid() = user_id -- Owner
  OR
  EXISTS ( -- Same Unit Team Member
    SELECT 1
    FROM user_roles requester_role
    JOIN user_roles owner_role ON requester_role.unit = owner_role.unit
    WHERE requester_role.user_id = auth.uid()
    AND owner_role.user_id = civil_cases.user_id
  )
);

DROP POLICY IF EXISTS "Users can update their own civil cases" ON civil_cases;
DROP POLICY IF EXISTS "Team members can update civil cases of same unit" ON civil_cases;

CREATE POLICY "Team members can update civil cases of same unit"
ON civil_cases FOR UPDATE
USING (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1
    FROM user_roles requester_role
    JOIN user_roles owner_role ON requester_role.unit = owner_role.unit
    WHERE requester_role.user_id = auth.uid()
    AND owner_role.user_id = civil_cases.user_id
  )
);

-- 2. Update Policies for Lawyer Requests
DROP POLICY IF EXISTS "Users can view their own lawyer requests" ON lawyer_requests;
DROP POLICY IF EXISTS "Enable read access for own data" ON lawyer_requests;
DROP POLICY IF EXISTS "Team members can view lawyer requests of same unit" ON lawyer_requests;

CREATE POLICY "Team members can view lawyer requests of same unit"
ON lawyer_requests FOR SELECT
USING (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1
    FROM user_roles requester_role
    JOIN user_roles owner_role ON requester_role.unit = owner_role.unit
    WHERE requester_role.user_id = auth.uid()
    AND owner_role.user_id = lawyer_requests.user_id
  )
);

DROP POLICY IF EXISTS "Users can update their own lawyer requests" ON lawyer_requests;
DROP POLICY IF EXISTS "Team members can update lawyer requests of same unit" ON lawyer_requests;

CREATE POLICY "Team members can update lawyer requests of same unit"
ON lawyer_requests FOR UPDATE
USING (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1
    FROM user_roles requester_role
    JOIN user_roles owner_role ON requester_role.unit = owner_role.unit
    WHERE requester_role.user_id = auth.uid()
    AND owner_role.user_id = lawyer_requests.user_id
  )
);
