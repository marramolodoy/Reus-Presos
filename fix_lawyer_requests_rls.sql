-- Migration: fix_lawyer_requests_rls
-- Purpose: Fix INSERT policy to allow team members to create requests for their unit (attributing to team owner).

DROP POLICY IF EXISTS "Unit Insert" ON lawyer_requests;
DROP POLICY IF EXISTS "Unit Update" ON lawyer_requests;
DROP POLICY IF EXISTS "Unit Delete" ON lawyer_requests;

-- Allow INSERT if the user is in a unit and the target user_id belongs to the same unit (e.g. team owner)
CREATE POLICY "Unit Insert" ON lawyer_requests FOR INSERT
WITH CHECK (
  get_my_unit() IS NOT NULL AND
  EXISTS (
    SELECT 1 
    FROM user_roles requester
    JOIN user_roles target ON requester.unit = target.unit
    WHERE requester.user_id = auth.uid()
    AND target.user_id = lawyer_requests.user_id
  )
);

-- Allow UPDATE if user is same unit as row owner
CREATE POLICY "Unit Update" ON lawyer_requests FOR UPDATE
USING (
  get_my_unit() IS NOT NULL AND
  EXISTS (
    SELECT 1 
    FROM user_roles requester
    JOIN user_roles target ON requester.unit = target.unit
    WHERE requester.user_id = auth.uid()
    AND target.user_id = lawyer_requests.user_id
  )
);

-- Allow DELETE (usually Restrict to Admin/Owner, but keeping consistent with update for now or checking role)
-- Assuming only Admin/Owner should delete?
CREATE POLICY "Unit Delete" ON lawyer_requests FOR DELETE
USING (
  get_my_unit() IS NOT NULL AND
  EXISTS (
    SELECT 1 
    FROM user_roles requester
    JOIN user_roles target ON requester.unit = target.unit
    WHERE requester.user_id = auth.uid()
    AND target.user_id = lawyer_requests.user_id
    AND (get_my_role() = 'admin' OR requester.user_id = lawyer_requests.user_id) -- Only admins or the owner themselves
  )
);
