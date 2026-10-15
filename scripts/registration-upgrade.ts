/** Offline, source-pinned promotion. No credential discovery, SQL execution or repair. */
import {createHash} from 'node:crypto';import {join} from 'node:path';
import {loadMigrationBundle} from './migration-files.ts';
import {readWave2Regular} from './consultegeo-email-wave2-upgrade.ts';
import {DATABASE_SECURITY_CONTRACT as BASE} from '../src/infrastructure/database-security-contract.ts';
import {REGISTRATION_SECURITY_CONTRACT as FINAL,REGISTRATION_SECURITY_QUERY} from '../src/infrastructure/registration-security-contract.ts';
import {DATABASE_SECURITY_QUERY,READINESS_FLAGS} from '../src/infrastructure/database-security.ts';
import {QUALIFIED_SCHEMA_OWNER_SQL,OWNER_DEFAULTS_OK_SQL} from './consultegeo-service-membership.ts';
export const REGISTRATION_MIGRATION='20261015150000_registration_storage_worker.sql';
export const REGISTRATION_BASELINE_SHA256='016430031e1bdb8a4e99c52d7c36a0a406b55c307e78d23fd315b350d80ccadc';
export const REGISTRATION_COMPONENTS=[
 {file:'hda02_analysis_persistence.sql',sha256:'35b25267037fc7fc194cc88e8ec7385628e0d222504007c9a3427cfffa7491bf'},
 {file:'hda06_authorized_review.sql',sha256:'3c8411ddbc5118126988888aaf4f7b0973e245072fb005366c798d479655b455'},
 {file:'hda06_worker_runtime.sql',sha256:'01b5a2c86292d3f0dc837b73aa91b2abd76ebe865e1938c5e21e3d9dc9d791a3'}
] as const;
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
const failure=()=>Error('HDA storage promotion is not the exact append after nineteen qualified migrations. Nothing executed.');
function catalogue(phase:'base'|'final'){
 const contract=phase==='base'?BASE:FINAL;
 const query=(phase==='base'?DATABASE_SECURITY_QUERY:REGISTRATION_SECURITY_QUERY).replace('$1::jsonb','$hda_contract$'+JSON.stringify(contract)+'$hda_contract$::jsonb').replace('$2::text[]',"ARRAY['helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit']::text[]").replaceAll('current_user',"'helpdesk_app'");
 return `DO $hda_${phase}$ DECLARE checked record;BEGIN
 SELECT * INTO checked FROM (${query}) catalogue;
 IF checked.table_count IS DISTINCT FROM ${contract.tables.length} OR checked.unsafe_tables IS DISTINCT FROM 0
 OR checked.public_schema_access IS DISTINCT FROM FALSE OR checked.client_schema_access IS DISTINCT FROM FALSE OR checked.public_helper_execute IS DISTINCT FROM FALSE
 OR ${READINESS_FLAGS.map(flag=>'checked.'+flag+' IS DISTINCT FROM TRUE').join('\n OR ')} THEN RAISE EXCEPTION 'Exact HDA ${phase} catalogue required' USING ERRCODE='HDJ05';END IF;
END $hda_${phase}$;
`;
}
export function compileRegistrationUpgrade(components:readonly string[]):string{
 if(components.length!==REGISTRATION_COMPONENTS.length||components.some((sql,index)=>digest(sql)!==REGISTRATION_COMPONENTS[index]!.sha256))throw failure();
 const bodies=components.map((sql,index)=>{
  if(index===2)return sql;
  const guard=/\bbegin;\s*do \$admission\$[\s\S]*?end \$admission\$;/i.exec(sql);
  if(!guard||!sql.trimEnd().endsWith('commit;'))throw failure();
  return sql.slice(guard.index+guard[0].length).replace(/commit;\s*$/,'');
 });
 return `-- Official additive HDA storage/worker promotion, core0.25 ->0.26.
-- Does not provision identities, bindings, grants, jobs, origin access or an AI engine.
BEGIN;
SET LOCAL statement_timeout='120s';SET LOCAL lock_timeout='10s';SET LOCAL idle_in_transaction_session_timeout='30s';
DO $hda_operator$ BEGIN
 IF current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
 OR current_user<>session_user OR current_user::regrole IS DISTINCT FROM ${QUALIFIED_SCHEMA_OWNER_SQL}
 OR NOT ${OWNER_DEFAULTS_OK_SQL} OR helpdesk_auth.schema_version() IS DISTINCT FROM '0.25.0'
 OR to_regclass('helpdesk_integration.hda02_operations') IS NOT NULL
 OR (SELECT md5(prosrc) FROM pg_catalog.pg_proc WHERE oid='helpdesk_auth.hdn_notification_facts_wave2_team(uuid)'::regprocedure) IS DISTINCT FROM '8d606e34e96a59874a2103163333e019'
 THEN RAISE EXCEPTION 'Qualified HDA promotion operator and exact repaired0.25 required' USING ERRCODE='HDJ05';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('Consulte GEO schema upgrade',0));
END $hda_operator$;
`+catalogue('base')+`
DO $hda_role$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='helpdesk_registration_worker') THEN
  CREATE ROLE helpdesk_registration_worker NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION NOINHERIT;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles r WHERE r.rolname='helpdesk_registration_worker'
 AND NOT(r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication OR r.rolinherit)
 AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE member=r.oid))
 THEN RAISE EXCEPTION 'Restricted independent HDA worker required' USING ERRCODE='HDJ05';END IF;
END $hda_role$;
`+bodies.map((sql,index)=>'-- SOURCE '+REGISTRATION_COMPONENTS[index]!.file+' SHA256 '+REGISTRATION_COMPONENTS[index]!.sha256+'\n'+sql+'\n').join('\n')+catalogue('final')+`
CREATE OR REPLACE FUNCTION helpdesk_auth.schema_version() RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$SELECT '0.26.0'::text$$;
COMMIT;
`;
}
export async function verifyRegistrationUpgrade(root:string){
 const bundle=await loadMigrationBundle(root),baseline=bundle.migrations.slice(0,19).map(({file,sha256})=>({file,sha256}));
 if(!((bundle.schemaVersion==='0.26.0'&&bundle.migrations.length===20)||(bundle.schemaVersion==='0.27.0'&&bundle.migrations.length===21))||digest(JSON.stringify(baseline))!==REGISTRATION_BASELINE_SHA256)throw failure();
 const components=await Promise.all(REGISTRATION_COMPONENTS.map(c=>readWave2Regular(join(root,'supabase/candidates',c.file),2*1024*1024)));
 const last=bundle.migrations[19]!;if(last.file!==REGISTRATION_MIGRATION||last.sql!==compileRegistrationUpgrade(components))throw failure();
 return {file:last.file,sha256:last.sha256,schemaVersion:'0.26.0'};
}
