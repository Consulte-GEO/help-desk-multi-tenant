import {SERVICE_FINAL_GUARD} from './consultegeo-service-membership.ts';
import {GUARD_REVISION_MANIFEST,restoreQualifiedGuard} from './consultegeo-guard-revision.ts';
/** Offline M05 recipe verification. No driver, SQL execution or automatic repair. */
import {createHash} from 'node:crypto';import {constants} from 'node:fs';import {lstat,open,realpath} from 'node:fs/promises';import {join} from 'node:path';import {loadMigrationBundle} from './migration-files.ts';
const digest=(s:string|Buffer)=>createHash('sha256').update(s).digest('hex');
const failure=()=>Error('Consulte GEO upgrade recipe or source is invalid. Nothing was executed or repaired.');
export const QUALIFIED_UPGRADE_COMPONENTS=Object.freeze([
 {file:'cg_resource_scope.sql',sha256:'6e95aaba83e9411e11addc7f734c9f28f0713b81f3756d666fe000efd7d3e3c7'},
 {file:'cg_resource_observation.sql',sha256:'b3fd7bddcdc352e738615c20eaa7377eaebe16985f262ddf7e08fab8682c1fe3'},
 {file:'cg_resource_publication.sql',sha256:'09d610deec654d5c9d52d2e08f35d85728fb78ba7dd6a7e045d77132c028593c'},
 {file:'hdn_execution_checklist.sql',sha256:'7b7baab705549e0b706fbd1aaf76cb80558e68a53784718cf7029f1f62ec77bd'},
 {file:'hdn_support_workflow.sql',sha256:'35b92d19ece3b94653f442d3396e735ec1fe391d97be4661992043ed29684979'},
 {file:'hdn_consultegeo_configuration.sql',sha256:'b6080ff019fb80b795a81f9b4e303856a290f0117a6f38d253b12784e72a5dcd'}
].map(x=>Object.freeze(x)));
export const UPGRADE_BASELINE=Object.freeze([
 {file:'20260915000100_restrict_existing_definer.sql',sha256:'b98618ba0c23b1f126119e159324ad4576358798d8fb6e6fb09553ffdc7f3607'},
 {file:'20260915000200_helpdesk_foundation.sql',sha256:'ede5ab9756781e396e0065c0124f5bf1c698ea53fc72aef067582221b65b7ccc'},
 {file:'20260915000300_m1_authorization.sql',sha256:'aee3c4a82c791c0519719884e2e0ad0fe15f7fbff4afe0e9f552559959ae279c'},
 {file:'20260915000400_m1_resource_limits.sql',sha256:'3448a0c925bac1477183b01858180c12bce44dd4999f23122db0bae2c2185f11'},
 {file:'20260916000500_m1_session_lifecycle.sql',sha256:'cc862fb5f5259344be73c606a94b816a5dd964915a2a7397fbdd3003c27f0a32'},
 {file:'20260916000600_support_catalog.sql',sha256:'f5c30d4fce3c7671c4b946704e57bbd0139c10936e93e48dcbc77b2c214cb979'},
 {file:'20260916000700_ticket_priority.sql',sha256:'4d8065d139c66d7256d555cac0c56a32d1a0ee027d6471bbcddcbb77399cf637'},
 {file:'20260916000800_ticket_assignment.sql',sha256:'a5bd483ab2be0dc3076c338ce8a785ddb2861600bf9e784341cab4c3773eb348'},
 {file:'20260917000900_human_scope_versions.sql',sha256:'016562a019a745b8e8953aa32a232fda8b06163b02cb9ca5c40a5536fff064cd'},
 {file:'20260917001000_transaction_effects.sql',sha256:'8672037df0d7ae62593aefc865d82e6f7994d12a087f9ef40232d54b241a0d9c'},
 {file:'20260917001100_conversation_lock.sql',sha256:'14191c072a5d101ab644eeaa0dfc6cbed61dfa25a9eaaf92870ea5b413337166'},
 {file:'20261007001200_workspace_discovery.sql',sha256:'9e080628937d47ff23d27a1169e67c9464ec694522c0f4ad1337e901575fa21d'}
].map(x=>Object.freeze(x)));
const base={commit:'392fdd2bf3b9bafdd574dce5df66483e13127c0a',sourceSha256:'8e6c91705a7d79350247d3c550f2aabe01816c0f9a9f28778ad5e6c4ab597320'};
const generatedBy={tool:'Supabase CLI',version:'2.120.0',command:'supabase migration new consultegeo_m05_upgrade'};
const prelude=`-- Consulte GEO M05: transactional promotion of qualified M04 source.
-- Run only as the reviewed migration operator. No business seeds or gate activation.
BEGIN;
SET LOCAL statement_timeout='120s';
SET LOCAL lock_timeout='10s';
SET LOCAL idle_in_transaction_session_timeout='30s';
DO $m05$
DECLARE who oid:=current_user::regrole;name text;role_row record;relation record;
BEGIN
 IF current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999 OR current_user<>session_user
  OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE oid=who AND (rolsuper OR rolbypassrls) AND rolcreaterole)
  OR (SELECT count(*) FROM pg_namespace WHERE nspname IN ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit') AND nspowner=who)<>4
  OR to_regprocedure('helpdesk_auth.schema_version()') IS NULL THEN RAISE EXCEPTION 'Reviewed migration operator required' USING ERRCODE='HDU01';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('Consulte GEO schema upgrade',0));
 IF helpdesk_auth.schema_version() IS DISTINCT FROM '0.19.0' THEN RAISE EXCEPTION 'Exact prior schema required' USING ERRCODE='HDU02';END IF;
 -- Owner defaults can grant new objects even when existing service rights are empty.
 -- Qualified bodies explicitly revoke built-in PUBLIC function EXECUTE. No other
 -- non-owner automatic grant is adopted, globally or in these private schemas.
 IF EXISTS(SELECT 1 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
  WHERE d.defaclrole=who AND (d.defaclnamespace=0 OR d.defaclnamespace IN (SELECT oid FROM pg_namespace WHERE nspname IN ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit')))
   AND a.grantee<>who AND NOT (a.grantee=0 AND d.defaclobjtype='f' AND a.privilege_type='EXECUTE'))
 THEN RAISE EXCEPTION 'Incompatible operator defaults refused' USING ERRCODE='HDU05';END IF;
 IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit') AND c.relkind='r')<>25
  OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname LIKE 'helpdesk_%' AND c.relname ~ '^(cg_|hdn_)')
  OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname LIKE 'helpdesk_%' AND p.proname ~ '^(cg_|hdn_)') THEN RAISE EXCEPTION 'Partial or incompatible installation refused' USING ERRCODE='HDU03';END IF;
 FOR relation IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit') AND c.relkind='r' ORDER BY n.nspname,c.relname LOOP
  EXECUTE format('LOCK TABLE %I.%I IN ACCESS EXCLUSIVE MODE',relation.nspname,relation.relname);
 END LOOP;
 FOREACH name IN ARRAY ARRAY['helpdesk_resource_publisher','helpdesk_notification_worker'] LOOP
  SELECT * INTO role_row FROM pg_roles WHERE rolname=name;
  IF FOUND THEN
   IF role_row.rolsuper OR role_row.rolbypassrls OR role_row.rolcreaterole OR role_row.rolcreatedb OR role_row.rolreplication OR role_row.rolinherit
    OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=role_row.oid OR roleid=role_row.oid)
    OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname LIKE 'helpdesk_%' AND nspowner=role_row.oid)
    OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname LIKE 'helpdesk_%' AND c.relowner=role_row.oid)
    OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname LIKE 'helpdesk_%' AND p.proowner=role_row.oid)
    OR EXISTS(SELECT 1 FROM pg_namespace n WHERE n.nspname LIKE 'helpdesk_%' AND (has_schema_privilege(role_row.oid,n.oid,'CREATE,USAGE WITH GRANT OPTION') OR has_schema_privilege(role_row.oid,n.oid,'USAGE') AND (name<>'helpdesk_resource_publisher' OR n.nspname<>'helpdesk_auth')))
    OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname LIKE 'helpdesk_%' AND c.relkind='r' AND (has_table_privilege(role_row.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') OR has_any_column_privilege(role_row.oid,c.oid,'SELECT,INSERT,UPDATE,REFERENCES')))
    OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname LIKE 'helpdesk_%' AND has_function_privilege(role_row.oid,p.oid,'EXECUTE'))
   THEN RAISE EXCEPTION 'Existing service role is unsafe' USING ERRCODE='HDU04';END IF;
  ELSE EXECUTE format('CREATE ROLE %I NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS',name);END IF;
 END LOOP;
END $m05$;
`;
const epilogue=`
-- Reserved delivery worker: no request, maintenance or publisher permissions.
DO $m05_worker$ DECLARE ns text;BEGIN
 FOREACH ns IN ARRAY ARRAY['helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit'] LOOP
  EXECUTE format('REVOKE ALL ON SCHEMA %I FROM helpdesk_notification_worker',ns);
  EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM helpdesk_notification_worker',ns);
  EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA %I FROM helpdesk_notification_worker',ns);
  EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA %I FROM helpdesk_notification_worker',ns);
 END LOOP;
END $m05_worker$;
-- Validate EFFECTIVE service boundaries before publishing the schema marker.
${SERVICE_FINAL_GUARD}
CREATE OR REPLACE FUNCTION helpdesk_auth.schema_version() RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$SELECT '0.20.0'::text$$;
COMMIT;
`;
export function compileConsulteGeoUpgrade(components:readonly {file:string;sha256:string;sql:string}[]):string{try{
 if(!Array.isArray(components)||components.length!==6||Reflect.ownKeys(components).length!==7)throw failure();
 const bodies=components.map((c,i)=>{const qualified=QUALIFIED_UPGRADE_COMPONENTS[i]!;if(!c||c.file!==qualified.file||c.sha256!==qualified.sha256||typeof c.sql!=='string'||Buffer.byteLength(c.sql)>2*1024*1024||digest(c.sql)!==qualified.sha256)throw failure();
  const guard=/\bDO\s+\$(candidate|guard)\$[\s\S]*?END\s+\$\1\$;/i.exec(c.sql);if(!guard||c.sql.slice(0,guard.index).split('\n').some((line:string)=>line.trim()&&!line.trim().startsWith('--')))throw failure();
  const body=c.sql.slice(guard.index+guard[0].length).trim();if(!body)throw failure();return '-- SOURCE '+qualified.file+' SHA256 '+qualified.sha256+'\n'+body+'\n';
 });return prelude+'\n'+bodies.join('\n')+epilogue;
}catch{throw failure();}}
function exact(x:unknown,keys:readonly string[]):x is Record<string,unknown>{return !!x&&typeof x==='object'&&!Array.isArray(x)&&Reflect.ownKeys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));}
async function regular(path:string,max:number){const s=await lstat(path);if(!s.isFile()||s.isSymbolicLink()||s.size>max)throw failure();const h=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);try{const a=await h.stat();if(!a.isFile()||a.size>max)throw failure();const buffer=Buffer.alloc(max+1),{bytesRead}=await h.read(buffer,0,max+1,0);if(bytesRead>max)throw failure();return new TextDecoder('utf-8',{fatal:true}).decode(buffer.subarray(0,bytesRead));}finally{await h.close();}}
export async function verifyConsulteGeoUpgrade(root:string):Promise<{schemaVersion:string;file:string;sha256:string}>{try{
 const path=await realpath(root),bundle=await loadMigrationBundle(path),raw:unknown=JSON.parse(await regular(join(path,'supabase/consultegeo-upgrade.manifest.json'),65536));
 if(!exact(raw,['format','product','baseSchema','targetSchema','file','sha256','generatedBy','qualifiedBase','components','baseline','guardRevision'])||raw.format!==1||raw.product!=='CONSULTE_GEO'||raw.baseSchema!=='0.19.0'||raw.targetSchema!=='0.20.0'||!((bundle.schemaVersion==='0.20.0'&&bundle.migrations.length===13)||(bundle.schemaVersion==='0.21.0'&&bundle.migrations.length===14)||(bundle.schemaVersion==='0.22.0'&&bundle.migrations.length===15)||(bundle.schemaVersion==='0.23.0'&&bundle.migrations.length===16)||(bundle.schemaVersion==='0.24.0'&&bundle.migrations.length===17)||(bundle.schemaVersion==='0.25.0'&&(bundle.migrations.length===18||bundle.migrations.length===19)))
  ||JSON.stringify(raw.generatedBy)!==JSON.stringify(generatedBy)||JSON.stringify(raw.qualifiedBase)!==JSON.stringify(base)||JSON.stringify(raw.components)!==JSON.stringify(QUALIFIED_UPGRADE_COMPONENTS)||JSON.stringify(raw.baseline)!==JSON.stringify(UPGRADE_BASELINE)
  ||JSON.stringify(bundle.migrations.slice(0,12).map(({file,sha256})=>({file,sha256})))!==JSON.stringify(UPGRADE_BASELINE))throw failure();
 if(raw.guardRevision!==GUARD_REVISION_MANIFEST.revision||JSON.stringify(JSON.parse(await regular(join(path,'supabase/consultegeo-guard-revision.manifest.json'),65536)))!==JSON.stringify(GUARD_REVISION_MANIFEST))throw failure();
 for(const [index,migration] of bundle.migrations.slice(12,16).entries()){
  if(migration.file!==GUARD_REVISION_MANIFEST.migrations[index]?.file)throw failure();
  restoreQualifiedGuard(migration.file,migration.sql);
 }
 const migration=bundle.migrations[12]!;if(raw.file!==migration.file||!/^\d{14}_consultegeo_m05_upgrade\.sql$/.test(migration.file)||raw.sha256!==migration.sha256)throw failure();
 const components=await Promise.all(QUALIFIED_UPGRADE_COMPONENTS.map(async c=>({...c,sql:await regular(join(path,'supabase/candidates',c.file),2*1024*1024)})));
 if(compileConsulteGeoUpgrade(components)!==migration.sql)throw failure();
 if(bundle.schemaVersion==='0.24.0'||bundle.schemaVersion==='0.25.0'){const {verifyConsulteGeoActivation}=await import('./consultegeo-activation-upgrade.ts');await verifyConsulteGeoActivation(path);}
 if(bundle.schemaVersion==='0.25.0'){const {verifyConsulteGeoEmailWave2}=await import('./consultegeo-email-wave2-upgrade.ts');await verifyConsulteGeoEmailWave2(path);}
 return {schemaVersion:raw.targetSchema as string,file:migration.file,sha256:migration.sha256};
}catch{throw failure();}}
