-- Migration: fix_user_profiles_rls
-- Purpose: Allow Admins to update user_profiles of members in their unit.

DROP POLICY IF EXISTS "Usuários podem atualizar seu próprio perfil" ON user_profiles;
DROP POLICY IF EXISTS "Usuários podem inserir seu próprio perfil" ON user_profiles;

-- Allow INSERT/UPDATE if:
-- 1. It's the user themselves (auth.uid() = user_id)
-- 2. OR the requester is an admin of the same unit as the target user
CREATE POLICY "Users and Admins can update profiles" ON user_profiles FOR UPDATE
USING (
  auth.uid() = user_id OR
  (
    get_my_role() = 'admin' AND
    EXISTS (
      SELECT 1 
      FROM user_roles requester
      JOIN user_roles target ON requester.unit = target.unit
      WHERE requester.user_id = auth.uid()
      AND target.user_id = user_profiles.user_id
    )
  )
);

CREATE POLICY "Users and Admins can insert profiles" ON user_profiles FOR INSERT
WITH CHECK (
  auth.uid() = user_id OR
  (
    get_my_role() = 'admin' AND
    EXISTS (
      SELECT 1 
      FROM user_roles requester
      JOIN user_roles target ON requester.unit = target.unit
      WHERE requester.user_id = auth.uid()
      AND target.user_id = user_profiles.user_id
    )
  )
);
