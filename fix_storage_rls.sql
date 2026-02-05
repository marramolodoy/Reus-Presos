-- Migration: fix_storage_rls
-- Purpose: Allow team members within the same unit to manage files in each other's folders in the 'documents' bucket.

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;

-- 1. VIEW (Select)
CREATE POLICY "Team view files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    EXISTS (
      SELECT 1
      FROM user_roles requester
      JOIN user_roles owner ON requester.unit = owner.unit
      WHERE requester.user_id = auth.uid()
      AND owner.user_id::text = (storage.foldername(name))[1]
    )
  )
);

-- 2. UPLOAD (Insert)
CREATE POLICY "Team upload files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    EXISTS (
      SELECT 1
      FROM user_roles requester
      JOIN user_roles owner ON requester.unit = owner.unit
      WHERE requester.user_id = auth.uid()
      AND owner.user_id::text = (storage.foldername(name))[1]
    )
  )
);

-- 3. UPDATE
CREATE POLICY "Team update files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'documents'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    EXISTS (
      SELECT 1
      FROM user_roles requester
      JOIN user_roles owner ON requester.unit = owner.unit
      WHERE requester.user_id = auth.uid()
      AND owner.user_id::text = (storage.foldername(name))[1]
    )
  )
);

-- 4. DELETE
CREATE POLICY "Team delete files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    EXISTS (
      SELECT 1
      FROM user_roles requester
      JOIN user_roles owner ON requester.unit = owner.unit
      WHERE requester.user_id = auth.uid()
      AND owner.user_id::text = (storage.foldername(name))[1]
    )
  )
);
