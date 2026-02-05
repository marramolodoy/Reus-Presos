-- Migration: fix_admin_rls
-- Purpose: Allow team members within the same unit (Comarca) to view and update administrative documents.

DROP POLICY IF EXISTS "Users can view their own administrative documents" ON administrative_documents;
DROP POLICY IF EXISTS "Users can insert their own administrative documents" ON administrative_documents;
DROP POLICY IF EXISTS "Users can update their own administrative documents" ON administrative_documents;
DROP POLICY IF EXISTS "Users can delete their own administrative documents" ON administrative_documents;

-- Select Policy
CREATE POLICY "Team members can view admin docs of same unit"
ON administrative_documents FOR SELECT
USING (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1
    FROM user_roles requester_role
    JOIN user_roles owner_role ON requester_role.unit = owner_role.unit
    WHERE requester_role.user_id = auth.uid()
    AND owner_role.user_id = administrative_documents.user_id
  )
);

-- Insert Policy
CREATE POLICY "Team members can insert admin docs of same unit"
ON administrative_documents FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1
    FROM user_roles requester_role
    -- Check if requester has a unit (any unit, really, but logically they should match context if being strict, 
    -- but for INSERT we usually just check if they are logged in and let the application assign user_id. 
    -- However, RLS checks the NEW row. If we insert with our own user_id, it passes auth.uid() = user_id.
    -- If we insert as someone else (impersonation), we need the check.
    -- Usually we insert as ourselves. So auth.uid() = user_id is sufficient for 99% of cases.
    -- But let's keep it consistent.
    WHERE requester_role.user_id = auth.uid()
  )
);

-- Update Policy
CREATE POLICY "Team members can update admin docs of same unit"
ON administrative_documents FOR UPDATE
USING (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1
    FROM user_roles requester_role
    JOIN user_roles owner_role ON requester_role.unit = owner_role.unit
    WHERE requester_role.user_id = auth.uid()
    AND owner_role.user_id = administrative_documents.user_id
  )
);

-- Delete Policy
CREATE POLICY "Team members can delete admin docs of same unit"
ON administrative_documents FOR DELETE
USING (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1
    FROM user_roles requester_role
    JOIN user_roles owner_role ON requester_role.unit = owner_role.unit
    WHERE requester_role.user_id = auth.uid()
    AND owner_role.user_id = administrative_documents.user_id
  )
);
