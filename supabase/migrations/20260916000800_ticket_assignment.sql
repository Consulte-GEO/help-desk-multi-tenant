-- v0.9.0 candidate: responsibility is coordination, never an authorization grant.
-- No remote execution. Validate fresh and 0.8.0 upgrade with PostgreSQL 17.
begin;
do $$begin
 if helpdesk_auth.schema_version()<>'0.8.0' then raise exception 'Expected schema 0.8.0'; end if;
end$$;
alter table helpdesk_core.tickets add column assigned_to uuid references helpdesk_auth.principals(id);
grant update(assigned_to) on helpdesk_core.tickets to helpdesk_app;

-- The principal FK is global; self-only/live-operator checks below enforce the workspace.
-- Do not link to workspace_memberships: an account-scoped agent need not be a workspace member.
create function helpdesk_core.guard_ticket_assignment() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  if new.assigned_to is not null then raise exception 'Initial assignment not allowed' using errcode='23514'; end if;
  return new;
 end if;
 if new.assigned_to is not distinct from old.assigned_to then return new; end if;
 if not coalesce(helpdesk_auth.is_operator(old.workspace_id,old.account_id)
   and helpdesk_auth.has_scope(old.workspace_id,'tickets:read')
   and helpdesk_auth.has_scope(old.workspace_id,'tickets:write'),false) then
  raise exception 'Assignment not authorized' using errcode='42501';
 end if;
 if old.status in ('closed','cancelled') or new.status is distinct from old.status
    or new.priority is distinct from old.priority then
  raise exception 'Assignment must be an isolated nonterminal change' using errcode='23514';
 end if;
 if new.assigned_to is not null then
  if old.assigned_to is not null or new.assigned_to is distinct from helpdesk_auth.actor_id() then
   raise exception 'Only an unassigned ticket may be claimed by self' using errcode='42501';
  end if;
 elsif old.assigned_to is distinct from helpdesk_auth.actor_id() and not exists(
  select 1 from helpdesk_auth.workspace_memberships m
   where m.workspace_id=old.workspace_id and m.principal_id=helpdesk_auth.actor_id() and m.active and m.role='admin'
 ) then
  raise exception 'Only owner or workspace administrator may release' using errcode='42501';
 end if;
 return new;
end$$;
create trigger authorized_ticket_assignment before insert or update on helpdesk_core.tickets
 for each row execute function helpdesk_core.guard_ticket_assignment();
revoke all on function helpdesk_core.guard_ticket_assignment() from public;

alter table helpdesk_core.ticket_events drop constraint event_visibility_kind;
alter table helpdesk_core.ticket_events add constraint event_visibility_kind check(
 (type in ('ticket.created','message.created','ticket.status_changed','ticket.priority_changed') and customer_visible) or
 (type in ('note.created','ticket.assignment_changed') and not customer_visible));
alter table helpdesk_core.ticket_events add constraint assignment_event_shape check(
 type<>'ticket.assignment_changed' or coalesce(
  jsonb_typeof(data)='object' and (data-array['action','from','to','reason','version'])='{}'::jsonb
  and data ?& array['action','from','to','reason','version']
  and jsonb_typeof(data->'reason')='string' and length(btrim(data->>'reason')) between 1 and 2000
  and length(data->>'reason')<=2000 and (data->>'reason') !~ '[[:cntrl:]]'
  and ((data->>'action'='claim' and data->'from'='null'::jsonb and jsonb_typeof(data->'to')='string'
      and data->>'to'=actor_id::text)
   or (data->>'action'='release' and data->'to'='null'::jsonb and jsonb_typeof(data->'from')='string'
      and (data->>'from') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'))
  and case when jsonb_typeof(data->'version')='number' then
   (data->>'version')::numeric between 2 and 9007199254740991
    and (data->>'version')::numeric=trunc((data->>'version')::numeric) else false end,false));
create unique index assignment_event_version on helpdesk_core.ticket_events(workspace_id,ticket_id,(data->>'version'))
 where type='ticket.assignment_changed';
-- Only this private operational event uses tickets:write instead of notes:write. Note rules stay unchanged.
drop policy event_scope_insert on helpdesk_core.ticket_events;
create policy event_scope_insert on helpdesk_core.ticket_events as restrictive for insert to helpdesk_app
 with check((customer_visible and helpdesk_auth.has_scope(workspace_id,'tickets:write'))
  or (not customer_visible and helpdesk_auth.is_operator(workspace_id,account_id) and
   ((type='note.created' and helpdesk_auth.has_scope(workspace_id,'notes:write')) or
    (type='ticket.assignment_changed' and helpdesk_auth.has_scope(workspace_id,'tickets:read')
     and helpdesk_auth.has_scope(workspace_id,'tickets:write')))));
alter table helpdesk_integration.outbox_events add constraint assignment_outbox_forbidden check(type<>'ticket.assignment_changed');

create function helpdesk_core.require_assignment_event() returns trigger
language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from helpdesk_core.ticket_events e
  where (e.workspace_id,e.account_id,e.ticket_id)=(new.workspace_id,new.account_id,new.id)
   and e.type='ticket.assignment_changed' and not e.customer_visible
   and e.actor_id=helpdesk_auth.actor_id() and e.data->>'version'=new.version::text
   and (e.data->>'from') is not distinct from old.assigned_to::text
   and (e.data->>'to') is not distinct from new.assigned_to::text
   and e.data->>'action'=case when new.assigned_to is null then 'release' else 'claim' end
 ) then raise exception 'Assignment update requires matching private event' using errcode='23514'; end if;
 return null;
end$$;
create constraint trigger ticket_assignment_event after update on helpdesk_core.tickets
 deferrable initially deferred for each row when (old.assigned_to is distinct from new.assigned_to)
 execute function helpdesk_core.require_assignment_event();
revoke all on function helpdesk_core.require_assignment_event() from public;

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
   or (op like 'notes.create:%' and (not helpdesk_auth.has_scope(t.workspace_id,'notes:read')
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

create or replace function helpdesk_auth.limit_idempotency_records() returns trigger
language plpgsql security definer set search_path='' as $$
declare target uuid; t helpdesk_core.tickets%rowtype;
begin
 -- Bind to the real resource, never accept client-provided cache authorization.
 if new.operation='tickets.create' then target:=(new.result->>'id')::uuid;
 elsif new.operation ~ '^(messages|notes|transitions)\.create:[a-f0-9-]{36}$' then
  target:=split_part(new.operation,':',2)::uuid;
  if target is distinct from (case when new.operation like 'transitions.create:%' then new.result->>'id' else new.result->>'ticketId' end)::uuid then
   raise exception 'Cache resource mismatch' using errcode='23514';
  end if;
 elsif new.operation ~ '^(priority|assignments)\.change:[a-f0-9-]{36}$' then
  target:=split_part(new.operation,':',2)::uuid;
  if target is distinct from (new.result->>'id')::uuid then
   raise exception 'Cache resource mismatch' using errcode='23514';
  end if;
 else raise exception 'Unsupported idempotency operation' using errcode='23514';
 end if;
 select * into t from helpdesk_core.tickets where workspace_id=new.workspace_id and id=target;
 if not found then raise exception 'Unknown cache resource' using errcode='23503'; end if;
 if (new.operation like 'priority.change:%' or new.operation like 'assignments.change:%') and (not helpdesk_auth.is_operator(t.workspace_id,t.account_id)
    or not helpdesk_auth.has_scope(t.workspace_id,'tickets:write')) then
  raise exception 'Operator cache not authorized' using errcode='42501';
 end if;
 new.resource_ticket_id:=t.id;new.account_id:=t.account_id;
 -- Ignore caller-supplied lifecycle dates. Runtime does not receive UPDATE/DELETE.
 new.created_at:=clock_timestamp();new.response_expires_at:=new.created_at+interval '7 days';new.purge_after:=new.created_at+interval '90 days';
 if new.result is null then raise exception 'New idempotency response is required' using errcode='23514'; end if;
 perform pg_advisory_xact_lock(hashtextextended('helpdesk-idem-quota:'||new.workspace_id::text||':'||new.principal_id::text,0));
 if (select count(*) from helpdesk_integration.api_idempotency_keys
     where workspace_id=new.workspace_id and principal_id=new.principal_id and response_expires_at>clock_timestamp())>=5000 then
  raise exception 'Idempotency quota reached' using errcode='PHD02';
 end if;
 return new;
end$$;

revoke all on function helpdesk_auth.limit_idempotency_records() from public;

do $client_grants$ declare r text; f text;begin
 foreach r in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=r) then
   foreach f in array array['helpdesk_core.guard_ticket_assignment()','helpdesk_core.require_assignment_event()',
    'helpdesk_auth.lookup_idempotency(text,text)','helpdesk_auth.limit_idempotency_records()'] loop
    execute format('revoke all on function %s from %I',f,r);
   end loop;
  end if;
 end loop;
end $client_grants$;
create or replace function helpdesk_auth.schema_version() returns text language sql immutable set search_path='' as $$select '0.9.0'::text$$;
revoke all on function helpdesk_auth.schema_version() from public;
grant execute on function helpdesk_auth.schema_version() to helpdesk_app;
commit;
