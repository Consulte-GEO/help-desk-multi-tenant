/** Offline append-only activation recipe. No driver, SQL execution or source repair. */
import {UPGRADE_BASELINE} from './consultegeo-upgrade.ts';
import {GUARD_REVISIONS} from './consultegeo-guard-revision.ts';
import {createHash} from 'node:crypto';import {constants} from 'node:fs';import {lstat,open,realpath} from 'node:fs/promises';import {join} from 'node:path';
import {loadMigrationBundle} from './migration-files.ts';
import {DATABASE_SECURITY_CONTRACT} from '../src/infrastructure/consultegeo-v024-security-contract.ts';
import {DATABASE_SECURITY_CONTRACT as V023} from '../src/infrastructure/consultegeo-v023-security-contract.ts';
import {DATABASE_SECURITY_QUERY,READINESS_FLAGS} from '../src/infrastructure/database-security.ts';
import {QUALIFIED_SCHEMA_OWNER_SQL,OWNER_DEFAULTS_OK_SQL,SERVICE_FINAL_GUARD} from './consultegeo-service-membership.ts';
export const ACTIVATION_BASELINE=Object.freeze([
 ...UPGRADE_BASELINE,...GUARD_REVISIONS.map(({file,newSha256})=>Object.freeze({file,sha256:newSha256}))
]);
const failure=()=>Error('Consulte GEO activation recipe or source is invalid. Nothing was executed or repaired.');
const files=['cg_local_registry.sql','hdn_notification_delivery.sql','cg_initial_operation.sql'] as const;
// Frozen only after complete native semantic qualification of these exact candidate bytes.
export const QUALIFIED_ACTIVATION_COMPONENTS=Object.freeze([
  {
    "file": "cg_local_registry.sql",
    "sha256": "912f0cf7b772720219e23544e818814a0ee8a7486af79f0700427a0f5e0d8169"
  },
  {
    "file": "hdn_notification_delivery.sql",
    "sha256": "d03d17542f68df0553ddbebc7934c4c2d27267d899d0fe1dd5a52fff908f25c3"
  },
  {
    "file": "cg_initial_operation.sql",
    "sha256": "20bc2666a9d19a328053c214e82c30f11605423e45a09405e5795b415ece3482"
  }
].map(component=>Object.freeze(component)));
export const ACTIVATION_QUALIFICATION=Object.freeze({
  "workflowRun": "38596743873",
  "commit": "34959eb2df452f9c027858edb7c45f58d8485068",
  "sourceSha256": "fddc10095eecfbc96b5d096ad4b5d37a32c4296692fbd54c9c5f10e355b79bbf",
  "artifactId": 11913135308,
  "artifactSha256": "83048016b78555b2214593aef00fdbe9eb830817a86dde3e85e8fcbc73d9aaa1",
  "inventorySha256": "7d09c31cd827ea3b78741a914e6c9099847a909d30e4643e82b59eeaffa53225"
});
export const ACTIVATION_CONTRACT_SHA256='25cbbb8edf974512acce0121ca74536ee637357181c386e49b8ec16542ff8939';
// Immutable compiler input included in source fingerprints and source-only CI archives.
export const ACTIVATION_INVENTORY_SOURCE='supabase/qualifications/consultegeo-activation.inventory.json';
const generatedBy={tool:'Supabase CLI',version:'2.120.0',command:'supabase migration new consultegeo_operational_activation'};
const digest=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
function exact(value:unknown,keys:readonly string[]):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value)&&Reflect.ownKeys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));}
/** Named application identity must have the same ordinary profile required of a runtime session. */
const applicationRoleOk=`EXISTS(SELECT 1 FROM pg_catalog.pg_roles r WHERE r.rolname='helpdesk_app'
 AND NOT (r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication)
 AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m WHERE m.member=r.oid)
 AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE c.relowner=r.oid AND n.nspname LIKE 'helpdesk_%')
 AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_namespace n WHERE n.nspowner=r.oid AND n.nspname LIKE 'helpdesk_%')
 AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE p.proowner=r.oid AND n.nspname LIKE 'helpdesk_%'))`;
/** Only the reviewed candidate envelope is removed; every remaining source byte survives. */
export function extractActivationBody(file:string,sql:string):string{try{
 if(!files.includes(file as typeof files[number])||typeof sql!=='string'||Buffer.byteLength(sql)>2*1024*1024)throw failure();
 const guards=[...sql.matchAll(/^[ \t]*DO\s+\$candidate\$[\s\S]*?END\s+\$candidate\$;/gim)];
 if(guards.length!==1)throw failure();const guard=guards[0]!,offset=guard.index!;
 let before=sql.slice(0,offset),after=sql.slice(offset+guard[0].length);
 if(file==='hdn_notification_delivery.sql'){
  const begins=[...before.matchAll(/^[ \t]*BEGIN;/gm)];if(begins.length!==1)throw failure();
  const begin=begins[0]!;before=before.slice(0,begin.index!)+before.slice(begin.index!+begin[0].length);
  const commit=/^[ \t]*COMMIT;(?=[ \t\r\n]*$)/m.exec(after);if(!commit)throw failure();
  after=after.slice(0,commit.index)+after.slice(commit.index+commit[0].length);
 }
 if(before.split('\n').some(line=>line.trim()&&!line.trim().startsWith('--'))||!after.trim()
  ||/^[ \t]*(?:DO\s+\$candidate\$|BEGIN;|COMMIT;|ROLLBACK;|START\s+TRANSACTION\b)/im.test(after))throw failure();
 return before+after;
 }catch{throw failure();}
}
/** Same catalogue checks as restricted readiness, evaluating the fixed application ACLs as operator. */
function catalogueGuard(contract:typeof V023|typeof DATABASE_SECURITY_CONTRACT,tag:string,code:string):string{
 const json=JSON.stringify(contract);if(json.includes('$activation_contract$'))throw failure();
 const query=DATABASE_SECURITY_QUERY.replace('$1::jsonb','$activation_contract$'+json+'$activation_contract$::jsonb')
  .replace('$2::text[]',"ARRAY['helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit']::text[]")
  .replaceAll('current_user',"'helpdesk_app'");
 return `DO $${tag}$ DECLARE checked record;BEGIN
 IF NOT (${applicationRoleOk}) THEN RAISE EXCEPTION 'Restricted application identity required' USING ERRCODE='${code}';END IF;
 SELECT * INTO checked FROM (${query}) catalogue;
 IF checked.table_count IS DISTINCT FROM ${contract.tables.length} OR checked.unsafe_tables IS DISTINCT FROM 0
  OR checked.public_schema_access IS DISTINCT FROM FALSE OR checked.client_schema_access IS DISTINCT FROM FALSE
  OR checked.public_helper_execute IS DISTINCT FROM FALSE
  OR ${READINESS_FLAGS.map(flag=>'checked.'+flag+' IS DISTINCT FROM TRUE').join('\n  OR ')}
 THEN RAISE EXCEPTION 'Exact activation catalogue required' USING ERRCODE='${code}';END IF;
END $${tag}$;
`;
}
/** Both stages are compiler output; no caller-supplied contract, role or SQL tag is adopted. */
export function compileActivationCatalogueGuard(phase:'base'|'final'):string{
 if(phase==='base')return catalogueGuard(V023,'activation_base_catalogue','HDU04');
 if(phase==='final')return catalogueGuard(DATABASE_SECURITY_CONTRACT,'activation_final_catalogue','HDU06');
 throw failure();
}
const prelude=`-- Consulte GEO operational activation: append-only schema 0.23 -> 0.24.
-- Reviewed PG17 operator only. No business provisioning or release flag activation.
BEGIN;
SET LOCAL statement_timeout='120s';
SET LOCAL lock_timeout='10s';
SET LOCAL idle_in_transaction_session_timeout='30s';
DO $activation$ DECLARE who oid:=current_user::regrole;relation record;BEGIN
 IF current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999 OR current_user<>session_user
  OR who IS DISTINCT FROM ${QUALIFIED_SCHEMA_OWNER_SQL}
  OR to_regprocedure('helpdesk_auth.schema_version()') IS NULL
 THEN RAISE EXCEPTION 'Reviewed migration operator required' USING ERRCODE='HDU01';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('Consulte GEO schema upgrade',0));
 IF helpdesk_auth.schema_version() IS DISTINCT FROM '0.23.0' THEN RAISE EXCEPTION 'Exact prior schema required' USING ERRCODE='HDU02';END IF;
 IF NOT ${OWNER_DEFAULTS_OK_SQL} THEN RAISE EXCEPTION 'Incompatible operator defaults refused' USING ERRCODE='HDU05';END IF;
 IF NOT (${applicationRoleOk}) THEN RAISE EXCEPTION 'Restricted application identity required' USING ERRCODE='HDU04';END IF;
 IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit') AND c.relkind='r')<>53
  OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit') AND p.proname ~ '^(cg_local_|hdn_notification_|cg_initial_)')
 THEN RAISE EXCEPTION 'Partial or incompatible activation refused' USING ERRCODE='HDU03';END IF;
 FOR relation IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit') AND c.relkind='r' ORDER BY n.nspname,c.relname LOOP
  EXECUTE format('LOCK TABLE %I.%I IN ACCESS EXCLUSIVE MODE',relation.nspname,relation.relname);
 END LOOP;
END $activation$;
`;
export function compileConsulteGeoActivation(components:readonly {file:string;sha256:string;sql:string}[]):string{try{
 if((DATABASE_SECURITY_CONTRACT.schemaVersion as string)!=='0.24.0'||digest(JSON.stringify(DATABASE_SECURITY_CONTRACT))!==ACTIVATION_CONTRACT_SHA256
  ||!Array.isArray(components)||components.length!==3||Reflect.ownKeys(components).length!==4)throw failure();
 const bodies=components.map((component,index)=>{const reviewed=QUALIFIED_ACTIVATION_COMPONENTS[index]!;
  if(!exact(component,['file','sha256','sql'])||component.file!==reviewed.file||component.sha256!==reviewed.sha256
   ||typeof component.sql!=='string'||digest(component.sql)!==reviewed.sha256)throw failure();
  return '-- SOURCE '+reviewed.file+' SHA256 '+reviewed.sha256+'\n'+extractActivationBody(reviewed.file,component.sql)+'\n';
 });
 return prelude+SERVICE_FINAL_GUARD.replaceAll("'HDU06'","'HDU04'")+'\n'+compileActivationCatalogueGuard('base')+'\n'+bodies.join('\n')
  +'\n-- Validate actual activation catalogue before publishing the schema marker.\n'+compileActivationCatalogueGuard('final')
  +"CREATE OR REPLACE FUNCTION helpdesk_auth.schema_version() RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$SELECT '0.24.0'::text$$;\nCOMMIT;\n";
 }catch{throw failure();}
}
async function regular(path:string,max:number):Promise<string>{const stat=await lstat(path);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>max)throw failure();const handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);try{const actual=await handle.stat();if(!actual.isFile()||actual.size>max)throw failure();const buffer=Buffer.alloc(max+1),{bytesRead}=await handle.read(buffer,0,max+1,0);if(bytesRead>max)throw failure();return new TextDecoder('utf8',{fatal:true}).decode(buffer.subarray(0,bytesRead));}finally{await handle.close();}}
export async function verifyConsulteGeoActivation(root:string):Promise<{schemaVersion:string;file:string;sha256:string}>{try{
 const path=await realpath(root),bundle=await loadMigrationBundle(path),raw:unknown=JSON.parse(await regular(join(path,'supabase/consultegeo-activation.manifest.json'),65536));
 if(!exact(raw,['format','product','baseSchema','targetSchema','file','sha256','generatedBy','qualification','securityContractSha256','components','baseline'])
  ||raw.format!==1||raw.product!=='CONSULTE_GEO'||raw.baseSchema!=='0.23.0'||raw.targetSchema!=='0.24.0'
  ||!((bundle.schemaVersion==='0.24.0'&&bundle.migrations.length===17)||(bundle.schemaVersion==='0.25.0'&&(bundle.migrations.length===18||bundle.migrations.length===19))||(bundle.schemaVersion==='0.26.0'&&bundle.migrations.length===20))
  ||JSON.stringify(raw.generatedBy)!==JSON.stringify(generatedBy)||JSON.stringify(raw.qualification)!==JSON.stringify(ACTIVATION_QUALIFICATION)
  ||raw.securityContractSha256!==ACTIVATION_CONTRACT_SHA256||JSON.stringify(raw.components)!==JSON.stringify(QUALIFIED_ACTIVATION_COMPONENTS)
  ||JSON.stringify(raw.baseline)!==JSON.stringify(ACTIVATION_BASELINE)
  ||JSON.stringify(bundle.migrations.slice(0,16).map(({file,sha256})=>({file,sha256})))!==JSON.stringify(ACTIVATION_BASELINE))throw failure();
 const migration=bundle.migrations[16]!;
 if(raw.file!==migration.file||!/^\d{14}_consultegeo_operational_activation\.sql$/.test(migration.file)||raw.sha256!==migration.sha256)throw failure();
 const inventory=await regular(join(path,ACTIVATION_INVENTORY_SOURCE),2*1024*1024);
 if(digest(inventory)!==ACTIVATION_QUALIFICATION.inventorySha256||JSON.stringify(JSON.parse(inventory))!==JSON.stringify(DATABASE_SECURITY_CONTRACT))throw failure();
 const components=await Promise.all(QUALIFIED_ACTIVATION_COMPONENTS.map(async c=>({...c,sql:await regular(join(path,'supabase/candidates',c.file),2*1024*1024)})));
 if(compileConsulteGeoActivation(components)!==migration.sql)throw failure();return {schemaVersion:'0.24.0',file:migration.file,sha256:migration.sha256};
 }catch{throw failure();}
}
