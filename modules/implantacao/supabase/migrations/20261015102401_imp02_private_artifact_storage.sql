-- Prepared SQL only. Apply through the operator's official migration workflow.
-- Requires IMP02 production tables + setup_import.access_grants first.
-- Separate bucket: never reuse exports or public step-help-images.
BEGIN;
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('setup-import-artifacts','setup-import-artifacts',false,62914560,
 ARRAY['application/pdf','image/png','image/jpeg','application/vnd.ms-excel',
 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
ON CONFLICT (id) DO NOTHING;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='setup-import-artifacts'
   AND public=false AND file_size_limit=62914560) THEN
  RAISE EXCEPTION 'IMPORT_BUCKET_CONFIGURATION_MISMATCH';
 END IF;
END $$;

-- Narrow private lookup is intentionally SECURITY DEFINER: authenticated must
-- never receive SELECT on private case rows or grants just to request an upload.
-- Inputs only select an already registered pending artifact; identity comes from
-- verified Supabase auth.uid(), never body, path requester or user_metadata.
CREATE OR REPLACE FUNCTION setup_import.can_upload_artifact(object_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $fn$
 SELECT auth.uid() IS NOT NULL AND EXISTS (
  SELECT 1 FROM setup_import.artifacts a
  JOIN setup_import.cases c USING (workspace_id,account_id,case_id)
  JOIN setup_import.access_grants g ON g.workspace_id=c.workspace_id
   AND g.account_id=c.account_id AND g.actor_id=auth.uid()
   AND g.requester_id::text=c.body->>'requesterId'
   AND g.work_ref IS NOT DISTINCT FROM c.body->>'workRef'
  LEFT JOIN public.projects p ON p.id=g.project_id
  WHERE a.body->>'objectKey'=object_name
   AND object_name=a.workspace_id::text||'/'||a.account_id::text||'/'||a.case_id::text||'/'||a.artifact_id::text
   AND a.status='pending' AND c.body->>'status'='draft'
   AND g.revoked_at IS NULL AND (g.expires_at IS NULL OR g.expires_at>now())
   AND (g.role='requester' AND g.actor_id=g.requester_id OR
     g.role='support' AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id=auth.uid()
       AND COALESCE(u.raw_app_meta_data->>'is_admin','false')='true'))
   AND (g.project_id IS NULL OR (p.is_active AND (p.created_by=auth.uid()
     OR EXISTS (SELECT 1 FROM public.project_members m WHERE m.project_id=p.id AND m.user_id=auth.uid())
     OR (g.role='support' AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id=auth.uid()
       AND COALESCE(u.raw_app_meta_data->>'is_admin','false')='true')))))
   AND COALESCE(auth.jwt()->'app_metadata'->>'setup_import_inspector','false')<>'true'
 );
$fn$;
REVOKE ALL ON FUNCTION setup_import.can_upload_artifact(text) FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA setup_import TO authenticated;
GRANT EXECUTE ON FUNCTION setup_import.can_upload_artifact(text) TO authenticated;

CREATE POLICY setup_import_artifact_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK (bucket_id='setup-import-artifacts' AND setup_import.can_upload_artifact(name));
-- Only administrator-provisioned Auth app_metadata may mark an inspector.
-- Normal requester/support identities receive no SELECT, UPDATE or DELETE here.
CREATE POLICY setup_import_inspector_read ON storage.objects FOR SELECT TO authenticated
 USING (bucket_id='setup-import-artifacts'
  AND COALESCE(auth.jwt()->'app_metadata'->>'setup_import_inspector','false')='true');
CREATE POLICY setup_import_inspector_bucket_read ON storage.buckets FOR SELECT TO authenticated
 USING (id='setup-import-artifacts'
  AND COALESCE(auth.jwt()->'app_metadata'->>'setup_import_inspector','false')='true');
COMMIT;

-- Before production: inspect ALL existing storage.objects/buckets policies.
-- Policies combine with OR: a preexisting broad policy can defeat the private ACL.
-- Test anon, ordinary requester, other tenant, revoked grant and inspector tokens.
-- Signed URLs are 2h bearer capabilities; issuance checks live ACL but cannot
-- revoke an already issued capability immediately. No UPDATE/DELETE policy and
-- signed upsert=false preserve an existing object against replacement.
