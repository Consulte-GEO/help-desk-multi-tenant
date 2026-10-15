/** Offline append compiler and verifier. Never opens a database or repairs files. */
import {createHash} from 'node:crypto';import {join} from 'node:path';import {loadMigrationBundle} from './migration-files.ts';import {readWave2Regular} from './consultegeo-email-wave2-upgrade.ts';
import {REGISTRATION_SECURITY_CONTRACT as BASE,REGISTRATION_SECURITY_QUERY} from '../src/infrastructure/registration-security-contract.ts';import {EMAIL_MONITOR_SECURITY_CONTRACT as FINAL} from '../src/infrastructure/email-monitor-security-contract.ts';
import {READINESS_FLAGS} from '../src/infrastructure/database-security.ts';import {QUALIFIED_SCHEMA_OWNER_SQL,OWNER_DEFAULTS_OK_SQL} from './consultegeo-service-membership.ts';
import {EMAIL_MONITOR_BASELINE_SHA256,EMAIL_MONITOR_CONTRACT_SHA256,EMAIL_MONITOR_COMPONENTS} from './email-monitor-source.ts';
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');const invalid=()=>Error('Email monitor candidate differs from the pinned append. No SQL executed or repaired.');
type Component={file:string;sha256:string;sql:string};
function catalogue(c:typeof BASE|typeof FINAL,tag:string){const sql=REGISTRATION_SECURITY_QUERY.replace('$1::jsonb','$email_contract$'+JSON.stringify(c)+'$email_contract$::jsonb').replace('$2::text[]',"ARRAY['helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit']::text[]").replaceAll('current_user',"'helpdesk_app'");return 'DO $email_'+tag+'$ DECLARE email_catalogue_result record;BEGIN SELECT * INTO email_catalogue_result FROM ('+sql+') inventory;IF email_catalogue_result.table_count<>'+c.tables.length+" OR email_catalogue_result.unsafe_tables<>0 OR email_catalogue_result.public_schema_access IS DISTINCT FROM false OR email_catalogue_result.client_schema_access IS DISTINCT FROM false OR email_catalogue_result.public_helper_execute IS DISTINCT FROM false OR "+READINESS_FLAGS.map(k=>'email_catalogue_result.'+k+' IS DISTINCT FROM true').join(' OR ')+" THEN RAISE EXCEPTION 'Email monitor "+tag+" catalogue mismatch' USING ERRCODE='HDM02';END IF;END$email_"+tag+'$;\n';}
export function compileEmailMonitorUpgrade(components:readonly Component[]):string{
 if(!Array.isArray(components)||components.length!==2||hash(JSON.stringify(FINAL))!==EMAIL_MONITOR_CONTRACT_SHA256)throw invalid();
 for(const [i,c] of components.entries())if(c.file!==EMAIL_MONITOR_COMPONENTS[i]?.file||c.sha256!==EMAIL_MONITOR_COMPONENTS[i]?.sha256||hash(c.sql)!==c.sha256)throw invalid();
 return `-- Email delivery monitoring V2. Transactional append over HDA storage schema0.26.
-- No sends, routing changes, gate activation, retroactive data or telemetry coverage start.
BEGIN;
SET LOCAL statement_timeout='120s';SET LOCAL lock_timeout='10s';SET LOCAL idle_in_transaction_session_timeout='30s';
DO $email_admission$ BEGIN
 IF current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999 OR current_user<>session_user
 OR current_user::regrole IS DISTINCT FROM ${QUALIFIED_SCHEMA_OWNER_SQL} OR NOT ${OWNER_DEFAULTS_OK_SQL}
 OR helpdesk_auth.schema_version() IS DISTINCT FROM '0.26.0'
 THEN RAISE EXCEPTION 'Qualified schema0.26 operator required' USING ERRCODE='HDM02';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('Consulte GEO schema upgrade',0));
 PERFORM pg_advisory_xact_lock(hashtextextended('helpdesk-notification-ledger-v1',0));
END$email_admission$;
`+catalogue(BASE,'prior')+components.map(c=>'-- SOURCE '+c.file+' SHA256 '+c.sha256+'\n'+c.sql+'\n').join('\n')+catalogue(FINAL,'final')+`CREATE OR REPLACE FUNCTION helpdesk_auth.schema_version() RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$SELECT '0.27.0'::text$$;
COMMIT;
`;
}
export async function verifyEmailMonitorUpgrade(root:string){
 const bundle=await loadMigrationBundle(root),prefix=bundle.migrations.slice(0,20).map(({file,sha256})=>({file,sha256}));
 if(bundle.schemaVersion!=='0.27.0'||bundle.migrations.length!==21||hash(JSON.stringify(prefix))!==EMAIL_MONITOR_BASELINE_SHA256)throw invalid();
 const manifest=JSON.parse(await readWave2Regular(join(root,'supabase/email-monitor.manifest.json'),65536));
 if(manifest.format!==1||manifest.baseSchema!=='0.26.0'||manifest.targetSchema!=='0.27.0'||manifest.file!=='20261015162000_email_monitor_v2.sql'||manifest.securityContractSha256!==EMAIL_MONITOR_CONTRACT_SHA256||JSON.stringify(manifest.components)!==JSON.stringify(EMAIL_MONITOR_COMPONENTS)||JSON.stringify(manifest.baseline)!==JSON.stringify(prefix))throw invalid();
 const components=await Promise.all(EMAIL_MONITOR_COMPONENTS.map(async c=>({...c,sql:await readWave2Regular(join(root,'supabase/candidates',c.file),2*1024*1024)})));
 const last=bundle.migrations[20]!;if(last.file!==manifest.file||last.sha256!==manifest.sha256||last.sql!==compileEmailMonitorUpgrade(components))throw invalid();return {schemaVersion:'0.27.0',file:last.file,sha256:last.sha256};
}
