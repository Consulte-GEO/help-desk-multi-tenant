-- HDA-02 / E02: analysis persistence CANDIDATE, NOT a hosted migration.
-- Only a newly owned PostgreSQL 17 helpdesk_test cluster may install this file.
-- Source/core integration, upgrade and native acceptance must precede promotion.
begin;
do $admission$
begin
 if current_database() <> 'helpdesk_test' or current_user <> 'hda_test_owner'
    or current_setting('hda02.disposable',true) is distinct from 'owned-local-cluster'
    or current_setting('server_version_num')::integer not between 170000 and 179999
    or not exists(select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls)) then
  raise exception 'HDA candidate requires owned local PostgreSQL 17' using errcode='HDJ05';
 end if;
 if to_regclass('helpdesk_integration.hda02_operations') is not null then
  raise exception 'HDA candidate already present; do not overwrite' using errcode='HDJ05';
 end if;
 if (select count(*) from pg_roles where rolname in ('helpdesk_app','helpdesk_registration_worker') and not rolsuper and not rolbypassrls and not rolcreaterole and not rolcreatedb)<>2
    or exists(select 1 from pg_auth_members m join pg_roles r on r.oid=m.member where r.rolname in ('helpdesk_app','helpdesk_registration_worker')) then
  raise exception 'Restricted application and analysis identities required' using errcode='HDJ05';
 end if;
end $admission$;

-- E03 strengthens core-scope checks and deferred queue integrity. Still NOT native-qualified.
-- JSONB is downstream of the strict E01 wire parser. Raw duplicate names,
-- -0 and exponent spelling must be rejected BEFORE conversion to JSONB.
create function helpdesk_auth.hda02_canonical_walk(j jsonb,depth integer)
returns table(body text,nodes integer) language plpgsql immutable set search_path='' as $$
declare item record; part record; t text:=jsonb_typeof(j); count_items integer:=0;
begin
 if j is null or depth>16 then raise exception 'Invalid HDA JSON' using errcode='HDJ05'; end if;
 nodes:=1;
 if t='object' then
  body:='{';
  for item in select key,value from jsonb_each(j) order by key collate "C" loop
   count_items:=count_items+1;
   if count_items>128 or item.key !~ '^[ -~]{1,100}$' or item.key in ('__proto__','constructor','prototype') then raise exception 'Invalid HDA JSON' using errcode='HDJ05'; end if;
   select * into strict part from helpdesk_auth.hda02_canonical_walk(item.value,depth+1);
   nodes:=nodes+part.nodes;body:=body||case when count_items>1 then ',' else '' end||to_jsonb(item.key)::text||':'||part.body;
  end loop;
  body:=body||'}';
 elsif t='array' then
  body:='[';
  for item in select value from jsonb_array_elements(j) with ordinality as x(value,ord) order by ord loop
   count_items:=count_items+1;if count_items>256 then raise exception 'Invalid HDA JSON' using errcode='HDJ05'; end if;
   select * into strict part from helpdesk_auth.hda02_canonical_walk(item.value,depth+1);
   nodes:=nodes+part.nodes;body:=body||case when count_items>1 then ',' else '' end||part.body;
  end loop;
  body:=body||']';
 elsif t='number' then
  body:=j::text;if body !~ '^-?(0|[1-9][0-9]*)$' or body::numeric not between -9007199254740991 and 9007199254740991 then raise exception 'Invalid HDA number' using errcode='HDJ05'; end if;
 elsif t='string' then
  if octet_length(j#>>'{}')>16384 then raise exception 'Invalid HDA string' using errcode='HDJ05'; end if;body:=j::text;
 elsif t in ('null','boolean') then body:=j::text;
 else raise exception 'Invalid HDA value' using errcode='HDJ05'; end if;
 if nodes>4096 or octet_length(body)>65536 then raise exception 'HDA JSON limit' using errcode='HDJ05'; end if;
 return next;
end $$;
create function helpdesk_auth.hda02_hash(j jsonb) returns text language sql immutable set search_path='' as $$
 select encode(sha256(convert_to(x.body,'UTF8')),'hex') from helpdesk_auth.hda02_canonical_walk(j,0) x
$$;
create function helpdesk_auth.hda02_keys(j jsonb,expected text[]) returns void language plpgsql immutable set search_path='' as $$
begin
 if jsonb_typeof(j) is distinct from 'object' then raise exception 'Invalid HDA object' using errcode='HDJ05'; end if;
 if (select count(*) from jsonb_object_keys(j))<>cardinality(expected) or exists(select 1 from jsonb_object_keys(j) k where not(k=any(expected))) then raise exception 'Invalid HDA fields' using errcode='HDJ05'; end if;
end $$;
create function helpdesk_auth.hda02_uuid(j jsonb) returns uuid language plpgsql immutable set search_path='' as $$
begin
 if jsonb_typeof(j) is distinct from 'string' or (j#>>'{}')!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then raise exception 'Invalid HDA identifier' using errcode='HDJ05'; end if;return (j#>>'{}')::uuid;
end $$;
create function helpdesk_auth.hda02_ref(j jsonb) returns text language plpgsql immutable set search_path='' as $$
begin
 if jsonb_typeof(j) is distinct from 'string' or (j#>>'{}')!~'^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' then raise exception 'Invalid HDA reference' using errcode='HDJ05'; end if;return j#>>'{}';
end $$;
-- Same UTF-16 length and ECMAScript trim/control rules as registrationText.
-- Requires native negative/positive vector acceptance; source inspection is not it.
create function helpdesk_auth.hda02_text(j jsonb,maximum integer) returns void language plpgsql immutable set search_path='' as $$
declare value text;units bigint;spaces text:=U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
begin
 if jsonb_typeof(j) is distinct from 'string' then raise exception 'HDA text rejected' using errcode='HDJ05';end if;
 value:=j#>>'{}';
 select coalesce(sum(case when ascii(c)>65535 then 2 else 1 end),0) into units from regexp_split_to_table(value,'') c;
 if units>maximum or btrim(value,spaces)='' or position(chr(127) in value)>0 or exists(select 1 from generate_series(1,31) n where n not in (9,10,13) and position(chr(n) in value)>0) then raise exception 'HDA text rejected' using errcode='HDJ05';end if;
end $$;
create function helpdesk_auth.hda02_integer(j jsonb,minimum bigint) returns bigint language plpgsql immutable set search_path='' as $$
begin
 if jsonb_typeof(j) is distinct from 'number' or j::text!~'^(0|[1-9][0-9]*)$' or j::numeric not between minimum and 9007199254740991 then raise exception 'Invalid HDA revision' using errcode='HDJ05'; end if;return j::text::bigint;
end $$;
create function helpdesk_auth.hda02_instant(t timestamptz) returns text language sql stable set search_path='' as $$
 select to_char(date_trunc('milliseconds',t) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
$$;
create function helpdesk_auth.hda02_event_id(w uuid,actor uuid,command_id uuid) returns uuid language plpgsql immutable set search_path='' as $$
declare h text;
begin
 h:=helpdesk_auth.hda02_hash(jsonb_build_object('workspaceId',w,'actorId',actor,'commandId',command_id));
 h:=substr(h,1,12)||'8'||substr(h,14,3)||to_hex(8+(strpos('0123456789abcdef',substr(h,17,1))-1)%4)||substr(h,18,15);
 return h::uuid;
end $$;
create function helpdesk_auth.hda02_refs(j jsonb) returns void language plpgsql immutable set search_path='' as $$
declare item jsonb;seen text[]:='{}';n text;
begin
 if jsonb_typeof(j) is distinct from 'array' or jsonb_array_length(j)>20 then raise exception 'Invalid HDA references' using errcode='HDJ05'; end if;
 for item in select value from jsonb_array_elements(j) loop
  perform helpdesk_auth.hda02_keys(item,array['id','hash']);n:=helpdesk_auth.hda02_ref(item->'id');
  if n=any(seen) or jsonb_typeof(item->'hash') is distinct from 'string' or (item->>'hash')!~'^[a-f0-9]{64}$' then raise exception 'Invalid HDA reference' using errcode='HDJ05'; end if;seen:=array_append(seen,n);
 end loop;
end $$;
create function helpdesk_auth.hda02_configuration(j jsonb) returns void language plpgsql immutable set search_path='' as $$
begin
 perform helpdesk_auth.hda02_keys(j,array['agentVersionRef','knowledgeRefs','policyVersion']);
 perform helpdesk_auth.hda02_ref(j->'agentVersionRef');perform helpdesk_auth.hda02_ref(j->'policyVersion');perform helpdesk_auth.hda02_refs(j->'knowledgeRefs');
end $$;
create function helpdesk_auth.hda02_snapshot(s jsonb) returns void language plpgsql immutable set search_path='' as $$
declare t jsonb:=s->'target';k text;a jsonb;seen uuid[]:='{}';u uuid;
begin
 perform helpdesk_auth.hda02_keys(s,array['schema','operationId','ticketId','inputRevision','formVersion','actionKey','actionSchemaHash','target','targetHash','answers','attachmentRefs','requestHash']);
 perform helpdesk_auth.hda02_keys(t,array['system','workspaceId','accountId','sourceConnectionId','sourceInstanceId','sourceTenantKey','sourceContractCode','sourceWorkKey','sourceBeneficiaryKey','originAccessRevision']);
 if s->'schema' is distinct from '1'::jsonb or t->>'system' is distinct from 'NOVO_GEO' or s->>'actionKey' is distinct from 'geo.user.grant_work.v1'
 or s->>'actionSchemaHash' is distinct from '20abfd2472a0ce5e565d54495adf37d37a6dea548684d402f43ea4d631dc6e0a'
 or s->>'targetHash' is distinct from helpdesk_auth.hda02_hash(t) or s->>'requestHash' is distinct from helpdesk_auth.hda02_hash(s-'requestHash') or jsonb_typeof(s->'answers') is distinct from 'object' then raise exception 'Invalid HDA snapshot' using errcode='HDJ05'; end if;
 perform helpdesk_auth.hda02_uuid(s->'operationId');perform helpdesk_auth.hda02_uuid(s->'ticketId');perform helpdesk_auth.hda02_integer(s->'inputRevision',1);perform helpdesk_auth.hda02_ref(s->'formVersion');
 foreach k in array array['workspaceId','accountId','sourceConnectionId'] loop perform helpdesk_auth.hda02_uuid(t->k);end loop;
 foreach k in array array['sourceInstanceId','sourceTenantKey','sourceContractCode','sourceWorkKey','sourceBeneficiaryKey'] loop perform helpdesk_auth.hda02_ref(t->k);end loop;
 if t->'originAccessRevision' is distinct from 'null'::jsonb then perform helpdesk_auth.hda02_ref(t->'originAccessRevision');end if;
 if t->>'sourceWorkKey'~'^0+$' or t->>'sourceBeneficiaryKey'~'^0+$' then raise exception 'Invalid HDA target' using errcode='HDJ05';end if;
 if jsonb_typeof(s->'attachmentRefs') is distinct from 'array' or jsonb_array_length(s->'attachmentRefs')>20 then raise exception 'Invalid HDA attachments' using errcode='HDJ05';end if;
 for a in select value from jsonb_array_elements(s->'attachmentRefs') loop
  perform helpdesk_auth.hda02_keys(a,array['id','hash']);u:=helpdesk_auth.hda02_uuid(a->'id');
  if u=any(seen) or jsonb_typeof(a->'hash') is distinct from 'string' or (a->>'hash')!~'^[a-f0-9]{64}$' then raise exception 'Invalid HDA attachment' using errcode='HDJ05';end if;seen:=array_append(seen,u);
 end loop;
end $$;

-- Qualification rows are private and start inactive. This candidate exposes no
-- publisher. HDA-00/03 must bind live origin authority; fixture grants are NOT it.
create table helpdesk_integration.hda02_bindings(
 workspace_id uuid not null,account_id uuid not null,id uuid not null,ticket_id uuid not null,target jsonb not null,target_hash text not null,
 revision bigint not null check(revision between 1 and 9007199254740991),enabled boolean not null default false,valid_until timestamptz not null,
 primary key(workspace_id,id),unique(workspace_id,account_id,id),
 foreign key(workspace_id,account_id,ticket_id) references helpdesk_core.tickets(workspace_id,account_id,id),
 check(target_hash=helpdesk_auth.hda02_hash(target)),check(target->>'workspaceId'=workspace_id::text and target->>'accountId'=account_id::text)
);
create table helpdesk_integration.hda02_grants(
 workspace_id uuid not null,binding_id uuid not null,principal_id uuid not null references helpdesk_auth.principals(id),
 permissions text[] not null,enabled boolean not null default false,valid_until timestamptz not null,
 primary key(workspace_id,binding_id,principal_id),foreign key(workspace_id,binding_id) references helpdesk_integration.hda02_bindings(workspace_id,id),
 check(cardinality(permissions) between 1 and 8 and array_ndims(permissions)=1 and array_lower(permissions,1)=1 and array_position(permissions,null) is null and permissions <@ array['read','prepare','claim','complete','fail','retry','revise','cancel']::text[])
);
create table helpdesk_integration.hda02_operations(
 workspace_id uuid not null,account_id uuid not null,binding_id uuid not null,id uuid not null,ticket_id uuid not null,
 revision bigint not null check(revision between 1 and 9007199254740991),state jsonb not null,state_hash text not null,
 queue_hash text not null check(queue_hash ~ '^[a-f0-9]{64}$'),
 current_job_id uuid not null,input_revision bigint not null,created_at timestamptz not null default clock_timestamp(),
 primary key(workspace_id,id),unique(workspace_id,account_id,id),
 foreign key(workspace_id,account_id,binding_id) references helpdesk_integration.hda02_bindings(workspace_id,account_id,id),
 foreign key(workspace_id,account_id,ticket_id) references helpdesk_core.tickets(workspace_id,account_id,id),check(state_hash=helpdesk_auth.hda02_hash(state))
);
create table helpdesk_integration.hda02_snapshots(
 workspace_id uuid not null,operation_id uuid not null,input_revision bigint not null check(input_revision between 1 and 9007199254740991),document jsonb not null,request_hash text not null,
 primary key(workspace_id,operation_id,input_revision),foreign key(workspace_id,operation_id) references helpdesk_integration.hda02_operations(workspace_id,id) deferrable initially deferred,
 check(document->>'requestHash'=request_hash)
);
create table helpdesk_integration.hda02_jobs(
 workspace_id uuid not null,operation_id uuid not null,id uuid not null,input_revision bigint not null,document jsonb not null,
 status text not null check(status in ('queued','leased','completed','failed','cancelled','superseded')),lease_until timestamptz,
 primary key(workspace_id,id),unique(workspace_id,operation_id,id),
 foreign key(workspace_id,operation_id,input_revision) references helpdesk_integration.hda02_snapshots(workspace_id,operation_id,input_revision) deferrable initially deferred,
 check(coalesce(document->>'kind'='analysis',false)),check(coalesce(document->>'status'=status,false)),
 check(coalesce(document->>'jobId'=id::text and document->>'operationId'=operation_id::text and document->>'inputRevision'=input_revision::text,false)),
 check((status='leased')=(lease_until is not null)),
 check(coalesce(case when status='leased' then (document->'lease'->>'expiresAt')::timestamptz=lease_until else document->'lease'='null'::jsonb end,false))
);
create index hda02_claimable on helpdesk_integration.hda02_jobs(workspace_id,status,lease_until) where status in ('queued','leased');
alter table helpdesk_integration.hda02_operations add constraint hda02_current_snapshot foreign key(workspace_id,id,input_revision) references helpdesk_integration.hda02_snapshots(workspace_id,operation_id,input_revision) deferrable initially deferred;
alter table helpdesk_integration.hda02_operations add constraint hda02_current_job foreign key(workspace_id,id,current_job_id) references helpdesk_integration.hda02_jobs(workspace_id,operation_id,id) deferrable initially deferred;
create table helpdesk_integration.hda02_drafts(
 workspace_id uuid not null,operation_id uuid not null,draft_revision bigint not null check(draft_revision between 1 and 9007199254740991),input_revision bigint not null,job_id uuid not null,document jsonb not null,content_hash text not null,
 primary key(workspace_id,operation_id,draft_revision),
 foreign key(workspace_id,operation_id,input_revision) references helpdesk_integration.hda02_snapshots(workspace_id,operation_id,input_revision),
 foreign key(workspace_id,operation_id,job_id) references helpdesk_integration.hda02_jobs(workspace_id,operation_id,id),
 check(document->>'contentHash'=content_hash),check(document->'executionAllowed'='false'::jsonb and document->>'status'='draft')
);
create table helpdesk_integration.hda02_inbox(
 workspace_id uuid not null,account_id uuid not null,principal_id uuid not null references helpdesk_auth.principals(id),command_id uuid not null,binding_id uuid not null,operation_id uuid not null,
 command_hash text not null,receipt jsonb not null,event jsonb,analysis jsonb,scope jsonb not null,lease_deadline timestamptz,transaction_id xid8 not null default pg_current_xact_id(),
 primary key(workspace_id,principal_id,command_id),foreign key(workspace_id,account_id,operation_id) references helpdesk_integration.hda02_operations(workspace_id,account_id,id),
 foreign key(workspace_id,account_id,binding_id) references helpdesk_integration.hda02_bindings(workspace_id,account_id,id),check(command_hash~'^[a-f0-9]{64}$')
);

create function helpdesk_auth.hda02_authorize(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare b helpdesk_integration.hda02_bindings%rowtype;g helpdesk_integration.hda02_grants%rowtype;t helpdesk_core.tickets%rowtype;k text;w uuid;a uuid;actor uuid;bid uuid;permission text;until_at timestamptz;at_time timestamptz:=clock_timestamp();resource_scope jsonb;resource_until timestamptz:='infinity';
begin
 perform helpdesk_auth.hda02_keys(p,array['workspaceId','accountId','actorId','bindingId','permission']);
 w:=helpdesk_auth.hda02_uuid(p->'workspaceId');a:=helpdesk_auth.hda02_uuid(p->'accountId');actor:=helpdesk_auth.hda02_uuid(p->'actorId');bid:=helpdesk_auth.hda02_uuid(p->'bindingId');permission:=p->>'permission';
 if permission is null or permission not in ('read','prepare','claim','complete','fail','retry','revise','cancel') then raise exception 'HDA permission denied' using errcode='HDJ01';end if;
 if w is distinct from helpdesk_auth.workspace_id() or actor is distinct from helpdesk_auth.actor_id() then raise exception 'HDA scope denied' using errcode='HDJ01';end if;
 select * into b from helpdesk_integration.hda02_bindings where workspace_id=w and account_id=a and id=bid and enabled for share;
 if not found then raise exception 'HDA scope denied' using errcode='HDJ01';end if;
 select kind into k from helpdesk_auth.principals where id=actor and active for share;
 if not found then raise exception 'HDA scope denied' using errcode='HDJ01';end if;
 -- Match the append-only human_scope_versions publisher's lock namespace.
 -- Locking an old scope row alone cannot block insertion of a newer revocation.
 if k='human' then
  perform pg_advisory_xact_lock(hashtextextended('helpdesk-human-scopes:'||w::text||':'||actor::text,0));
 end if;
 perform 1 from helpdesk_auth.workspace_memberships where workspace_id=w and principal_id=actor for share;
 perform 1 from helpdesk_auth.account_grants where workspace_id=w and account_id=a and principal_id=actor for share;
 perform 1 from helpdesk_auth.integration_connections where workspace_id=w and principal_id=actor for share;
 perform 1 from helpdesk_auth.source_scope_bindings s join helpdesk_auth.integration_connections c on c.workspace_id=s.workspace_id and c.id=s.connection_id where s.workspace_id=w and s.account_id=a and c.principal_id=actor for share of s;
 select * into g from helpdesk_integration.hda02_grants where workspace_id=w and binding_id=bid and principal_id=actor and enabled for share;
 if not found or not coalesce(permission=any(g.permissions),false) then raise exception 'HDA scope denied' using errcode='HDJ01';end if;
 select * into strict t from helpdesk_core.tickets where workspace_id=w and account_id=a and id=b.ticket_id for share;
 -- Account/product grants do not replace the current per-work resource policy.
 -- The real core also denies technical integrations for protected CG products.
 if not coalesce(helpdesk_auth.cg_ticket_resource_allowed(w,a,b.ticket_id,'tickets.read'),false) then raise exception 'HDA resource scope denied' using errcode='HDJ01';end if;
 if not coalesce(helpdesk_auth.cg_unscoped_product(w,t.product_instance_id),false) then
  resource_scope:=helpdesk_auth.cg_lock_ticket_scope(b.ticket_id,'tickets.read');
  if resource_scope is null or resource_scope->>'expiresAt' is null then raise exception 'HDA resource scope denied' using errcode='HDJ01';end if;
  resource_until:=(resource_scope->>'expiresAt')::timestamptz;
  if permission<>'read' then
   resource_scope:=helpdesk_auth.cg_lock_ticket_scope(b.ticket_id,'tickets.write');
   if resource_scope is null or resource_scope->>'expiresAt' is null then raise exception 'HDA resource scope denied' using errcode='HDJ01';end if;
   resource_until:=least(resource_until,(resource_scope->>'expiresAt')::timestamptz);
  end if;
 end if;
 if not coalesce(helpdesk_auth.has_scope(w,'tickets:read'),false) then raise exception 'HDA core scope denied' using errcode='HDJ01';end if;
 if k='human' then
  if permission<>'read' and not coalesce(helpdesk_auth.has_scope(w,'tickets:write'),false) then raise exception 'HDA core scope denied' using errcode='HDJ01';end if;
  if session_user<>'helpdesk_app' or permission not in ('read','prepare','retry','revise','cancel') or not coalesce(helpdesk_auth.can_read_ticket(w,a,t.product_instance_id,t.created_by),false) then raise exception 'HDA scope denied' using errcode='HDJ01';end if;
  k:='human';
 elsif k='integration' then
  if session_user<>'helpdesk_registration_worker' or permission not in ('read','claim','complete','fail') or not coalesce(helpdesk_auth.has_account(w,a),false) or not coalesce(helpdesk_auth.product_allowed(w,t.product_instance_id),false) then raise exception 'HDA scope denied' using errcode='HDJ01';end if;
  k:='analyzer';
 else raise exception 'HDA scope denied' using errcode='HDJ01';end if;
 if t.status in ('cancelled','closed','resolved') and permission not in ('read','cancel') then raise exception 'HDA ticket unavailable' using errcode='HDJ01';end if;
 until_at:=date_trunc('milliseconds',least(b.valid_until,g.valid_until,resource_until));at_time:=clock_timestamp();
 if until_at<=at_time then raise exception 'HDA scope expired' using errcode='HDJ01';end if;
 return p||jsonb_build_object('actorKind',k,'bindingRevision',b.revision,'targetHash',b.target_hash,'ticketId',b.ticket_id,'databaseNow',helpdesk_auth.hda02_instant(at_time),'expiresAt',helpdesk_auth.hda02_instant(until_at));
end $$;
create function helpdesk_auth.hda02_reauthorize(s jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actual jsonb;p jsonb;
begin
 perform helpdesk_auth.hda02_keys(s,array['workspaceId','accountId','actorId','bindingId','permission','actorKind','bindingRevision','targetHash','ticketId','databaseNow','expiresAt']);
 p:=jsonb_build_object('workspaceId',s->'workspaceId','accountId',s->'accountId','actorId',s->'actorId','bindingId',s->'bindingId','permission',s->'permission');actual:=helpdesk_auth.hda02_authorize(p);
 if (actual-'databaseNow') is distinct from (s-'databaseNow') or (s->>'databaseNow')::timestamptz>clock_timestamp() then raise exception 'HDA scope changed' using errcode='HDJ01';end if;return actual;
end $$;
create function helpdesk_auth.hda02_lock_scope(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$begin return helpdesk_auth.hda02_authorize(p);end $$;
create function helpdesk_auth.hda02_receipt(s jsonb,requested_command_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r helpdesk_integration.hda02_inbox%rowtype;
begin
 perform helpdesk_auth.hda02_reauthorize(s);
 perform pg_advisory_xact_lock(hashtextextended('hda02:'||(s->>'workspaceId')||':'||(s->>'actorId')||':'||requested_command_id::text,0));
 select * into r from helpdesk_integration.hda02_inbox where workspace_id=(s->>'workspaceId')::uuid and principal_id=(s->>'actorId')::uuid and hda02_inbox.command_id=requested_command_id;
 if not found then return null;end if;
 if r.account_id::text is distinct from s->>'accountId' or r.binding_id::text is distinct from s->>'bindingId' then raise exception 'HDA receipt denied' using errcode='HDJ01';end if;return r.receipt;
end $$;
create function helpdesk_auth.hda02_operation(s jsonb,requested_operation_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare o helpdesk_integration.hda02_operations%rowtype;q helpdesk_integration.hda02_jobs%rowtype;
begin
 perform helpdesk_auth.hda02_reauthorize(s);
 select * into o from helpdesk_integration.hda02_operations where workspace_id=(s->>'workspaceId')::uuid and account_id=(s->>'accountId')::uuid and binding_id=(s->>'bindingId')::uuid and id=requested_operation_id for update;
 if not found then return null;end if;
 select * into strict q from helpdesk_integration.hda02_jobs where workspace_id=o.workspace_id and id=o.current_job_id for update;
 return jsonb_build_object('state',o.state,'queue',q.document,'databaseNow',helpdesk_auth.hda02_instant(clock_timestamp()));
end $$;
create function helpdesk_auth.hda02_next(s jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare candidate uuid;
begin
 perform helpdesk_auth.hda02_reauthorize(s);if s->>'permission' is distinct from 'claim' then raise exception 'HDA claim denied' using errcode='HDJ01';end if;
 select o.id into candidate from helpdesk_integration.hda02_operations o join helpdesk_integration.hda02_jobs j on j.workspace_id=o.workspace_id and j.id=o.current_job_id
 where o.workspace_id=(s->>'workspaceId')::uuid and o.account_id=(s->>'accountId')::uuid and o.binding_id=(s->>'bindingId')::uuid and (j.status='queued' or j.status='leased' and j.lease_until<=clock_timestamp())
 order by o.created_at,o.id limit 1 for update of o skip locked;
 if not found then return null;end if;return helpdesk_auth.hda02_operation(s,candidate);
end $$;

-- Independent SQL projection of E01's analysis state machine. This is deliberately
-- not a generic JSON writer and never supports approval/execution/resolution.
create function helpdesk_auth.hda02_transition(old_state jsonb,e jsonb,a jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare n jsonb:=old_state;s jsonb:=old_state->'snapshot';j jsonb:=old_state->'job';model_output jsonb;expected_analysis jsonb;d jsonb;effects jsonb:='{"addWorkLink":true,"preserveExistingLinks":true,"changeProfile":false,"sendInvitation":false}';v bigint;typ text:=e->>'type';item jsonb;extra text[];status text:=old_state->>'status';
begin
 v:=helpdesk_auth.hda02_integer(old_state->'revision',1);if v>=9007199254740991 or status='cancelled' then raise exception 'HDA transition denied' using errcode='HDJ02';end if;
 extra:=case typ when 'analysis_started' then array['job'] when 'analysis_completed' then array['jobId','fence','output','policyVersion'] when 'analysis_failed' then array['jobId','fence','reason'] when 'retry_analysis' then array[]::text[] when 'input_revised' then array['snapshot'] when 'cancel_analysis' then array[]::text[] else null end;
 if extra is null then raise exception 'HDA transition denied' using errcode='HDJ05';end if;
 perform helpdesk_auth.hda02_keys(e,array['eventId','operationId','expectedRevision','type']||extra);
 if e->'operationId' is distinct from s->'operationId' or helpdesk_auth.hda02_integer(e->'expectedRevision',1)<>v then raise exception 'HDA revision conflict' using errcode='HDJ02';end if;
 if typ='analysis_started' then
  if status not in ('queued_analysis','analyzing') then raise exception 'HDA transition denied' using errcode='HDJ03';end if;
  j:=e->'job';perform helpdesk_auth.hda02_keys(j,array['schema','jobId','operationId','inputRevision','requestHash','actionKey','actionSchemaHash','targetHash','fence','agentVersionRef','knowledgeRefs']);
  if j->'schema' is distinct from '1'::jsonb or (j-array['schema','jobId','fence','agentVersionRef','knowledgeRefs']) is distinct from jsonb_build_object('operationId',s->'operationId','inputRevision',s->'inputRevision','requestHash',s->'requestHash','actionKey',s->'actionKey','actionSchemaHash',s->'actionSchemaHash','targetHash',s->'targetHash') or helpdesk_auth.hda02_integer(j->'fence',1)<=helpdesk_auth.hda02_integer(old_state->'analysisFence',0) then raise exception 'HDA stale analysis' using errcode='HDJ03';end if;
  perform helpdesk_auth.hda02_uuid(j->'jobId');perform helpdesk_auth.hda02_ref(j->'agentVersionRef');perform helpdesk_auth.hda02_refs(j->'knowledgeRefs');
  n:=n||jsonb_build_object('status','analyzing','job',j,'analysisFence',j->'fence','draft',null);
 elsif typ in ('analysis_completed','analysis_failed') then
  if status<>'analyzing' or e->'jobId' is distinct from j->'jobId' or e->'fence' is distinct from old_state->'analysisFence' then raise exception 'HDA stale analysis' using errcode='HDJ03';end if;
  if typ='analysis_failed' then
   if e->>'reason' is null or e->>'reason' not in ('offline','timeout','invalid_output','runner_failed') or a is distinct from 'null'::jsonb then raise exception 'HDA failure rejected' using errcode='HDJ05';end if;
   n:=n||jsonb_build_object('status','analysis_failed','draft',null);
  else
   model_output:=e->'output';perform helpdesk_auth.hda02_keys(model_output,array['schema','jobId','operationId','inputRevision','disposition','proposedFields','missingFields','warnings','knowledgeRefs']);
   if model_output->'schema' is distinct from '1'::jsonb or model_output->'jobId' is distinct from j->'jobId' or model_output->'operationId' is distinct from j->'operationId' or model_output->'inputRevision' is distinct from j->'inputRevision' or model_output->>'disposition' is null or model_output->>'disposition' not in ('proposal','needs_information','manual_review','unsupported') then raise exception 'HDA output mismatch' using errcode='HDJ05';end if;
   perform helpdesk_auth.hda02_refs(model_output->'knowledgeRefs');
   if exists(select 1 from jsonb_array_elements(model_output->'knowledgeRefs') r where not exists(select 1 from jsonb_array_elements(j->'knowledgeRefs') k where k.value=r.value)) then raise exception 'HDA knowledge denied' using errcode='HDJ01';end if;
   if jsonb_typeof(model_output->'missingFields') is distinct from 'array' or jsonb_typeof(model_output->'warnings') is distinct from 'array' or jsonb_array_length(model_output->'warnings')>20 or jsonb_array_length(model_output->'missingFields')>20 then raise exception 'HDA output limits' using errcode='HDJ05';end if;
   if exists(select 1 from jsonb_array_elements(model_output->'missingFields') m where jsonb_typeof(m.value) is distinct from 'string' or (m.value#>>'{}') not in ('sourceBeneficiaryKey','sourceWorkKey','requestConfirmation')) or (select count(*) from jsonb_array_elements(model_output->'missingFields'))<>(select count(distinct value) from jsonb_array_elements(model_output->'missingFields')) then raise exception 'HDA missing fields rejected' using errcode='HDJ05';end if;
   for item in select value from jsonb_array_elements(model_output->'warnings') loop
    perform helpdesk_auth.hda02_text(item,2000);
   end loop;
   perform helpdesk_auth.hda02_ref(e->'policyVersion');
   expected_analysis:=model_output||jsonb_build_object('actionKey',j->'actionKey','actionSchemaHash',j->'actionSchemaHash','requestHash',j->'requestHash','targetHash',j->'targetHash','agentVersionRef',j->'agentVersionRef','executionAllowed',false);
   if a is distinct from expected_analysis then raise exception 'HDA analysis mismatch' using errcode='HDJ05';end if;
   if model_output->>'disposition'='proposal' then
    if model_output->'missingFields' is distinct from '[]'::jsonb or model_output->'proposedFields' is distinct from '{"kind":"add_work_link","preserveExistingLinks":true}'::jsonb then raise exception 'HDA proposal rejected' using errcode='HDJ05';end if;
    if helpdesk_auth.hda02_integer(old_state->'draftRevision',0)>=9007199254740991 then raise exception 'HDA draft revision exhausted' using errcode='HDJ05';end if;
    d:=jsonb_build_object('schema',1,'operationId',s->'operationId','inputRevision',s->'inputRevision','draftRevision',(old_state->>'draftRevision')::bigint+1,'actionKey',s->'actionKey','actionSchemaHash',s->'actionSchemaHash','requestHash',s->'requestHash','target',s->'target','targetHash',s->'targetHash','payload',model_output->'proposedFields','payloadHash',helpdesk_auth.hda02_hash(model_output->'proposedFields'),'effects',effects,'effectsHash',helpdesk_auth.hda02_hash(effects),'previewRef',null,'policyVersion',e->'policyVersion','analysisJobId',j->'jobId','agentVersionRef',j->'agentVersionRef','status','draft','executionAllowed',false);
    d:=d||jsonb_build_object('contentHash',helpdesk_auth.hda02_hash(d));n:=n||jsonb_build_object('status','draft_ready','draft',d,'draftRevision',d->'draftRevision');
   else
    if model_output->'proposedFields' is distinct from '{}'::jsonb or model_output->>'disposition'='needs_information' and jsonb_array_length(model_output->'missingFields')=0 then raise exception 'HDA manual output rejected' using errcode='HDJ05';end if;
    n:=n||jsonb_build_object('status',case when model_output->>'disposition'='needs_information' then 'needs_information' else 'manual_review' end,'draft',null);
   end if;
  end if;
 elsif typ='retry_analysis' then
  if status<>'analysis_failed' then raise exception 'HDA retry denied' using errcode='HDJ02';end if;n:=n||jsonb_build_object('status','queued_analysis','job',null,'draft',null);
 elsif typ='input_revised' then
  perform helpdesk_auth.hda02_snapshot(e->'snapshot');
  if (e->'snapshot'->'target') is distinct from s->'target' or e->'snapshot'->'operationId' is distinct from s->'operationId' or e->'snapshot'->'ticketId' is distinct from s->'ticketId' or e->'snapshot'->'actionKey' is distinct from s->'actionKey' or helpdesk_auth.hda02_integer(e->'snapshot'->'inputRevision',1)<>(s->>'inputRevision')::bigint+1 then raise exception 'HDA revision target denied' using errcode='HDJ01';end if;
  n:=n||jsonb_build_object('snapshot',e->'snapshot','status','queued_analysis','job',null,'draft',null);
 else n:=n||jsonb_build_object('status','cancelled','draft',null);end if;
 if typ<>'analysis_completed' and a is distinct from 'null'::jsonb then raise exception 'HDA unexpected analysis' using errcode='HDJ05';end if;
 return n||jsonb_build_object('revision',v+1,'lastEvent',jsonb_build_object('eventId',e->'eventId','hash',helpdesk_auth.hda02_hash(e),'revision',v+1));
end $$;

create function helpdesk_auth.hda02_apply(s jsonb,b jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare p jsonb;c jsonb:=b->'command';n jsonb:=b->'next'->'state';q jsonb:=b->'next'->'queue';snap jsonb:=n->'snapshot';ev jsonb:=b->'event';an jsonb:=b->'analysis';prior jsonb;expected_state jsonb;expected_queue jsonb;expected_event jsonb;
 o helpdesk_integration.hda02_operations%rowtype;oldq helpdesk_integration.hda02_jobs%rowtype;old_snapshot jsonb;
 w uuid:=(s->>'workspaceId')::uuid;a uuid:=(s->>'accountId')::uuid;actor uuid:=(s->>'actorId')::uuid;bid uuid:=(s->>'bindingId')::uuid;op uuid;job uuid;cmd uuid;eid uuid;expected bigint;rev bigint;attempts bigint;fence bigint;count_rows integer;permission text:=s->>'permission';at_time timestamptz;lease_deadline timestamptz;receipt jsonb;extra text[];claim_exhausted boolean:=false;
begin
 perform helpdesk_auth.hda02_reauthorize(s);perform helpdesk_auth.hda02_hash(b);
 perform helpdesk_auth.hda02_keys(b,array['schema','command','commandHash','expectedRevision','beforeStateHash','event','next','analysis']);perform helpdesk_auth.hda02_keys(b->'next',array['state','queue']);
 perform helpdesk_auth.hda02_keys(n,array['schema','snapshot','revision','status','analysisFence','job','draft','draftRevision','lastEvent']);
 perform helpdesk_auth.hda02_keys(q,array['schema','jobId','operationId','inputRevision','requestHash','kind','configuration','status','attempts','lease']);
 if b->'schema' is distinct from '1'::jsonb or n->'schema' is distinct from '1'::jsonb or q->'schema' is distinct from '1'::jsonb or q->>'kind' is distinct from 'analysis' or c->>'type' is distinct from permission then raise exception 'HDA write rejected' using errcode='HDJ05';end if;
 extra:=case permission when 'prepare' then array['snapshot','jobId','configuration'] when 'claim' then array['leaseSeconds'] when 'complete' then array['operationId','expectedRevision','jobId','leaseId','fence','output'] when 'fail' then array['operationId','expectedRevision','jobId','leaseId','fence','reason'] when 'retry' then array['operationId','expectedRevision','jobId'] when 'revise' then array['operationId','expectedRevision','snapshot','jobId'] when 'cancel' then array['operationId','expectedRevision'] else null end;
 if extra is null then raise exception 'HDA write denied' using errcode='HDJ01';end if;perform helpdesk_auth.hda02_keys(c,array['type','commandId']||extra);
 cmd:=helpdesk_auth.hda02_uuid(c->'commandId');eid:=helpdesk_auth.hda02_event_id(w,actor,cmd);
 p:=jsonb_build_object('workspaceId',s->'workspaceId','accountId',s->'accountId','actorId',s->'actorId','bindingId',s->'bindingId','permission',s->'permission');
 if b->>'commandHash' is distinct from helpdesk_auth.hda02_hash(jsonb_build_object('scope',p,'command',c)) then raise exception 'HDA command hash mismatch' using errcode='HDJ04';end if;
 prior:=helpdesk_auth.hda02_receipt(s,cmd);
 if prior is not null then
  if prior->>'commandHash' is distinct from b->>'commandHash' then raise exception 'HDA command conflict' using errcode='HDJ04';end if;return prior;
 end if;
 perform helpdesk_auth.hda02_snapshot(snap);perform helpdesk_auth.hda02_configuration(q->'configuration');
 op:=helpdesk_auth.hda02_uuid(snap->'operationId');job:=helpdesk_auth.hda02_uuid(q->'jobId');expected:=helpdesk_auth.hda02_integer(b->'expectedRevision',0);rev:=helpdesk_auth.hda02_integer(n->'revision',1);attempts:=helpdesk_auth.hda02_integer(q->'attempts',0);fence:=helpdesk_auth.hda02_integer(n->'analysisFence',0);
 if snap->'target'->>'workspaceId' is distinct from w::text or snap->'target'->>'accountId' is distinct from a::text or snap->>'ticketId' is distinct from s->>'ticketId' or snap->>'targetHash' is distinct from s->>'targetHash' or q->'operationId' is distinct from snap->'operationId' or q->'inputRevision' is distinct from snap->'inputRevision' or q->'requestHash' is distinct from snap->'requestHash' or attempts>3 then raise exception 'HDA target mismatch' using errcode='HDJ01';end if;
 if permission not in ('prepare','claim') and c->'operationId' is distinct from snap->'operationId' then raise exception 'HDA operation mismatch' using errcode='HDJ01';end if;
 select * into o from helpdesk_integration.hda02_operations where workspace_id=w and id=op for update;
 if permission='prepare' then
  if found or expected<>0 or rev<>1 or b->'beforeStateHash' is distinct from 'null'::jsonb or ev is distinct from 'null'::jsonb or an is distinct from 'null'::jsonb or snap->'inputRevision' is distinct from '1'::jsonb or c->'snapshot' is distinct from snap or c->'jobId' is distinct from q->'jobId' or c->'configuration' is distinct from q->'configuration' then raise exception 'HDA prepare conflict' using errcode='HDJ02';end if;
  expected_state:=jsonb_build_object('schema',1,'snapshot',snap,'revision',1,'status','queued_analysis','analysisFence',0,'job',null,'draft',null,'draftRevision',0,'lastEvent',null);
  expected_queue:=jsonb_build_object('schema',1,'jobId',job,'operationId',op,'inputRevision',1,'requestHash',snap->'requestHash','kind','analysis','configuration',c->'configuration','status','queued','attempts',0,'lease',null);
 else
  if not found or o.account_id<>a or o.binding_id<>bid or o.ticket_id::text is distinct from s->>'ticketId' then raise exception 'HDA operation denied' using errcode='HDJ01';end if;
  if expected<>o.revision or rev<>o.revision+1 or b->>'beforeStateHash' is distinct from o.state_hash then raise exception 'HDA revision conflict' using errcode='HDJ02';end if;
  if permission<>'claim' and helpdesk_auth.hda02_integer(c->'expectedRevision',1)<>o.revision then raise exception 'HDA expected revision conflict' using errcode='HDJ02';end if;
  select * into strict oldq from helpdesk_integration.hda02_jobs where workspace_id=w and id=o.current_job_id for update;
  if ev->>'eventId' is distinct from eid::text then raise exception 'HDA event namespace mismatch' using errcode='HDJ04';end if;
  expected_state:=helpdesk_auth.hda02_transition(o.state,ev,an);
  expected_event:=jsonb_build_object('eventId',eid,'operationId',op,'expectedRevision',o.revision);
  at_time:=clock_timestamp();
  if permission='claim' then
   if oldq.status<>'queued' and not(oldq.status='leased' and oldq.lease_until<=at_time) then raise exception 'HDA lease busy' using errcode='HDJ03';end if;
   if helpdesk_auth.hda02_integer(c->'leaseSeconds',15)>300 then raise exception 'HDA lease limit' using errcode='HDJ05';end if;
   claim_exhausted:=(oldq.document->>'attempts')::integer=3;
   if claim_exhausted then
    expected_event:=expected_event||jsonb_build_object('type','analysis_failed','jobId',oldq.id,'fence',o.state->'analysisFence','reason','timeout');expected_queue:=oldq.document||jsonb_build_object('status','failed','lease',null);
   else
    perform helpdesk_auth.hda02_keys(q->'lease',array['leaseId','workerId','fence','issuedAt','expiresAt']);
    if jsonb_typeof(q->'lease'->'issuedAt') is distinct from 'string' or jsonb_typeof(q->'lease'->'expiresAt') is distinct from 'string' then raise exception 'HDA lease time required' using errcode='HDJ03';end if;
    lease_deadline:=(q->'lease'->>'expiresAt')::timestamptz;
    if q->'lease'->>'leaseId' is distinct from cmd::text or q->'lease'->>'workerId' is distinct from actor::text or helpdesk_auth.hda02_integer(q->'lease'->'fence',1)<>(o.state->>'analysisFence')::bigint+1
       or (q->'lease'->>'issuedAt')::timestamptz>at_time or lease_deadline<=at_time or lease_deadline>(q->'lease'->>'issuedAt')::timestamptz+make_interval(secs=>(c->>'leaseSeconds')::integer) or lease_deadline>(s->>'expiresAt')::timestamptz
       or q->'lease'->>'issuedAt' is distinct from helpdesk_auth.hda02_instant((q->'lease'->>'issuedAt')::timestamptz) or q->'lease'->>'expiresAt' is distinct from helpdesk_auth.hda02_instant(lease_deadline) then raise exception 'HDA lease rejected' using errcode='HDJ03';end if;
    expected_event:=expected_event||jsonb_build_object('type','analysis_started','job',jsonb_build_object('schema',1,'jobId',oldq.id,'operationId',op,'inputRevision',snap->'inputRevision','requestHash',snap->'requestHash','actionKey',snap->'actionKey','actionSchemaHash',snap->'actionSchemaHash','targetHash',snap->'targetHash','fence',(o.state->>'analysisFence')::bigint+1,'agentVersionRef',oldq.document->'configuration'->'agentVersionRef','knowledgeRefs',oldq.document->'configuration'->'knowledgeRefs'));
    expected_queue:=oldq.document||jsonb_build_object('status','leased','attempts',(oldq.document->>'attempts')::integer+1,'lease',q->'lease');
   end if;
  elsif permission in ('complete','fail') then
   if oldq.status<>'leased' or oldq.lease_until<=at_time or oldq.document->'lease'->>'workerId' is distinct from actor::text or c->'leaseId' is distinct from oldq.document->'lease'->'leaseId' or c->'jobId' is distinct from oldq.document->'jobId' or c->'fence' is distinct from oldq.document->'lease'->'fence' then raise exception 'HDA stale analysis' using errcode='HDJ03';end if;
   lease_deadline:=oldq.lease_until;
   expected_event:=expected_event||jsonb_build_object('type',case when permission='complete' then 'analysis_completed' else 'analysis_failed' end,'jobId',oldq.id,'fence',c->'fence');
   if permission='complete' then expected_event:=expected_event||jsonb_build_object('output',c->'output','policyVersion',oldq.document->'configuration'->'policyVersion');else expected_event:=expected_event||jsonb_build_object('reason',c->'reason');end if;
   expected_queue:=oldq.document||jsonb_build_object('status',case when permission='complete' then 'completed' else 'failed' end,'lease',null);
  elsif permission in ('retry','revise') then
   if job=o.current_job_id then raise exception 'HDA job ID must change' using errcode='HDJ04';end if;
   expected_event:=expected_event||jsonb_build_object('type',case when permission='retry' then 'retry_analysis' else 'input_revised' end);if permission='revise' then expected_event:=expected_event||jsonb_build_object('snapshot',c->'snapshot');end if;
   expected_queue:=jsonb_build_object('schema',1,'jobId',c->'jobId','operationId',op,'inputRevision',snap->'inputRevision','requestHash',snap->'requestHash','kind','analysis','configuration',oldq.document->'configuration','status','queued','attempts',0,'lease',null);
  else expected_event:=expected_event||jsonb_build_object('type','cancel_analysis');expected_queue:=oldq.document||jsonb_build_object('status','cancelled','lease',null);end if;
  if ev is distinct from expected_event then raise exception 'HDA event differs from command' using errcode='HDJ05';end if;
 end if;
 if n is distinct from expected_state or q is distinct from expected_queue then raise exception 'HDA state or queue differs from decision' using errcode='HDJ05';end if;
 if permission='prepare' then
  insert into helpdesk_integration.hda02_operations(workspace_id,account_id,binding_id,id,ticket_id,revision,state,state_hash,queue_hash,current_job_id,input_revision) values(w,a,bid,op,(s->>'ticketId')::uuid,rev,n,helpdesk_auth.hda02_hash(n),helpdesk_auth.hda02_hash(q),job,(snap->>'inputRevision')::bigint);
 else
  update helpdesk_integration.hda02_operations set revision=rev,state=n,state_hash=helpdesk_auth.hda02_hash(n),queue_hash=helpdesk_auth.hda02_hash(q),current_job_id=job,input_revision=(snap->>'inputRevision')::bigint where workspace_id=w and id=op and revision=expected;
 end if;
 get diagnostics count_rows=row_count;if count_rows<>1 then raise exception 'HDA operation write incomplete' using errcode='HDJ05';end if;
 select document into old_snapshot from helpdesk_integration.hda02_snapshots where workspace_id=w and operation_id=op and input_revision=(snap->>'inputRevision')::bigint;
 if found then if old_snapshot is distinct from snap then raise exception 'HDA snapshot conflict' using errcode='HDJ04';end if;
 else
  insert into helpdesk_integration.hda02_snapshots values(w,op,(snap->>'inputRevision')::bigint,snap,snap->>'requestHash');get diagnostics count_rows=row_count;if count_rows<>1 then raise exception 'HDA snapshot write incomplete' using errcode='HDJ05';end if;
 end if;
 if permission='prepare' or job is distinct from oldq.id then
  if oldq.id is not null then update helpdesk_integration.hda02_jobs set status='superseded',lease_until=null,document=document||jsonb_build_object('status','superseded','lease',null) where workspace_id=w and id=oldq.id;get diagnostics count_rows=row_count;if count_rows<>1 then raise exception 'HDA prior job write incomplete' using errcode='HDJ05';end if;end if;
  insert into helpdesk_integration.hda02_jobs values(w,op,job,(snap->>'inputRevision')::bigint,q,q->>'status',case when q->>'status'='leased' then (q->'lease'->>'expiresAt')::timestamptz else null end);
 else update helpdesk_integration.hda02_jobs set document=q,status=q->>'status',lease_until=case when q->>'status'='leased' then (q->'lease'->>'expiresAt')::timestamptz else null end where workspace_id=w and id=job;end if;
 get diagnostics count_rows=row_count;if count_rows<>1 then raise exception 'HDA job write incomplete' using errcode='HDJ05';end if;
 if n->'draft' is distinct from 'null'::jsonb then
  insert into helpdesk_integration.hda02_drafts values(w,op,(n->>'draftRevision')::bigint,(snap->>'inputRevision')::bigint,job,n->'draft',n->'draft'->>'contentHash');get diagnostics count_rows=row_count;if count_rows<>1 then raise exception 'HDA draft write incomplete' using errcode='HDJ05';end if;
 end if;
 at_time:=clock_timestamp();receipt:=jsonb_build_object('schema',1,'commandId',cmd,'commandHash',b->'commandHash','permission',permission,'workspaceId',w,'accountId',a,'actorId',actor,'bindingId',bid,'operationId',op,'operationRevision',rev,'stateHash',helpdesk_auth.hda02_hash(n),'jobId',job,'fence',fence,'status',n->'status','recordedAt',helpdesk_auth.hda02_instant(at_time));
 insert into helpdesk_integration.hda02_inbox(workspace_id,account_id,principal_id,command_id,binding_id,operation_id,command_hash,receipt,event,analysis,scope,lease_deadline) values(w,a,actor,cmd,bid,op,b->>'commandHash',receipt,nullif(ev,'null'::jsonb),nullif(an,'null'::jsonb),s,lease_deadline);
 get diagnostics count_rows=row_count;if count_rows<>1 then raise exception 'HDA receipt write incomplete' using errcode='HDJ05';end if;
 perform helpdesk_auth.hda02_reauthorize(s);return receipt;
end $$;

create function helpdesk_auth.hda02_immutable() returns trigger language plpgsql set search_path='' as $$begin raise exception 'HDA history is immutable' using errcode='HDJ05';end $$;
create trigger hda02_snapshot_immutable before update or delete on helpdesk_integration.hda02_snapshots for each row execute function helpdesk_auth.hda02_immutable();
create trigger hda02_draft_immutable before update or delete on helpdesk_integration.hda02_drafts for each row execute function helpdesk_auth.hda02_immutable();
create trigger hda02_inbox_immutable before update or delete on helpdesk_integration.hda02_inbox for each row execute function helpdesk_auth.hda02_immutable();
create function helpdesk_auth.hda02_assert_operation(w uuid,op uuid) returns void language plpgsql security definer set search_path='' as $$
declare o helpdesk_integration.hda02_operations%rowtype;q helpdesk_integration.hda02_jobs%rowtype;doc jsonb;expected_status text;
begin
 select * into strict o from helpdesk_integration.hda02_operations where workspace_id=w and id=op;
 select * into strict q from helpdesk_integration.hda02_jobs where workspace_id=w and operation_id=op and id=o.current_job_id;
 select document into strict doc from helpdesk_integration.hda02_snapshots where workspace_id=w and operation_id=op and input_revision=o.input_revision;
 if o.queue_hash is distinct from helpdesk_auth.hda02_hash(q.document) or o.state->'snapshot' is distinct from doc or o.state_hash is distinct from helpdesk_auth.hda02_hash(o.state) or (o.state->>'revision')::bigint<>o.revision or q.document->'operationId' is distinct from doc->'operationId' or q.document->'inputRevision' is distinct from doc->'inputRevision' or q.document->'requestHash' is distinct from doc->'requestHash' then raise exception 'HDA operation invariant' using errcode='HDJ05';end if;
 expected_status:=case o.state->>'status' when 'queued_analysis' then 'queued' when 'analyzing' then 'leased' when 'draft_ready' then 'completed' when 'needs_information' then 'completed' when 'manual_review' then 'completed' when 'analysis_failed' then 'failed' when 'cancelled' then 'cancelled' else null end;
 if expected_status is null or q.status is distinct from expected_status then raise exception 'HDA queue invariant' using errcode='HDJ05';end if;
 if o.state->>'status'='draft_ready' and not exists(select 1 from helpdesk_integration.hda02_drafts where workspace_id=w and operation_id=op and draft_revision=(o.state->>'draftRevision')::bigint and document=o.state->'draft') then raise exception 'HDA draft invariant' using errcode='HDJ05';end if;
 if not exists(select 1 from helpdesk_integration.hda02_inbox i where i.workspace_id=w and i.operation_id=op and i.receipt->>'operationRevision'=o.revision::text and i.receipt->>'stateHash'=o.state_hash) then raise exception 'HDA receipt invariant' using errcode='HDJ05';end if;
end $$;
create function helpdesk_auth.hda02_operation_admission() returns trigger language plpgsql security definer set search_path='' as $$begin perform helpdesk_auth.hda02_assert_operation(new.workspace_id,new.id);return null;end $$;
create function helpdesk_auth.hda02_job_admission() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' then perform helpdesk_auth.hda02_assert_operation(old.workspace_id,old.operation_id);
 else
  perform helpdesk_auth.hda02_assert_operation(new.workspace_id,new.operation_id);
  if tg_op='UPDATE' and (new.workspace_id,new.operation_id) is distinct from (old.workspace_id,old.operation_id) then perform helpdesk_auth.hda02_assert_operation(old.workspace_id,old.operation_id);end if;
 end if;return null;
end $$;
create function helpdesk_auth.hda02_inbox_admission() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.transaction_id<>pg_current_xact_id() then raise exception 'HDA transaction mismatch' using errcode='HDJ05';end if;
 perform helpdesk_auth.hda02_reauthorize(new.scope);
 if new.lease_deadline is not null and new.lease_deadline<=clock_timestamp() then raise exception 'HDA lease expired before commit' using errcode='HDJ03';end if;
 perform helpdesk_auth.hda02_assert_operation(new.workspace_id,new.operation_id);return null;
end $$;
create constraint trigger hda02_operation_complete after insert or update on helpdesk_integration.hda02_operations deferrable initially deferred for each row execute function helpdesk_auth.hda02_operation_admission();
create constraint trigger hda02_job_complete after insert or update or delete on helpdesk_integration.hda02_jobs deferrable initially deferred for each row execute function helpdesk_auth.hda02_job_admission();
create constraint trigger hda02_inbox_complete after insert on helpdesk_integration.hda02_inbox deferrable initially deferred for each row execute function helpdesk_auth.hda02_inbox_admission();

-- Direct access is denied, including SELECT. Only the five scoped helpers are
-- entry points. The migration owner is deliberately distinct and BYPASSRLS.
alter table helpdesk_integration.hda02_bindings enable row level security;
alter table helpdesk_integration.hda02_bindings force row level security;
alter table helpdesk_integration.hda02_grants enable row level security;
alter table helpdesk_integration.hda02_grants force row level security;
alter table helpdesk_integration.hda02_operations enable row level security;
alter table helpdesk_integration.hda02_operations force row level security;
alter table helpdesk_integration.hda02_snapshots enable row level security;
alter table helpdesk_integration.hda02_snapshots force row level security;
alter table helpdesk_integration.hda02_jobs enable row level security;
alter table helpdesk_integration.hda02_jobs force row level security;
alter table helpdesk_integration.hda02_drafts enable row level security;
alter table helpdesk_integration.hda02_drafts force row level security;
alter table helpdesk_integration.hda02_inbox enable row level security;
alter table helpdesk_integration.hda02_inbox force row level security;
do $private_acl$ declare r record;begin
 for r in select oid::regprocedure as signature from pg_proc where pronamespace='helpdesk_auth'::regnamespace and proname like 'hda02\_%' escape '\' loop execute format('revoke all on function %s from public',r.signature);end loop;
 for r in select oid::regclass as relation from pg_class where relnamespace='helpdesk_integration'::regnamespace and relname like 'hda02\_%' escape '\' and relkind='r' loop execute format('revoke all on table %s from public',r.relation);end loop;
end $private_acl$;
grant usage on schema helpdesk_auth to helpdesk_registration_worker;
grant execute on function helpdesk_auth.hda02_lock_scope(jsonb),helpdesk_auth.hda02_receipt(jsonb,uuid),helpdesk_auth.hda02_operation(jsonb,uuid),helpdesk_auth.hda02_next(jsonb),helpdesk_auth.hda02_apply(jsonb,jsonb) to helpdesk_app,helpdesk_registration_worker;
-- Unexpected inherited/default grants are an installation error, not silently
-- adopted privileges. Verify all new table/function ACLs before COMMIT.
do $final_acl$ declare r record;begin
 for r in select c.oid,c.relowner,c.relacl from pg_class c where c.relnamespace='helpdesk_integration'::regnamespace and c.relname like 'hda02\_%' escape '\' and c.relkind='r' loop
  if exists(select 1 from aclexplode(coalesce(r.relacl,acldefault('r',r.relowner))) x where x.grantee<>r.relowner) then raise exception 'Unexpected HDA table grant' using errcode='HDJ05';end if;
 end loop;
 for r in select p.oid,p.proname,p.proowner,p.proacl from pg_proc p where p.pronamespace='helpdesk_auth'::regnamespace and p.proname like 'hda02\_%' escape '\' loop
  if exists(select 1 from aclexplode(coalesce(r.proacl,acldefault('f',r.proowner))) x where x.grantee<>r.proowner and not(r.proname in ('hda02_lock_scope','hda02_receipt','hda02_operation','hda02_next','hda02_apply') and x.grantee in ('helpdesk_app'::regrole,'helpdesk_registration_worker'::regrole) and x.privilege_type='EXECUTE' and not x.is_grantable)) then raise exception 'Unexpected HDA function grant' using errcode='HDJ05';end if;
 end loop;
end $final_acl$;
commit;
