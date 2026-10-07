import {runRuntimePreflight} from './runtime-preflight.ts';
import type {RuntimePreflightReport} from './runtime-preflight.ts';
import type {RuntimeConfig} from './runtime-config.ts';

type Probe=(input:RuntimeConfig,options:{connect:true})=>Promise<RuntimePreflightReport>;
// Diagnostic values are projected separately from provider configuration and exceptions.
const ids=['configuration','driver','connection','tls','read_only','database_role','schema','database_security','rollback','cleanup'] as const;
const codes=new Set(['passed','not_executed','invalid_configuration','configuration_required','unsafe_database_configuration',
 'unsafe_tls_configuration','invalid_auth_configuration','rate_limit_configuration_required','unsafe_database_role',
 'schema_version_mismatch','unsafe_database_policies','read_only_required','tls_not_verified','rollback_failed','cleanup_failed',
 ...ids.map(id=>id+'_check_failed')]);

/** Provider control-plane/scheduler only; no HTTP handler, selectors or business writes. */
export function createHostedPreflight(readEnv:(name:string)=>string|undefined,observe:(entry:unknown)=>void,probe:Probe=runRuntimePreflight){
 return async():Promise<void>=>{
  const started_at=new Date().toISOString();
  const base={event:'helpdesk.runtime-preflight',schema:'helpdesk.hosted-preflight.v1',started_at,
   diagnostic_executed_in_function:true,production_approved:false,operational:false,auth_tested:false,business_operations_dispatched:0};
  let entry:unknown;
  try{
   const input:RuntimeConfig={databaseUrl:readEnv('HELPDESK_DATABASE_URL'),databaseCa:readEnv('HELPDESK_DATABASE_CA'),
    supabaseUrl:readEnv('SUPABASE_URL'),publishableKey:readEnv('SUPABASE_PUBLISHABLE_KEY'),
    rateLimitHmacKey:readEnv('HELPDESK_RATE_LIMIT_HMAC_KEY'),releaseApproved:readEnv('HELPDESK_RELEASE_APPROVED')};
   const result=await probe(input,{connect:true});
   const checks=result.checks.filter(check=>ids.includes(check.id)).slice(0,ids.length).map(check=>({id:check.id,
    status:['passed','failed','not_executed'].includes(check.status)?check.status:'failed',
    code:codes.has(check.code)?check.code:'check_failed'}));
   const complete=checks.length===ids.length&&ids.every(id=>checks.filter(check=>check.id===id).length===1)
    &&checks.every(check=>check.status==='passed'&&check.code==='passed');
   entry={...base,completed_at:new Date().toISOString(),success:result.success===true&&complete,
    release_flag:input.releaseApproved==='true'?'enabled':'closed',checks};
  }catch{
   entry={...base,completed_at:new Date().toISOString(),success:false,code:'preflight_failed'};
  }
  // Logging failure cannot cause retry of a diagnostic or leak the thrown provider error.
  try{observe(entry);}catch{/* No business operation depends on the diagnostic log. */}
 };
}
