/** Exact semantic repair under the unchanged schema0.25 security catalogue. */
import {createHash} from 'node:crypto';import {join} from 'node:path';
import {loadMigrationBundle} from './migration-files.ts';
import {wave2CatalogueGuard,readWave2Regular} from './consultegeo-email-wave2-upgrade.ts';
import {QUALIFIED_SCHEMA_OWNER_SQL,OWNER_DEFAULTS_OK_SQL} from './consultegeo-service-membership.ts';
export const CUSTOMER_RETURN_FILE='20261015104831_consultegeo_customer_return_source.sql';
export const CUSTOMER_RETURN_COMPONENT_SHA256='0263459cb424ce8a9459edaaff11a2b60616a4ac877c0e63aa26fe2e1799ce87';
export const CUSTOMER_RETURN_BASELINE_SHA256='dd0ce2bc89ec0cee4120ca139e090d019c7251e13deac0c9e569f11dfce96e6e';
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
const failure=()=>Error('Customer return repair is not the exact reviewed nineteenth append. Nothing executed or repaired.');
export function compileCustomerReturnRepair(component:string):string{
 if(digest(component)!==CUSTOMER_RETURN_COMPONENT_SHA256)throw failure();
 return `-- Supabase CLI2.121.0: supabase migration new consultegeo_customer_return_source
-- Semantic repair only. The schema0.25 catalogue and all delivery history stay intact.
BEGIN;
SET LOCAL statement_timeout='120s';SET LOCAL lock_timeout='10s';SET LOCAL idle_in_transaction_session_timeout='30s';
DO $return_source$ DECLARE relation record;BEGIN
 IF current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
 OR current_user<>session_user OR current_user::regrole IS DISTINCT FROM ${QUALIFIED_SCHEMA_OWNER_SQL}
 OR NOT ${OWNER_DEFAULTS_OK_SQL} THEN RAISE EXCEPTION 'Reviewed repair operator required' USING ERRCODE='HDF01';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('Consulte GEO schema upgrade',0));
 IF helpdesk_auth.schema_version() IS DISTINCT FROM '0.25.0'
 OR (SELECT md5(prosrc) FROM pg_catalog.pg_proc WHERE oid='helpdesk_auth.hdn_notification_facts_wave2_team(uuid)'::regprocedure) IS DISTINCT FROM 'f8bb37b0667d9f56b0487b9f155ef225'
 THEN RAISE EXCEPTION 'Exact unpatched customer return source required' USING ERRCODE='HDF02';END IF;
 FOR relation IN SELECT n.nspname,c.relname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname IN ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit') AND c.relkind='r' ORDER BY n.nspname,c.relname
 LOOP EXECUTE format('LOCK TABLE %I.%I IN ACCESS EXCLUSIVE MODE',relation.nspname,relation.relname);END LOOP;
END $return_source$;
`+wave2CatalogueGuard('final')+'\n'+component+'\n-- CUSTOMER RETURN FINAL CATALOGUE\n'+wave2CatalogueGuard('final')+'COMMIT;\n';
}
export async function verifyCustomerReturnRepair(root:string){
 const bundle=await loadMigrationBundle(root),baseline=bundle.migrations.slice(0,18).map(({file,sha256})=>({file,sha256}));
 if(!((bundle.schemaVersion==='0.25.0'&&bundle.migrations.length===19)||(bundle.schemaVersion==='0.26.0'&&bundle.migrations.length===20)||(bundle.schemaVersion==='0.27.0'&&bundle.migrations.length===21))||digest(JSON.stringify(baseline))!==CUSTOMER_RETURN_BASELINE_SHA256)throw failure();
 const component=await readWave2Regular(join(root,'supabase/candidates/hdn_notification_customer_return_source.sql'),64*1024),migration=bundle.migrations[18]!;
 if(migration.file!==CUSTOMER_RETURN_FILE||migration.sql!==compileCustomerReturnRepair(component))throw failure();
 return {file:migration.file,sha256:migration.sha256,schemaVersion:'0.25.0'};
}
