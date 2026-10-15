/** Additive 0.26 contract. The prior core catalogue remains independently pinned. */
import {DATABASE_SECURITY_CONTRACT as BASE} from './database-security-contract.ts';
import {DATABASE_SECURITY_QUERY} from './database-security.ts';
const entry=['hda02_lock_scope(jsonb)','hda02_receipt(jsonb, uuid)','hda02_operation(jsonb, uuid)','hda02_next(jsonb)','hda02_apply(jsonb, jsonb)'];
const definitions:[string,boolean][]=[
 ['hda02_canonical_walk(jsonb, integer)',false],['hda02_hash(jsonb)',false],['hda02_keys(jsonb, text[])',false],['hda02_uuid(jsonb)',false],['hda02_ref(jsonb)',false],['hda02_text(jsonb, integer)',false],['hda02_integer(jsonb, bigint)',false],['hda02_instant(timestamp with time zone)',false],['hda02_event_id(uuid, uuid, uuid)',false],['hda02_refs(jsonb)',false],['hda02_configuration(jsonb)',false],['hda02_snapshot(jsonb)',false],
 ['hda02_authorize(jsonb)',true],['hda02_reauthorize(jsonb)',true],...entry.map(signature=>[signature,true] as [string,boolean]),['hda02_transition(jsonb, jsonb, jsonb)',false],['hda02_immutable()',false],['hda02_assert_operation(uuid, uuid)',true],['hda02_operation_admission()',true],['hda02_job_admission()',true],['hda02_inbox_admission()',true],['hda06_review_target(uuid, boolean)',true],['hda02_worker_target()',true],['hda02_storage_version()',true]
];
const hdaTables=['bindings','grants','operations','snapshots','jobs','drafts','inbox'].map(name=>'helpdesk_integration.hda02_'+name);
export const REGISTRATION_SECURITY_CONTRACT={...BASE,schemaVersion:'0.26.0' as const,
 tables:[...BASE.tables,...hdaTables.map(name=>({name,read:false,insert:false,updates:[]}))].sort((a,b)=>a.name.localeCompare(b.name)),
 functions:[...BASE.functions,...definitions.map(([name,definer])=>({signature:'helpdesk_auth.'+name,definer,execute:entry.includes(name)||name==='hda06_review_target(uuid, boolean)'}))].sort((a,b)=>a.signature.localeCompare(b.signature)),
 triggers:[...BASE.triggers,
  ...['snapshot','draft','inbox'].map(name=>({table:'helpdesk_integration.hda02_'+(name==='inbox'?'inbox':name+'s'),name:'hda02_'+name+'_immutable',function:'helpdesk_auth.hda02_immutable()',type:27,deferred:false})),
  {table:'helpdesk_integration.hda02_operations',name:'hda02_operation_complete',function:'helpdesk_auth.hda02_operation_admission()',type:21,deferred:true},
  {table:'helpdesk_integration.hda02_jobs',name:'hda02_job_complete',function:'helpdesk_auth.hda02_job_admission()',type:29,deferred:true},
  {table:'helpdesk_integration.hda02_inbox',name:'hda02_inbox_complete',function:'helpdesk_auth.hda02_inbox_admission()',type:5,deferred:true}],
 constraints:[...BASE.constraints,...hdaTables.map(table=>({table,name:table.split('.')[1]+'_pkey',type:'p'})),
  {table:'helpdesk_integration.hda02_operations',name:'hda02_current_snapshot',type:'f'},
  {table:'helpdesk_integration.hda02_operations',name:'hda02_current_job',type:'f'}],
 roles:[...BASE.roles,{name:'helpdesk_registration_worker',schemas:['helpdesk_auth'],functions:[...entry,'hda02_worker_target()','hda02_storage_version()'].map(name=>'helpdesk_auth.'+name).sort()}]
};
/** Base SQL text is kept unchanged for historical migration reproduction. */
export const REGISTRATION_SECURITY_QUERY=DATABASE_SECURITY_QUERY.replace('(select count(*) from expected_roles)=2','(select count(*) from expected_roles)=3');
