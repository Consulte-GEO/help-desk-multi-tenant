-- CG03g PRIVATE PUBLICATION CANDIDATE. NOT a migration or a hosted installer.
-- Requires the existing owned PG17 fixture, D then E candidates, and an approved
-- test administrator. No normal request role receives publication privileges.
do $candidate$
begin
 if current_setting('app.cg03g_candidate',true) is distinct from 'disposable-pg17'
  or current_database()<>'helpdesk_test'
  or current_setting('server_version_num')::integer not between 170000 and 179999
  or to_regclass('helpdesk_auth.cg_resource_observations') is null
  or not exists(select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls)) then
  raise exception 'CG03g requires its owned disposable PostgreSQL17 fixture' using errcode='42501';
 end if;
 if exists(select 1 from pg_roles where rolname='helpdesk_resource_publisher') then
  raise exception 'Use a fresh cluster; existing publication role is not adopted' using errcode='42501';
 end if;
 create role helpdesk_resource_publisher nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
end $candidate$;

-- The migration/test administrator alone provisions a qualified source connection.
-- Presence/fingerprint do not themselves qualify the real provider or create an identity.
create table helpdesk_auth.cg_resource_publishers(
 workspace_id uuid not null,connection_id uuid not null,
 manifest_fingerprint text not null check(manifest_fingerprint ~ '^[a-f0-9]{64}$'),
 active boolean not null default false,
 primary key(workspace_id,connection_id),
 foreign key(workspace_id,connection_id) references helpdesk_auth.cg_resource_connections(workspace_id,id)
);
create table helpdesk_auth.cg_resource_publication_states(
 workspace_id uuid not null,account_id uuid not null,binding_id uuid not null,principal_id uuid not null,operation text not null,
 grant_revision bigint not null check(grant_revision>0),previous_revision bigint not null check(previous_revision>=0),
 snapshot jsonb not null check(jsonb_typeof(snapshot)='object'),snapshot_hash text not null check(snapshot_hash ~ '^[a-f0-9]{64}$'),
 publication_key text not null,command_hash text not null check(command_hash ~ '^[a-f0-9]{64}$'),target_hash text not null check(target_hash ~ '^[a-f0-9]{64}$'),
 publication_xid xid8 not null,
 primary key(workspace_id,account_id,binding_id,principal_id,operation),
 foreign key(workspace_id,account_id,binding_id,principal_id,operation)
  references helpdesk_auth.cg_resource_grant_sets(workspace_id,account_id,binding_id,principal_id,operation),
 check(grant_revision>previous_revision)
);
-- One append-only row is both the historical receipt and the publication audit.
-- No ticket payload, secret, bearer, email or external notification is recorded.
create table helpdesk_auth.cg_resource_publication_ledger(
 workspace_id uuid not null,account_id uuid not null,binding_id uuid not null,principal_id uuid not null,operation text not null,
 publication_key text not null check(publication_key ~ '^[A-Za-z0-9._:-]{16,128}$'),
 receipt jsonb not null check(jsonb_typeof(receipt)='object'),
 publication_xid xid8 not null default pg_current_xact_id(),
 recorded_by name not null default session_user,recorded_at timestamptz not null default clock_timestamp(),
 primary key(workspace_id,account_id,binding_id,principal_id,operation,publication_key),
 foreign key(workspace_id,account_id,binding_id,principal_id,operation)
  references helpdesk_auth.cg_resource_grant_sets(workspace_id,account_id,binding_id,principal_id,operation)
);

create function helpdesk_auth.cg_publication_target(target_text text,intent text) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare v jsonb;k text;r record;
begin
 if session_user<>'helpdesk_resource_publisher' or not exists(
  select 1 from pg_roles p where p.rolname=session_user and not p.rolsuper and not p.rolbypassrls
   and not p.rolcreaterole and not p.rolcreatedb and not p.rolinherit
   and not exists(select 1 from pg_auth_members m where m.member=p.oid)
   and not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relowner=p.oid and n.nspname like 'helpdesk_%')
 ) then raise exception 'Publisher not authorized' using errcode='PGR02'; end if;
 if target_text is null or octet_length(target_text)>8192 or intent is null or intent !~ '^[A-Za-z0-9._:-]{16,128}$' then
  raise exception 'Invalid publication target' using errcode='PGR03'; end if;
 v:=target_text::jsonb;
 if jsonb_typeof(v)<>'object' or (select count(*) from jsonb_object_keys(v))<>7 then
  raise exception 'Invalid publication target' using errcode='PGR03'; end if;
 foreach k in array array['principalId','workspaceId','accountId','bindingId','connectionId','tenantId','operation'] loop
  if jsonb_typeof(v->k) is distinct from 'string' then raise exception 'Invalid publication target' using errcode='PGR03'; end if;
 end loop;
 foreach k in array array['principalId','workspaceId','accountId','bindingId','connectionId'] loop
  if (v->>k) !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
   raise exception 'Invalid publication identifier' using errcode='PGR03'; end if;
 end loop;
 if v->>'operation' not in ('tickets.read','tickets.write','notes.read','notes.write')
  or length(v->>'tenantId') not between 1 and 256 or btrim(v->>'tenantId')<>v->>'tenantId'
  or v->>'tenantId' ~ '[[:cntrl:]]' then raise exception 'Invalid publication namespace' using errcode='PGR03'; end if;
 -- Numeric target selectors are already canonical; the lock identity uses parsed
 -- fields/JSONB, not a caller-provided hash. It also serializes a missing grant row.
 -- Hash collisions may serialize unrelated targets, never merge them or grant access.
 perform pg_advisory_xact_lock(hashtextextended('cg-publication-v1:'||v::text,0));
 select c.id into r from helpdesk_auth.cg_resource_connections c
 join helpdesk_auth.cg_resource_publishers q on q.workspace_id=c.workspace_id and q.connection_id=c.id
 join helpdesk_auth.cg_resource_bindings b on b.workspace_id=c.workspace_id and b.connection_id=c.id
 join helpdesk_auth.principals p on p.id=(v->>'principalId')::uuid
 where c.workspace_id=(v->>'workspaceId')::uuid and c.id=(v->>'connectionId')::uuid
  and b.account_id=(v->>'accountId')::uuid and b.id=(v->>'bindingId')::uuid and b.tenant_id=v->>'tenantId'
  and c.active and b.active and q.active and p.active and p.kind='human'
  and (exists(select 1 from helpdesk_auth.account_grants ag where ag.workspace_id=c.workspace_id and ag.account_id=b.account_id and ag.principal_id=p.id and ag.active)
   or exists(select 1 from helpdesk_auth.workspace_memberships m where m.workspace_id=c.workspace_id and m.principal_id=p.id and m.role='admin' and m.active))
 for share of c,q,b,p;
 if not found then raise exception 'Publisher mapping not authorized' using errcode='PGR02'; end if;
 return v;
exception when invalid_text_representation or invalid_parameter_value then
 raise exception 'Invalid publication target' using errcode='PGR03';
end$$;

create function helpdesk_auth.cg_publication_open(target_text text,intent text) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare v jsonb;g helpdesk_auth.cg_resource_grant_sets%rowtype;s helpdesk_auth.cg_resource_publication_states%rowtype;v_receipt jsonb;
begin
 v:=helpdesk_auth.cg_publication_target(target_text,intent);
 -- Immutable historical receipt is checked before current-state freshness. It is
 -- not authorization to use an old grant. The current source still qualifies the call.
 select l.receipt into v_receipt from helpdesk_auth.cg_resource_publication_ledger l
 where l.workspace_id=(v->>'workspaceId')::uuid and l.account_id=(v->>'accountId')::uuid and l.binding_id=(v->>'bindingId')::uuid
  and l.principal_id=(v->>'principalId')::uuid and l.operation=v->>'operation' and l.publication_key=intent;
 if found then return jsonb_build_object('receipt',v_receipt,'current',null); end if;
 select * into g from helpdesk_auth.cg_resource_grant_sets x
 where x.workspace_id=(v->>'workspaceId')::uuid and x.account_id=(v->>'accountId')::uuid and x.binding_id=(v->>'bindingId')::uuid
  and x.principal_id=(v->>'principalId')::uuid and x.operation=v->>'operation' for update;
 if not found then return jsonb_build_object('receipt',null,'current',jsonb_build_object('revision','0','snapshot',null)); end if;
 select * into s from helpdesk_auth.cg_resource_publication_states x
 where x.workspace_id=g.workspace_id and x.account_id=g.account_id and x.binding_id=g.binding_id and x.principal_id=g.principal_id and x.operation=g.operation;
 if not found then raise exception 'Existing grant requires explicit reconciliation' using errcode='PGR01'; end if;
 if s.grant_revision<>g.revision or s.snapshot->'target'<>v
  or (s.snapshot->>'asOf')::timestamptz<>g.as_of or (s.snapshot->>'expiresAt')::timestamptz<>g.expires_at
  or s.snapshot->>'accessRevision'<>g.source_revision or (s.snapshot->>'state'='active')<>g.active
  or jsonb_array_length(s.snapshot->'resources')<>g.expected_count
  or (select count(*) from helpdesk_auth.cg_resource_grant_refs x where x.workspace_id=g.workspace_id and x.account_id=g.account_id and x.binding_id=g.binding_id and x.principal_id=g.principal_id and x.operation=g.operation)<>g.expected_count
  or exists(select 1 from helpdesk_auth.cg_resource_grant_refs x where x.workspace_id=g.workspace_id and x.account_id=g.account_id and x.binding_id=g.binding_id and x.principal_id=g.principal_id and x.operation=g.operation
   and not exists(select 1 from jsonb_array_elements(s.snapshot->'resources') j where j->>'type'=x.resource_type and j->>'id'=x.resource_id)) then
  raise exception 'Stored publication and current grant disagree' using errcode='PGR01';
 end if;
 return jsonb_build_object('receipt',null,'current',jsonb_build_object('revision',g.revision::text,'snapshot',s.snapshot));
end$$;

create function helpdesk_auth.cg_publication_replace(target_text text,intent text,expected text,snapshot_text text,snapshot_hash text) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare v jsonb;opened jsonb;old_snapshot jsonb;n jsonb;j jsonb;k text;start_at timestamptz;end_at timestamptz;
 count_refs integer;old_revision bigint;new_revision bigint;configured_fingerprint text;command_digest text;target_digest text;
begin
 v:=helpdesk_auth.cg_publication_target(target_text,intent);
 opened:=helpdesk_auth.cg_publication_open(target_text,intent);
 if opened->'receipt'<>'null'::jsonb then raise exception 'Publication intent already recorded' using errcode='PGR01'; end if;
 if expected is null or expected !~ '^(0|[1-9][0-9]{0,18})$' then raise exception 'Invalid publication revision' using errcode='PGR03'; end if;
 old_revision:=expected::bigint;
 if old_revision=9223372036854775807 or opened->'current'->>'revision'<>expected then
  raise exception 'Publication revision changed' using errcode='PGR01'; end if;
 if snapshot_text is null or octet_length(snapshot_text)>4194304 or snapshot_hash is null
  or snapshot_hash !~ '^[a-f0-9]{64}$'
  or encode(sha256(convert_to(snapshot_text,'UTF8')),'hex')<>snapshot_hash then
  raise exception 'Invalid publication snapshot digest' using errcode='PGR03'; end if;
 n:=snapshot_text::jsonb;
 if jsonb_typeof(n)<>'object' or (select count(*) from jsonb_object_keys(n))<>9
  or n->'target' is distinct from v or n->'complete' is distinct from 'true'::jsonb
  or jsonb_typeof(n->'resources') is distinct from 'array' then
  raise exception 'Incomplete publication snapshot' using errcode='PGR03'; end if;
 foreach k in array array['manifestFingerprint','bindingRevision','accessRevision','asOf','expiresAt','state'] loop
  if jsonb_typeof(n->k) is distinct from 'string' then raise exception 'Invalid snapshot metadata' using errcode='PGR03'; end if;
 end loop;
 foreach k in array array['bindingRevision','accessRevision'] loop
  if length(n->>k) not between 1 and 256 or btrim(n->>k)<>n->>k or n->>k ~ '[[:cntrl:]]' then
   raise exception 'Invalid source revision' using errcode='PGR03'; end if;
 end loop;
 if n->>'state' not in ('active','revoked') or n->>'manifestFingerprint' !~ '^[a-f0-9]{64}$' then
  raise exception 'Invalid publication metadata' using errcode='PGR03'; end if;
 select q.manifest_fingerprint into configured_fingerprint from helpdesk_auth.cg_resource_publishers q
 where q.workspace_id=(v->>'workspaceId')::uuid and q.connection_id=(v->>'connectionId')::uuid and q.active;
 if configured_fingerprint is null or configured_fingerprint<>n->>'manifestFingerprint' then
  raise exception 'Source configuration does not match publication' using errcode='PGR02'; end if;
 foreach k in array array['asOf','expiresAt'] loop
  if (n->>k) !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}([0-9]{3})?Z$' then
   raise exception 'Invalid publication instant' using errcode='PGR03'; end if;
  -- Roundtrip prevents Date-style rollover; the database retains microseconds.
  if to_char((n->>k)::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')<>
   case when length(n->>k)=24 then left(n->>k,23)||'000Z' else n->>k end then
   raise exception 'Invalid publication instant' using errcode='PGR03'; end if;
 end loop;
 start_at:=(n->>'asOf')::timestamptz;end_at:=(n->>'expiresAt')::timestamptz;
 if not isfinite(start_at) or not isfinite(end_at) or start_at>clock_timestamp() or end_at<=clock_timestamp() or end_at<=start_at then
  raise exception 'Publication snapshot not current' using errcode='PGR01'; end if;
 count_refs:=jsonb_array_length(n->'resources');
 if count_refs>1000 or (n->>'state'='revoked' and count_refs<>0) then raise exception 'Invalid complete coverage' using errcode='PGR03'; end if;
 for j in select * from jsonb_array_elements(n->'resources') loop
  if jsonb_typeof(j)<>'object' or (select count(*) from jsonb_object_keys(j))<>4
   or j->'connectionId' is distinct from v->'connectionId' or j->'tenantId' is distinct from v->'tenantId'
   or jsonb_typeof(j->'type') is distinct from 'string' or j->>'type' !~ '^[a-z][a-z0-9_]{0,31}$'
   or jsonb_typeof(j->'id') is distinct from 'string' or length(j->>'id') not between 1 and 256
   or btrim(j->>'id')<>j->>'id' or j->>'id' ~ '[[:cntrl:]]' then
   raise exception 'Invalid coverage reference' using errcode='PGR03'; end if;
 end loop;
 if (select count(*) from (select distinct j->>'type',j->>'id' from jsonb_array_elements(n->'resources') j) x)<>count_refs then
  raise exception 'Duplicate coverage reference' using errcode='PGR03'; end if;
 old_snapshot:=opened->'current'->'snapshot';
 if old_snapshot<>'null'::jsonb then
  if old_snapshot->'manifestFingerprint'<>n->'manifestFingerprint' or (old_snapshot->>'asOf')::timestamptz>start_at
   or ((old_snapshot->>'asOf')::timestamptz=start_at and old_snapshot<>n)
   or (old_snapshot->'bindingRevision'=n->'bindingRevision' and old_snapshot->'accessRevision'=n->'accessRevision'
    and (old_snapshot->'state'<>n->'state' or old_snapshot->'resources'<>n->'resources')) then
   raise exception 'Source revision/content changed inconsistently' using errcode='PGR01'; end if;
 end if;
 if old_revision=0 then
  insert into helpdesk_auth.cg_resource_grant_sets(workspace_id,account_id,binding_id,principal_id,operation,source_revision,as_of,expires_at,expected_count,active)
  values((v->>'workspaceId')::uuid,(v->>'accountId')::uuid,(v->>'bindingId')::uuid,(v->>'principalId')::uuid,v->>'operation',n->>'accessRevision',start_at,end_at,count_refs,false);
 end if;
 delete from helpdesk_auth.cg_resource_grant_refs x where x.workspace_id=(v->>'workspaceId')::uuid and x.account_id=(v->>'accountId')::uuid
  and x.binding_id=(v->>'bindingId')::uuid and x.principal_id=(v->>'principalId')::uuid and x.operation=v->>'operation';
 insert into helpdesk_auth.cg_resource_grant_refs(workspace_id,account_id,binding_id,principal_id,operation,resource_type,resource_id)
 select (v->>'workspaceId')::uuid,(v->>'accountId')::uuid,(v->>'bindingId')::uuid,(v->>'principalId')::uuid,v->>'operation',j->>'type',j->>'id'
 from jsonb_array_elements(n->'resources') j;
 -- Existing child triggers advance the revision for every change. Use the actual
 -- resulting revision, do not force old+1 and destroy that history.
 update helpdesk_auth.cg_resource_grant_sets x set revision=x.revision+1,active=n->>'state'='active',source_revision=n->>'accessRevision',
  as_of=start_at,expires_at=end_at,expected_count=count_refs
 where x.workspace_id=(v->>'workspaceId')::uuid and x.account_id=(v->>'accountId')::uuid and x.binding_id=(v->>'bindingId')::uuid
  and x.principal_id=(v->>'principalId')::uuid and x.operation=v->>'operation' returning revision into new_revision;
 if not found or new_revision<=old_revision then raise exception 'Publication replacement was not acknowledged' using errcode='PGR03'; end if;
 if n->>'state'='active' then
  insert into helpdesk_auth.cg_resource_observations(workspace_id,account_id,binding_id,principal_id,operation,grant_revision,binding_revision,access_revision,manifest_fingerprint,as_of,expires_at,expected_count)
  values((v->>'workspaceId')::uuid,(v->>'accountId')::uuid,(v->>'bindingId')::uuid,(v->>'principalId')::uuid,v->>'operation',new_revision,
   n->>'bindingRevision',n->>'accessRevision',n->>'manifestFingerprint',start_at,end_at,count_refs);
 end if;
 target_digest:=encode(sha256(convert_to(target_text,'UTF8')),'hex');
 command_digest:=encode(sha256(convert_to('{"expectedRevision":'||to_json(expected)::text||',"target":'||target_text||'}','UTF8')),'hex');
 insert into helpdesk_auth.cg_resource_publication_states(workspace_id,account_id,binding_id,principal_id,operation,grant_revision,previous_revision,
  snapshot,snapshot_hash,publication_key,command_hash,target_hash,publication_xid)
 values((v->>'workspaceId')::uuid,(v->>'accountId')::uuid,(v->>'bindingId')::uuid,(v->>'principalId')::uuid,v->>'operation',new_revision,old_revision,
  n,snapshot_hash,intent,command_digest,target_digest,pg_current_xact_id())
 on conflict(workspace_id,account_id,binding_id,principal_id,operation) do update set
  grant_revision=excluded.grant_revision,previous_revision=excluded.previous_revision,snapshot=excluded.snapshot,snapshot_hash=excluded.snapshot_hash,
  publication_key=excluded.publication_key,command_hash=excluded.command_hash,target_hash=excluded.target_hash,publication_xid=excluded.publication_xid;
 return jsonb_build_object('revision',new_revision::text,'snapshotHash',snapshot_hash);
exception when invalid_text_representation or invalid_parameter_value or numeric_value_out_of_range or datetime_field_overflow then
 raise exception 'Invalid publication data' using errcode='PGR03';
end$$;

create function helpdesk_auth.cg_publication_append(target_text text,intent text,receipt_text text) returns boolean
language plpgsql volatile security definer set search_path='' as $$
declare v jsonb;s helpdesk_auth.cg_resource_publication_states%rowtype;r jsonb;expected_receipt jsonb;
begin
 v:=helpdesk_auth.cg_publication_target(target_text,intent);
 if receipt_text is null or octet_length(receipt_text)>8192 then raise exception 'Invalid publication receipt' using errcode='PGR03'; end if;
 r:=receipt_text::jsonb;
 select * into s from helpdesk_auth.cg_resource_publication_states x where x.workspace_id=(v->>'workspaceId')::uuid
  and x.account_id=(v->>'accountId')::uuid and x.binding_id=(v->>'bindingId')::uuid and x.principal_id=(v->>'principalId')::uuid
  and x.operation=v->>'operation' for update;
 if not found or s.publication_key<>intent or s.publication_xid<>pg_current_xact_id() then
  raise exception 'No owned publication is staged' using errcode='PGR01'; end if;
 expected_receipt:=jsonb_build_object('key',intent,'commandHash',s.command_hash,'targetHash',s.target_hash,'previousRevision',s.previous_revision::text,
  'revision',s.grant_revision::text,'snapshotHash',s.snapshot_hash,'state',s.snapshot->>'state','resourceCount',jsonb_array_length(s.snapshot->'resources'),
  'asOf',s.snapshot->>'asOf','expiresAt',s.snapshot->>'expiresAt');
 if r is distinct from expected_receipt then raise exception 'Publication receipt does not match the staged effect' using errcode='PGR03'; end if;
 insert into helpdesk_auth.cg_resource_publication_ledger(workspace_id,account_id,binding_id,principal_id,operation,publication_key,receipt)
 values(s.workspace_id,s.account_id,s.binding_id,s.principal_id,s.operation,intent,r);
 return true;
exception when invalid_text_representation or invalid_parameter_value then
 raise exception 'Invalid publication receipt' using errcode='PGR03';
end$$;

create function helpdesk_auth.cg_guard_publication_ledger() returns trigger
language plpgsql set search_path='' as $$
begin
 if tg_op<>'INSERT' then raise exception 'Publication ledger is append-only' using errcode='23514'; end if;
 new.recorded_by:=session_user;new.recorded_at:=clock_timestamp();new.publication_xid:=pg_current_xact_id();return new;
end$$;
create trigger cg_immutable_publication_ledger before insert or update or delete on helpdesk_auth.cg_resource_publication_ledger
 for each row execute function helpdesk_auth.cg_guard_publication_ledger();
create function helpdesk_auth.cg_require_publication_receipt() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.publication_xid<>pg_current_xact_id() or not exists(select 1 from helpdesk_auth.cg_resource_publication_ledger l
  where l.workspace_id=new.workspace_id and l.account_id=new.account_id and l.binding_id=new.binding_id and l.principal_id=new.principal_id
   and l.operation=new.operation and l.publication_key=new.publication_key and l.publication_xid=new.publication_xid
   and l.receipt->>'revision'=new.grant_revision::text and l.receipt->>'snapshotHash'=new.snapshot_hash
   and l.receipt->>'commandHash'=new.command_hash and l.receipt->>'targetHash'=new.target_hash) then
  raise exception 'Publication requires its immutable receipt in the same transaction' using errcode='23514';
 end if;
 return null;
end$$;
create constraint trigger cg_publication_receipt_required after insert or update on helpdesk_auth.cg_resource_publication_states
 deferrable initially deferred for each row execute function helpdesk_auth.cg_require_publication_receipt();

-- Do not grant any direct configuration DML to request or publisher connections.
do $permissions$ declare name text;role_name text;
begin
 foreach name in array array['cg_resource_publishers','cg_resource_publication_states','cg_resource_publication_ledger'] loop
  execute format('alter table helpdesk_auth.%I enable row level security',name);
  execute format('alter table helpdesk_auth.%I force row level security',name);
  execute format('revoke all on table helpdesk_auth.%I from public,helpdesk_app,helpdesk_resource_publisher',name);
  foreach role_name in array array['anon','authenticated','service_role','helpdesk_maintenance'] loop
   if exists(select 1 from pg_roles where rolname=role_name) then execute format('revoke all on table helpdesk_auth.%I from %I',name,role_name); end if;
  end loop;
 end loop;
 foreach name in array array['cg_publication_target(text,text)','cg_publication_open(text,text)','cg_publication_replace(text,text,text,text,text)',
  'cg_publication_append(text,text,text)','cg_guard_publication_ledger()','cg_require_publication_receipt()'] loop
  execute 'revoke all on function helpdesk_auth.'||name||' from public,helpdesk_app,helpdesk_resource_publisher';
  foreach role_name in array array['anon','authenticated','service_role','helpdesk_maintenance'] loop
   if exists(select 1 from pg_roles where rolname=role_name) then execute format('revoke all on function helpdesk_auth.%s from %I',name,role_name); end if;
  end loop;
 end loop;
end $permissions$;
grant usage on schema helpdesk_auth to helpdesk_resource_publisher;
grant execute on function helpdesk_auth.cg_publication_open(text,text),helpdesk_auth.cg_publication_replace(text,text,text,text,text),helpdesk_auth.cg_publication_append(text,text,text) to helpdesk_resource_publisher;
