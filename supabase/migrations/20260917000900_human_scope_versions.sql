-- Candidate 0.15.0. Reviewed append-only capability ceiling, NOT a public administration API.
-- Apply only after a disposable PostgreSQL17 fresh/upgrade test. Previous migrations are unchanged.
begin;
create table helpdesk_auth.human_scope_versions (
 workspace_id uuid not null references helpdesk_core.workspaces(id),
 principal_id uuid not null references helpdesk_auth.principals(id),
 revision integer not null,
 scopes text[] not null,
 reason text not null,
 request_id uuid not null,
 changed_by name not null default session_user,
 created_at timestamptz not null default clock_timestamp(),
 primary key(workspace_id,principal_id,revision),
 constraint human_scope_revision_positive check(revision>0),
 constraint human_scope_reason_size check(length(btrim(reason)) between 3 and 1000),
 constraint human_scope_shape check(cardinality(scopes)<=5
  and (cardinality(scopes)=0 or (array_ndims(scopes)=1 and array_lower(scopes,1)=1))
  and array_position(scopes,null) is null
  and scopes <@ array['contexts:resolve','tickets:read','tickets:write','notes:read','notes:write']::text[])
);
alter table helpdesk_auth.human_scope_versions enable row level security;
alter table helpdesk_auth.human_scope_versions force row level security;
revoke all on table helpdesk_auth.human_scope_versions from public,helpdesk_app;
-- No RLS policy or DML grant for helpdesk_app. Only approved provisioning owns this data.

create function helpdesk_auth.guard_human_scope_version() returns trigger
language plpgsql security definer set search_path='' as $$
declare prior_revision integer; distinct_count integer;
begin
 if tg_op<>'INSERT' then
  raise exception 'Capability history is append-only' using errcode='23514';
 end if;
 if new.workspace_id is null or new.principal_id is null or new.scopes is null or new.revision is null
  or new.request_id is null or new.reason is null or length(btrim(new.reason)) not between 3 and 1000 then
  raise exception 'Invalid capability revision' using errcode='22023';
 end if;
 if cardinality(new.scopes)>5 or (cardinality(new.scopes)>0 and (array_ndims(new.scopes)<>1 or array_lower(new.scopes,1)<>1)) then
  raise exception 'Invalid capability list' using errcode='22023';
 end if;
 select count(distinct x)::integer into distinct_count from unnest(new.scopes) x;
 if distinct_count<>cardinality(new.scopes)
  or not (new.scopes <@ array['contexts:resolve','tickets:read','tickets:write','notes:read','notes:write']::text[]) then
  raise exception 'Invalid capability list' using errcode='22023';
 end if;
 if not exists(select 1 from helpdesk_auth.principals p where p.id=new.principal_id and p.kind='human')
  or not (exists(select 1 from helpdesk_auth.workspace_memberships m where m.workspace_id=new.workspace_id and m.principal_id=new.principal_id)
    or exists(select 1 from helpdesk_auth.account_grants g where g.workspace_id=new.workspace_id and g.principal_id=new.principal_id)) then
  raise exception 'Human workspace relationship required' using errcode='42501';
 end if;
 -- Lock before reading the latest revision. Two competing administrators cannot both append N+1.
 perform pg_advisory_xact_lock(hashtextextended('helpdesk-human-scopes:'||new.workspace_id::text||':'||new.principal_id::text,0));
 select coalesce(max(v.revision),0) into prior_revision from helpdesk_auth.human_scope_versions v
  where v.workspace_id=new.workspace_id and v.principal_id=new.principal_id;
 if prior_revision=2147483647 or new.revision is distinct from prior_revision+1 then
  raise exception 'Capability revision conflict; reload before retry' using errcode='40001';
 end if;
 -- Deterministic order; do not add implied capabilities. Empty explicitly revokes everything.
 select coalesce(array_agg(s.value order by s.position),array[]::text[]) into new.scopes
  from unnest(array['contexts:resolve','tickets:read','tickets:write','notes:read','notes:write']::text[]) with ordinality s(value,position)
  where s.value=any(new.scopes);
 new.changed_by:=session_user;new.created_at:=clock_timestamp();
 return new;
end$$;
create trigger human_scope_revision_guard before insert on helpdesk_auth.human_scope_versions
 for each row execute function helpdesk_auth.guard_human_scope_version();
create trigger human_scope_history_immutable before update or delete on helpdesk_auth.human_scope_versions
 for each row execute function helpdesk_auth.guard_human_scope_version();
revoke all on function helpdesk_auth.guard_human_scope_version() from public,helpdesk_app;

create function helpdesk_auth.human_scopes(w uuid,person uuid) returns text[]
language sql stable security definer set search_path='' as $$
 select coalesce((select v.scopes from helpdesk_auth.human_scope_versions v
  where v.workspace_id=w and v.principal_id=person order by v.revision desc limit 1),array[]::text[])
$$;
revoke all on function helpdesk_auth.human_scopes(uuid,uuid) from public,helpdesk_app;

-- SECURITY INVOKER + no EXECUTE grant to app/client roles: never available to the HTTP runtime.
-- Approved provisioning login still needs real table privileges/BYPASSRLS; this function grants none.
create function helpdesk_auth.set_human_scopes(w uuid,subject_id uuid,capabilities text[],expected_revision integer,change_reason text,correlation_id uuid)
returns integer language plpgsql security invoker set search_path='' as $$
begin
 if expected_revision is null or expected_revision<0 or expected_revision=2147483647 then
  raise exception 'Invalid expected capability revision' using errcode='22023';
 end if;
 insert into helpdesk_auth.human_scope_versions(workspace_id,principal_id,revision,scopes,reason,request_id)
  values(w,subject_id,expected_revision+1,capabilities,change_reason,correlation_id);
 return expected_revision+1;
end$$;
revoke all on function helpdesk_auth.set_human_scopes(uuid,uuid,text[],integer,text,uuid) from public,helpdesk_app;

-- One-time compatibility migration: only active humans with existing active relationships.
-- This does not create memberships and does not run automatically for future people/relationships.
insert into helpdesk_auth.human_scope_versions(workspace_id,principal_id,revision,scopes,reason,request_id)
 select links.workspace_id,p.id,1,array['contexts:resolve','tickets:read','tickets:write','notes:read','notes:write']::text[],
  'Migration 009: preserve legacy human capability ceiling',gen_random_uuid()
 from helpdesk_auth.principals p join (
  select workspace_id,principal_id from helpdesk_auth.workspace_memberships where active
  union select workspace_id,principal_id from helpdesk_auth.account_grants where active
 ) links on links.principal_id=p.id where p.active and p.kind='human';

create or replace function helpdesk_auth.resolve_human(user_id uuid,w uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',p.id,'kind','human','workspaceId',w,
  'workspaceRole',(select role from helpdesk_auth.workspace_memberships m where m.workspace_id=w and m.principal_id=p.id and m.active),
  'grants',coalesce((select jsonb_agg(jsonb_build_object('accountId',account_id,'role',role)) from helpdesk_auth.account_grants g where g.workspace_id=w and g.principal_id=p.id and g.active),'[]'::jsonb),
  'scopes',to_jsonb(helpdesk_auth.human_scopes(w,p.id)))
 from helpdesk_auth.principals p where p.supabase_user_id=user_id and p.kind='human' and p.active
  and (exists(select 1 from helpdesk_auth.workspace_memberships m where m.workspace_id=w and m.principal_id=p.id and m.active)
   or exists(select 1 from helpdesk_auth.account_grants g where g.workspace_id=w and g.principal_id=p.id and g.active))
$$;
create or replace function helpdesk_auth.has_scope(w uuid,requested text) returns boolean
language sql stable security definer set search_path='' as $$
 select w=helpdesk_auth.workspace_id() and exists(
  select 1 from helpdesk_auth.principals p where p.id=helpdesk_auth.actor_id() and p.active and (
   (p.kind='human' and requested=any(helpdesk_auth.human_scopes(w,p.id))
    and (exists(select 1 from helpdesk_auth.workspace_memberships m where m.workspace_id=w and m.principal_id=p.id and m.active)
     or exists(select 1 from helpdesk_auth.account_grants g where g.workspace_id=w and g.principal_id=p.id and g.active)))
   or (p.kind='integration' and exists(select 1 from helpdesk_auth.integration_connections c
    where c.workspace_id=w and c.principal_id=p.id and c.active and requested=any(c.scopes)))
  ))
$$;

-- A receipt belongs to its author/command, not the readable notes collection.
create or replace function helpdesk_auth.lookup_idempotency(op text,request_key text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare saved helpdesk_integration.api_idempotency_keys%rowtype; t helpdesk_core.tickets%rowtype;
begin
 select * into saved from helpdesk_integration.api_idempotency_keys
  where workspace_id=helpdesk_auth.workspace_id() and principal_id=helpdesk_auth.actor_id() and operation=op and key=request_key;
 if not found then return null; end if;
 select * into t from helpdesk_core.tickets where workspace_id=saved.workspace_id and id=saved.resource_ticket_id;
 if not found or not helpdesk_auth.has_scope(saved.workspace_id,'tickets:read')
   or not helpdesk_auth.can_read_ticket(t.workspace_id,t.account_id,t.product_instance_id,t.created_by)
   or (op like 'notes.create:%' and (not helpdesk_auth.has_scope(t.workspace_id,'notes:write')
       or not helpdesk_auth.is_operator(t.workspace_id,t.account_id)))
   or ((op like 'priority.change:%' or op like 'assignments.change:%') and (not helpdesk_auth.has_scope(t.workspace_id,'tickets:write')
       or not helpdesk_auth.is_operator(t.workspace_id,t.account_id))) then
  return jsonb_build_object('denied',true);
 end if;
 if saved.response_expires_at<=statement_timestamp() or saved.result is null then
  return jsonb_build_object('expired',true);
 end if;
 return jsonb_build_object('hash',saved.request_hash,'result',saved.result,'expired',false);
end$$;
revoke all on function helpdesk_auth.lookup_idempotency(text,text) from public;
grant execute on function helpdesk_auth.lookup_idempotency(text,text) to helpdesk_app;

revoke all on function helpdesk_auth.resolve_human(uuid,uuid),helpdesk_auth.has_scope(uuid,text) from public;
grant execute on function helpdesk_auth.resolve_human(uuid,uuid),helpdesk_auth.has_scope(uuid,text) to helpdesk_app;
do $client_grants$ declare r text; f text;begin
 foreach r in array array['anon','authenticated','service_role','helpdesk_maintenance'] loop
  if exists(select 1 from pg_roles where rolname=r) then
   execute format('revoke all on table helpdesk_auth.human_scope_versions from %I',r);
   foreach f in array array['helpdesk_auth.guard_human_scope_version()',
    'helpdesk_auth.human_scopes(uuid,uuid)','helpdesk_auth.set_human_scopes(uuid,uuid,text[],integer,text,uuid)',
    'helpdesk_auth.resolve_human(uuid,uuid)','helpdesk_auth.has_scope(uuid,text)','helpdesk_auth.lookup_idempotency(text,text)'] loop
    execute format('revoke all on function %s from %I',f,r);
   end loop;
  end if;
 end loop;
end $client_grants$;
create or replace function helpdesk_auth.schema_version() returns text language sql immutable set search_path='' as $$select '0.15.0'::text$$;
revoke all on function helpdesk_auth.schema_version() from public;
grant execute on function helpdesk_auth.schema_version() to helpdesk_app;
commit;
