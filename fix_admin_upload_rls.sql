-- =========================================================================
-- MIGRATION: fix_admin_upload_rls.sql
-- PURPOSE: Fix Database Error 42P17 (Infinite Recursion) during Admin Uploads
-- =========================================================================

-- We will replace the complex JOINs on user_roles with the secure 
-- get_my_unit_id() function which avoids recursion by being SECURITY DEFINER.

-- 1. FIX STORAGE POLICY (Uploads)
DROP POLICY IF EXISTS "Team upload files" ON storage.objects;

CREATE POLICY "Team upload files" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents' AND (
    (storage.foldername(name))[1] = auth.uid()::text OR
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id::text = (storage.foldername(name))[1] 
      AND unit_id = public.get_my_unit_id()
    )
  )
);

-- Note: SELECT, UPDATE, DELETE policies on storage.objects might also be 
-- causing 42P17 when simply viewing the file list, so let's fix them too just in case.
DROP POLICY IF EXISTS "Team view files" ON storage.objects;
CREATE POLICY "Team view files" ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents' AND (
    (storage.foldername(name))[1] = auth.uid()::text OR
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id::text = (storage.foldername(name))[1] 
      AND unit_id = public.get_my_unit_id()
    )
  )
);

DROP POLICY IF EXISTS "Team update files" ON storage.objects;
CREATE POLICY "Team update files" ON storage.objects FOR UPDATE
USING (
  bucket_id = 'documents' AND (
    (storage.foldername(name))[1] = auth.uid()::text OR
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id::text = (storage.foldername(name))[1] 
      AND unit_id = public.get_my_unit_id()
    )
  )
);

DROP POLICY IF EXISTS "Team delete files" ON storage.objects;
CREATE POLICY "Team delete files" ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents' AND (
    (storage.foldername(name))[1] = auth.uid()::text OR
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id::text = (storage.foldername(name))[1] 
      AND unit_id = public.get_my_unit_id()
    )
  )
);


-- 2. FIX ADMINISTRATIVE DOCUMENTS TABLE
-- Simplifying all policies to just use auth.uid() OR unit_id = get_my_unit_id()
DROP POLICY IF EXISTS "Team members can view admin docs of same unit" ON administrative_documents;
DROP POLICY IF EXISTS "Team members can insert admin docs of same unit" ON administrative_documents;
DROP POLICY IF EXISTS "Team members can update admin docs of same unit" ON administrative_documents;
DROP POLICY IF EXISTS "Team members can delete admin docs of same unit" ON administrative_documents;

CREATE POLICY "Team members can view admin docs of same unit"
ON administrative_documents FOR SELECT
USING (
  user_id = auth.uid() OR
  unit_id = public.get_my_unit_id()
);

CREATE POLICY "Team members can insert admin docs of same unit"
ON administrative_documents FOR INSERT
WITH CHECK (
  user_id = auth.uid() OR
  unit_id = public.get_my_unit_id()
);

CREATE POLICY "Team members can update admin docs of same unit"
ON administrative_documents FOR UPDATE
USING (
  user_id = auth.uid() OR
  unit_id = public.get_my_unit_id()
);

CREATE POLICY "Team members can delete admin docs of same unit"
ON administrative_documents FOR DELETE
USING (
  user_id = auth.uid() OR
  unit_id = public.get_my_unit_id()
);

-- End of File
