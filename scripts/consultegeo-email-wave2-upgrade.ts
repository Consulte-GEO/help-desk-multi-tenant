/** Offline immutable-source compiler. Never discovers or repairs a live schema. */
import {createHash} from 'node:crypto';import {constants} from 'node:fs';import {lstat,open,realpath} from 'node:fs/promises';import {join} from 'node:path';
import {loadMigrationBundle} from './migration-files.ts';import {ACTIVATION_BASELINE} from './consultegeo-activation-upgrade.ts';
import {DATABASE_SECURITY_CONTRACT as V024} from '../src/infrastructure/consultegeo-v024-security-contract.ts';import {DATABASE_SECURITY_CONTRACT as V025} from '../src/infrastructure/database-security-contract.ts';
import {DATABASE_SECURITY_QUERY,READINESS_FLAGS} from '../src/infrastructure/database-security.ts';import {QUALIFIED_SCHEMA_OWNER_SQL,OWNER_DEFAULTS_OK_SQL,SERVICE_FINAL_GUARD} from './consultegeo-service-membership.ts';
const failure=()=>Error('Consulte GEO wave2 upgrade is not the qualified append. Nothing executed or repaired.');
const digest=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
const exact=(v:unknown,keys:readonly string[]):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
export const WAVE2_BASELINE=Object.freeze([...ACTIVATION_BASELINE,Object.freeze({file:'20261014163200_consultegeo_operational_activation.sql',sha256:'8ea04783e17104368741a895cdd2db20c5a45089914194f6269a3c83a5e48d8d'})]);
export const QUALIFIED_WAVE2_COMPONENTS=Object.freeze([
  {
    "file": "hdn_notification_wave2_public.sql",
    "sha256": "8bb4b9cf9567040f9b4cc70c242414e309137a7888c7e51200ac3ea274ca2537"
  },
  {
    "file": "hdn_notification_wave2_internal.sql",
    "sha256": "04a31d13040ad372e651531dfd3e3b007f65a99ef9773e13ca0eb504479242ae"
  },
  {
    "file": "hdn_notification_wave2_audiences.sql",
    "sha256": "57c6d4da319ee5829b42fca29348c78e543d6662d2ba058d9819db97f42dcf93"
  },
  {
    "file": "hdn_review_authority.sql",
    "sha256": "1392363580bdea81382b6d53d1113f3f13697f206dace701ef9c00b6eb4080dd"
  },
  {
    "file": "hdn_review_opening_guard.sql",
    "sha256": "06363e0410dab7d66563a1d3a61891a56bcb1c0df48a6b800acd76bae5912664"
  },
  {
    "file": "hdn_review_intake.sql",
    "sha256": "0c4adf05ca7f3fbdc9abda27cdf2ac855fb03d66897f4ceb7bf6c85b272f470b"
  },
  {
    "file": "hdn_review_store.sql",
    "sha256": "044d4218b49a2c17a647543b3b0d2b2b4bfc800375ecc8e6a47a6834f62d834e"
  },
  {
    "file": "hdn_review_invitation.sql",
    "sha256": "d735ca889f7bf99c61e7fb8ecf8ed58ff24dc4e333f88cd1459b23274575d6d1"
  },
  {
    "file": "hdn_review_challenge.sql",
    "sha256": "dedd8b3dd667e6bc535a6922fdd01bd216dcd08de659c41e1b3360470f28a98f"
  },
  {
    "file": "hdn_review_approval.sql",
    "sha256": "3a615c6f09c61997a027d6df983ccd423f79d1a8d226e610a4a77c5e0d51df66"
  },
  {
    "file": "hdn_review_authority_lock.sql",
    "sha256": "3455ebf81767239eeccf64da5d927e5ad523b72e21e4a569d046de5083c25959"
  },
  {
    "file": "hdn_review_revision.sql",
    "sha256": "22ebdc9a101f3f9a01e90f590ba31f79b25a1e0032cc4828ae96959e29b56cbb"
  },
  {
    "file": "hdn_review_notifications.sql",
    "sha256": "f4382d2a88116eb71ba09654da704ce51a39d910529133020e3de335e03af62c"
  },
  {
    "file": "hdn_review_portal.sql",
    "sha256": "f6d1320ba138030b5235b8778f4179d7e7436ed355c586e938426a1c5819326f"
  }
].map(component=>Object.freeze(component)));
export const WAVE2_QUALIFICATION=Object.freeze({
  "workflowRun": "38690483513",
  "commit": "07e82c79dcaa491ec9165340e0048f89290fcbfa",
  "sourceSha256": "e41c80cfce110329e658ee82bad4bf0bed4f49bda6ee03dbbd73f1bf279561c4",
  "artifactId": 11951439169,
  "artifactSha256": "52b1e771ae568d3c312c13141527f97c999d7c575073a454a58bbaff57533812",
  "inventorySha256": "76ce3065fdc0b930daac7e1b003a88f1f355a1f6cd2112f8c170006beca5eb67"
});
export const WAVE2_CONTRACT_SHA256='1b9505055d78650b653c18324dbd31bbaddfb1bedb4a23745be81a5aadf04e7f';
export const WAVE2_INVENTORY_SOURCE='supabase/qualifications/consultegeo-email-wave2.inventory.json';
const generatedBy={tool:'Supabase CLI',version:'2.120.0',command:'supabase migration new consultegeo_email_wave2'};
const applicationRoleOk=`EXISTS(SELECT 1 FROM pg_catalog.pg_roles r WHERE r.rolname='helpdesk_app'
 AND NOT(r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication)
 AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m WHERE m.member=r.oid)
 AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE c.relowner=r.oid AND n.nspname LIKE 'helpdesk_%')
 AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_namespace n WHERE n.nspowner=r.oid AND n.nspname LIKE 'helpdesk_%')
 AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE p.proowner=r.oid AND n.nspname LIKE 'helpdesk_%'))`;
function catalogueGuard(phase:'base'|'final'){
 const contract=phase==='base'?V024:V025,tag=phase==='base'?'wave2_base_catalogue':'wave2_final_catalogue',code=phase==='base'?'HDE04':'HDE06';
 const json=JSON.stringify(contract);if(json.includes('$wave2_contract$'))throw failure();
 const query=DATABASE_SECURITY_QUERY.replace('$1::jsonb','$wave2_contract$'+json+'$wave2_contract$::jsonb').replace('$2::text[]',"ARRAY['helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit']::text[]").replaceAll('current_user',"'helpdesk_app'");
 return `DO $${tag}$ DECLARE checked record;BEGIN
 IF NOT (${applicationRoleOk}) THEN RAISE EXCEPTION 'Restricted application identity required' USING ERRCODE='${code}';END IF;
 SELECT * INTO checked FROM (${query}) catalogue;
 IF checked.table_count IS DISTINCT FROM ${contract.tables.length} OR checked.unsafe_tables IS DISTINCT FROM 0
 OR checked.public_schema_access IS DISTINCT FROM FALSE OR checked.client_schema_access IS DISTINCT FROM FALSE OR checked.public_helper_execute IS DISTINCT FROM FALSE
 OR ${READINESS_FLAGS.map(flag=>'checked.'+flag+' IS DISTINCT FROM TRUE').join('\n OR ')} THEN RAISE EXCEPTION 'Exact wave2 catalogue required' USING ERRCODE='${code}';END IF;
END $${tag}$;
`;
}
const prelude=`-- Consulte GEO email wave2: append-only schema 0.24 -> 0.25.
-- Qualified migration operator only. Routes and participants require a separate data publication.
BEGIN;
SET LOCAL statement_timeout='120s';SET LOCAL lock_timeout='10s';SET LOCAL idle_in_transaction_session_timeout='30s';
DO $wave2$ DECLARE who oid:=current_user::regrole;relation record;BEGIN
 IF current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999 OR current_user<>session_user OR who IS DISTINCT FROM ${QUALIFIED_SCHEMA_OWNER_SQL}
 OR to_regprocedure('helpdesk_auth.schema_version()') IS NULL THEN RAISE EXCEPTION 'Reviewed migration operator required' USING ERRCODE='HDE01';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('Consulte GEO schema upgrade',0));
 IF helpdesk_auth.schema_version() IS DISTINCT FROM '0.24.0' THEN RAISE EXCEPTION 'Exact prior schema required' USING ERRCODE='HDE02';END IF;
 IF NOT ${OWNER_DEFAULTS_OK_SQL} THEN RAISE EXCEPTION 'Incompatible operator defaults refused' USING ERRCODE='HDE05';END IF;
 IF NOT (${applicationRoleOk}) THEN RAISE EXCEPTION 'Restricted application identity required' USING ERRCODE='HDE04';END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit') AND(p.proname LIKE 'hdnr_%' OR p.proname='hdn_notification_facts_v024')) THEN RAISE EXCEPTION 'Partial wave2 installation refused' USING ERRCODE='HDE03';END IF;
 FOR relation IN SELECT n.nspname,c.relname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit') AND c.relkind='r' ORDER BY n.nspname,c.relname LOOP EXECUTE format('LOCK TABLE %I.%I IN ACCESS EXCLUSIVE MODE',relation.nspname,relation.relname);END LOOP;
END $wave2$;
`;
export function compileConsulteGeoEmailWave2(components:readonly {file:string;sha256:string;sql:string}[]):string{try{
 if((V025.schemaVersion as string)!=='0.25.0'||(V024.schemaVersion as string)!=='0.24.0'||digest(JSON.stringify(V025))!==WAVE2_CONTRACT_SHA256||!Array.isArray(components)||components.length!==QUALIFIED_WAVE2_COMPONENTS.length||Reflect.ownKeys(components).length!==components.length+1)throw failure();
 const bodies=components.map((c,i)=>{const expected=QUALIFIED_WAVE2_COMPONENTS[i]!;if(!exact(c,['file','sha256','sql'])||c.file!==expected.file||c.sha256!==expected.sha256||typeof c.sql!=='string'||digest(c.sql)!==expected.sha256||Buffer.byteLength(c.sql)>2*1024*1024)throw failure();return '-- SOURCE '+c.file+' SHA256 '+c.sha256+'\n'+c.sql+'\n';});
 return prelude+SERVICE_FINAL_GUARD.replaceAll("'HDU06'","'HDE04'")+'\n'+catalogueGuard('base')+'\n'+bodies.join('\n')+'\n-- WAVE2 FINAL CATALOGUE\n'+catalogueGuard('final')+"CREATE OR REPLACE FUNCTION helpdesk_auth.schema_version() RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$SELECT '0.25.0'::text$$;\nCOMMIT;\n";
 }catch{throw failure();}}
async function regular(path:string,max:number){const s=await lstat(path);if(!s.isFile()||s.isSymbolicLink()||s.size>max)throw failure();const h=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);try{const a=await h.stat();if(!a.isFile()||a.size>max)throw failure();const b=Buffer.alloc(max+1),r=await h.read(b,0,max+1,0);if(r.bytesRead>max)throw failure();return new TextDecoder('utf8',{fatal:true}).decode(b.subarray(0,r.bytesRead));}finally{await h.close();}}
export async function verifyConsulteGeoEmailWave2(root:string):Promise<{schemaVersion:string;file:string;sha256:string}>{try{
 const base=await realpath(root),bundle=await loadMigrationBundle(base),raw:unknown=JSON.parse(await regular(join(base,'supabase/consultegeo-email-wave2.manifest.json'),65536));
 if(!exact(raw,['format','product','baseSchema','targetSchema','file','sha256','generatedBy','qualification','securityContractSha256','components','baseline'])||raw.format!==1||raw.product!=='CONSULTE_GEO'||raw.baseSchema!=='0.24.0'||raw.targetSchema!=='0.25.0'||bundle.schemaVersion!=='0.25.0'||bundle.migrations.length!==18||raw.file!=='20261015014616_consultegeo_email_wave2.sql'
 ||JSON.stringify(raw.generatedBy)!==JSON.stringify(generatedBy)||JSON.stringify(raw.qualification)!==JSON.stringify(WAVE2_QUALIFICATION)||raw.securityContractSha256!==WAVE2_CONTRACT_SHA256||JSON.stringify(raw.components)!==JSON.stringify(QUALIFIED_WAVE2_COMPONENTS)||JSON.stringify(raw.baseline)!==JSON.stringify(WAVE2_BASELINE)||JSON.stringify(bundle.migrations.slice(0,17).map(({file,sha256})=>({file,sha256})))!==JSON.stringify(WAVE2_BASELINE))throw failure();
 const migration=bundle.migrations[17]!;if(migration.file!==raw.file||migration.sha256!==raw.sha256)throw failure();
 const inventory=await regular(join(base,WAVE2_INVENTORY_SOURCE),2*1024*1024);if(digest(inventory)!==WAVE2_QUALIFICATION.inventorySha256||JSON.stringify(JSON.parse(inventory))!==JSON.stringify(V025))throw failure();
 const components=await Promise.all(QUALIFIED_WAVE2_COMPONENTS.map(async c=>({...c,sql:await regular(join(base,'supabase/candidates',c.file),2*1024*1024)})));if(compileConsulteGeoEmailWave2(components)!==migration.sql)throw failure();return {schemaVersion:'0.25.0',file:migration.file,sha256:migration.sha256};
 }catch{throw failure();}}
