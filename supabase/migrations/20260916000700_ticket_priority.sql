-- v0.8.0 candidate. No new tables; no remote execution was performed by generating this file.
-- Apply to a disposable PostgreSQL 17 and review grants/RLS before use with client data.
begin;
do $$begin
 if helpdesk_auth.schema_version() <> '0.5.0' then
  raise exception 'Expected schema 0.5.0 before priority migration';
 end if;
end$$;
grant update(priority) on helpdesk_core.tickets to helpdesk_app;

-- Existing identity/version/status guards remain. This guard never bypasses RLS.
create function helpdesk_core.guard_ticket_priority() returns trigger
language plpgsql set search_path='' as $$begin
 if new.priority is not distinct from old.priority then return new; end if;
 if not helpdesk_auth.is_operator(old.workspace_id,old.account_id)
   or not helpdesk_auth.has_scope(old.workspace_id,'tickets:read')
   or not helpdesk_auth.has_scope(old.workspace_id,'tickets:write') then
  raise exception 'Priority change not authorized' using errcode='42501';
 end if;
 if old.status in ('closed','cancelled') then
  raise exception 'Terminal ticket priority is immutable' using errcode='23514';
 end if;
 return new;
end$$;
create trigger authorized_ticket_priority before update on helpdesk_core.tickets
 for each row execute function helpdesk_core.guard_ticket_priority();
revoke all on function helpdesk_core.guard_ticket_priority() from public;

alter table helpdesk_core.ticket_events drop constraint event_visibility_kind;
alter table helpdesk_core.ticket_events add constraint event_visibility_kind check(
 (type in ('ticket.created','message.created','ticket.status_changed','ticket.priority_changed') and customer_visible) or
 (type='note.created' and not customer_visible));
-- CHECK treats NULL as accepted, so coalesce deliberately denies absent/malformed attributes.
alter table helpdesk_core.ticket_events add constraint priority_event_shape check(
 type <> 'ticket.priority_changed' or coalesce(
  jsonb_typeof(data)='object'
  and (data-array['from','to','reason','version'])='{}'::jsonb
  and data->>'from' in ('low','normal','high','urgent')
  and data->>'to' in ('low','normal','high','urgent')
  and data->>'from' <> data->>'to'
  and jsonb_typeof(data->'reason')='string'
  and length(btrim(data->>'reason')) between 1 and 2000
  and length(data->>'reason')<=2000
  and (data->>'reason') !~ '[[:cntrl:]]'
  and case when jsonb_typeof(data->'version')='number' then
   (data->>'version')::numeric between 2 and 9007199254740991
   and (data->>'version')::numeric=trunc((data->>'version')::numeric)
   else false end,false));
create policy priority_event_operator on helpdesk_core.ticket_events as restrictive
 for insert to helpdesk_app with check(type <> 'ticket.priority_changed' or
 (helpdesk_auth.is_operator(workspace_id,account_id) and helpdesk_auth.has_scope(workspace_id,'tickets:write')));

-- Reason stays only in the internal event data, never in an outgoing priority envelope.
alter table helpdesk_integration.outbox_events add constraint priority_outbox_shape check(
 type <> 'ticket.priority_changed' or coalesce(
  jsonb_typeof(payload)='object'
  and (payload-array['specversion','id','source','type','subject','time','datacontenttype','data'])='{}'::jsonb
  and payload->>'specversion'='1.0' and payload->>'id'=id::text
  and payload->>'source'='helpdesk/workspaces/'||workspace_id::text
  and payload->>'type'='com.helpdesk.ticket.priority_changed.v1'
  and payload->>'subject'='tickets/'||ticket_id::text
  and payload->>'datacontenttype'='application/json'
  and jsonb_typeof(payload->'time')='string'
  and jsonb_typeof(payload->'data')='object'
  and ((payload->'data') - array['ticket_id','version'])='{}'::jsonb
  and payload->'data'->>'ticket_id'=ticket_id::text
  and jsonb_typeof(payload->'data'->'version')='number',false));

-- The request role has INSERT but no SELECT on outbox. This private trigger can check it.
create function helpdesk_core.require_priority_outbox() returns trigger
language plpgsql security definer set search_path='' as $$begin
 if not exists(
  select 1 from helpdesk_core.ticket_events e
  join helpdesk_integration.outbox_events o
   on (o.workspace_id,o.account_id,o.ticket_id,o.id)=(e.workspace_id,e.account_id,e.ticket_id,e.id)
  where (e.workspace_id,e.account_id,e.ticket_id)=(new.workspace_id,new.account_id,new.id)
   and e.type='ticket.priority_changed' and o.type=e.type and e.customer_visible
   and e.actor_id=helpdesk_auth.actor_id()
   and e.data->>'from'=old.priority and e.data->>'to'=new.priority
   and e.data->>'version'=new.version::text and length(btrim(e.data->>'reason'))>0
   and o.payload->'data'->>'version'=new.version::text
 ) then
  raise exception 'Priority update requires event and outbox' using errcode='23514';
 end if;
 return null;
end$$;
create constraint trigger ticket_priority_outbox after update on helpdesk_core.tickets
 deferrable initially deferred for each row when (old.priority is distinct from new.priority)
 execute function helpdesk_core.require_priority_outbox();
revoke all on function helpdesk_core.require_priority_outbox() from public;

-- Extend the existing live-authorized cache; all lifecycle/quotas are preserved.
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
   or (op like 'priority.change:%' and (not helpdesk_auth.has_scope(t.workspace_id,'tickets:write')
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
 elsif new.operation ~ '^priority\.change:[a-f0-9-]{36}$' then
  target:=split_part(new.operation,':',2)::uuid;
  if target is distinct from (new.result->>'id')::uuid then
   raise exception 'Cache resource mismatch' using errcode='23514';
  end if;
 else raise exception 'Unsupported idempotency operation' using errcode='23514';
 end if;
 select * into t from helpdesk_core.tickets where workspace_id=new.workspace_id and id=target;
 if not found then raise exception 'Unknown cache resource' using errcode='23503'; end if;
 if new.operation like 'priority.change:%' and (not helpdesk_auth.is_operator(t.workspace_id,t.account_id)
    or not helpdesk_auth.has_scope(t.workspace_id,'tickets:write')) then
  raise exception 'Priority cache not authorized' using errcode='42501';
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
-- Clear inherited defaults without granting access to a schema/table or trigger function.
do $client_grants$ declare r text; f text;begin
 foreach r in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=r) then
   foreach f in array array['helpdesk_core.guard_ticket_priority()','helpdesk_core.require_priority_outbox()',
    'helpdesk_auth.lookup_idempotency(text,text)','helpdesk_auth.limit_idempotency_records()'] loop
    execute format('revoke all on function %s from %I',f,r);
   end loop;
  end if;
 end loop;
end $client_grants$;
create or replace function helpdesk_auth.schema_version() returns text language sql immutable set search_path='' as $$select '0.8.0'::text$$;
revoke all on function helpdesk_auth.schema_version() from public;
grant execute on function helpdesk_auth.schema_version() to helpdesk_app;
commit;
