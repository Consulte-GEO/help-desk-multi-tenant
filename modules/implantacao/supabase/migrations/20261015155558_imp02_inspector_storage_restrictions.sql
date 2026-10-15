-- Dedicated inspector boundary across ALL Storage buckets. This migration adds
-- restrictive policies only: it grants no access and preserves legacy policies.
-- A flagged authenticated identity may read setup-import-artifacts only and may
-- never write objects or bucket metadata, even if a permissive policy allows it.
BEGIN;

CREATE POLICY setup_import_inspector_objects_select_fence
 ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
 USING (COALESCE(auth.jwt()->'app_metadata'->>'setup_import_inspector','false')<>'true'
  OR bucket_id='setup-import-artifacts');

CREATE POLICY setup_import_inspector_objects_insert_fence
 ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK (COALESCE(auth.jwt()->'app_metadata'->>'setup_import_inspector','false')<>'true');

CREATE POLICY setup_import_inspector_objects_update_fence
 ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
 USING (COALESCE(auth.jwt()->'app_metadata'->>'setup_import_inspector','false')<>'true')
 WITH CHECK (COALESCE(auth.jwt()->'app_metadata'->>'setup_import_inspector','false')<>'true');

CREATE POLICY setup_import_inspector_objects_delete_fence
 ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
 USING (COALESCE(auth.jwt()->'app_metadata'->>'setup_import_inspector','false')<>'true');

CREATE POLICY setup_import_inspector_buckets_select_fence
 ON storage.buckets AS RESTRICTIVE FOR SELECT TO authenticated
 USING (COALESCE(auth.jwt()->'app_metadata'->>'setup_import_inspector','false')<>'true'
  OR id='setup-import-artifacts');

CREATE POLICY setup_import_inspector_buckets_insert_fence
 ON storage.buckets AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK (COALESCE(auth.jwt()->'app_metadata'->>'setup_import_inspector','false')<>'true');

CREATE POLICY setup_import_inspector_buckets_update_fence
 ON storage.buckets AS RESTRICTIVE FOR UPDATE TO authenticated
 USING (COALESCE(auth.jwt()->'app_metadata'->>'setup_import_inspector','false')<>'true')
 WITH CHECK (COALESCE(auth.jwt()->'app_metadata'->>'setup_import_inspector','false')<>'true');

CREATE POLICY setup_import_inspector_buckets_delete_fence
 ON storage.buckets AS RESTRICTIVE FOR DELETE TO authenticated
 USING (COALESCE(auth.jwt()->'app_metadata'->>'setup_import_inspector','false')<>'true');

COMMIT;

-- Existing permissive SELECT on the dedicated private bucket is still required.
-- Non-inspector identities evaluate each fence to true: their existing grants,
-- RLS and application behavior remain authoritative. Never use user_metadata.
-- Requires RLS enabled, as Supabase Storage configures it on these two tables.
