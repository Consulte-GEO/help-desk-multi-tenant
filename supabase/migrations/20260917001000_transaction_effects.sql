-- R14-06. Candidate only: test fresh/upgrade on disposable PostgreSQL17 before publication.
-- No backfill or modification of legacy events. Receipt metadata never stores bodies/reasons.
begin;
do $$begin
 if helpdesk_auth.schema_version()<>'0.15.0' then raise exception 'Expected schema 0.15.0'; end if;
 if not exists(select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls)) then
  raise exception 'Approved migration owner with BYPASSRLS required';
 end if;
end$$;
create table helpdesk_audit.write_effects (
 workspace_id uuid not null,
 id uuid not null default gen_random_uuid(),
 account_id uuid not null,
 ticket_id uuid not null,
 actor_id uuid not null references helpdesk_auth.principals(id),
 transaction_id xid8 not null default pg_current_xact_id(),
 kind text not null,
 ticket_version integer not null,
 source_id uuid,
 expected_data jsonb not null,
 applied boolean not null,
 event_id uuid,
 created_at timestamptz not null default clock_timestamp(),
 primary key(workspace_id,id),
 constraint write_effect_ticket_fk foreign key(workspace_id,account_id,ticket_id)
  references helpdesk_core.tickets(workspace_id,account_id,id),
 constraint write_effect_version_positive check(ticket_version>0),
 constraint write_effect_kind check(kind in ('ticket.created','ticket.status_changed','message.created','note.created','ticket.priority_changed','ticket.assignment_changed')),
 constraint write_effect_data_shape check(jsonb_typeof(expected_data)='object' and octet_length(expected_data::text)<=2048
  and not (expected_data ?| array['body','reason','description'])),
 constraint write_effect_source_kind check((kind in ('message.created','note.created'))=(source_id is not null)),
 constraint write_effect_event_unique unique(workspace_id,event_id)
);
create unique index write_effect_revision on helpdesk_audit.write_effects(workspace_id,ticket_id,ticket_version)
 where kind<>'note.created';
create unique index write_effect_source on helpdesk_audit.write_effects(workspace_id,kind,source_id)
 where source_id is not null;
alter table helpdesk_audit.write_effects enable row level security;
alter table helpdesk_audit.write_effects force row level security;
revoke all on helpdesk_audit.write_effects from public,helpdesk_app;
-- NO policies or grants: trigger owner is the only application writer. No HTTP helper.

create function helpdesk_audit.record_ticket_effect() returns trigger
language plpgsql security definer set search_path='' as $$
declare k text; d jsonb; matched uuid; changes integer;
begin
 if new.workspace_id is distinct from helpdesk_auth.workspace_id() or helpdesk_auth.actor_id() is null then
  raise exception 'Ticket write requires authenticated transaction context' using errcode='23514';
 end if;
 if tg_op='INSERT' then
  if new.created_by is distinct from helpdesk_auth.actor_id() or new.version<>1 or new.status<>'new' or new.assigned_to is not null then
   raise exception 'Invalid initial ticket effect' using errcode='23514';
  end if;
  k:='ticket.created';d:=jsonb_build_object('version',1);
 else
  -- Existing immutable, version, authorization and workflow guards still execute.
  changes:=(new.status is distinct from old.status)::integer+(new.priority is distinct from old.priority)::integer+
   (new.assigned_to is distinct from old.assigned_to)::integer;
  if changes>1 then raise exception 'One ticket operation per version required' using errcode='23514';end if;
  if new.subject is distinct from old.subject or new.description is distinct from old.description then
   raise exception 'Unsupported ticket field mutation' using errcode='23514';end if;
  if new.status is distinct from old.status then
   k:='ticket.status_changed';d:=jsonb_build_object('from',old.status,'to',new.status);
  elsif new.priority is distinct from old.priority then
   k:='ticket.priority_changed';d:=jsonb_build_object('from',old.priority,'to',new.priority,'version',new.version);
  elsif new.assigned_to is distinct from old.assigned_to then
   k:='ticket.assignment_changed';d:=jsonb_build_object('action',case when new.assigned_to is null then 'release' else 'claim' end,
    'from',old.assigned_to,'to',new.assigned_to,'version',new.version);
  else
   -- A public message is inserted BEFORE its parent version advances. No empty version bumps.
   update helpdesk_audit.write_effects set applied=true
    where workspace_id=new.workspace_id and account_id=new.account_id and ticket_id=new.id
      and ticket_version=new.version and kind='message.created' and actor_id=helpdesk_auth.actor_id()
      and transaction_id=pg_current_xact_id() and not applied returning id into matched;
   if not found then raise exception 'Version bump requires a new matching message' using errcode='23514';end if;
   return null;
  end if;
 end if;
 insert into helpdesk_audit.write_effects(workspace_id,account_id,ticket_id,actor_id,kind,ticket_version,expected_data,applied)
  values(new.workspace_id,new.account_id,new.id,helpdesk_auth.actor_id(),k,new.version,d,true);
 return null;
end$$;
create trigger record_ticket_effect after insert or update on helpdesk_core.tickets
 for each row execute function helpdesk_audit.record_ticket_effect();

create function helpdesk_audit.record_conversation_effect() returns trigger
language plpgsql security definer set search_path='' as $$
declare t helpdesk_core.tickets%rowtype;k text;v integer;d jsonb;
begin
 if new.workspace_id is distinct from helpdesk_auth.workspace_id() or new.actor_id is distinct from helpdesk_auth.actor_id() then
  raise exception 'Conversation actor mismatch' using errcode='23514';end if;
 -- Serializes direct writers too; a note writer need not have UPDATE on the parent.
 select * into t from helpdesk_core.tickets
  where (workspace_id,account_id,id)=(new.workspace_id,new.account_id,new.ticket_id) for update;
 if not found then raise exception 'Missing conversation parent' using errcode='23503';end if;
 if tg_table_name='ticket_messages' then
  k:='message.created';v:=t.version+1;d:=jsonb_build_object('messageId',new.id,'actorType',new.actor_type);
 else
  k:='note.created';v:=t.version;d:=jsonb_build_object('noteId',new.id);
 end if;
 insert into helpdesk_audit.write_effects(workspace_id,account_id,ticket_id,actor_id,kind,ticket_version,source_id,expected_data,applied)
  values(new.workspace_id,new.account_id,new.ticket_id,new.actor_id,k,v,new.id,d,k='note.created');
 return null;
end$$;
create trigger record_message_effect after insert on helpdesk_core.ticket_messages
 for each row execute function helpdesk_audit.record_conversation_effect();
create trigger record_note_effect after insert on helpdesk_core.internal_notes
 for each row execute function helpdesk_audit.record_conversation_effect();

create function helpdesk_audit.bind_effect_event() returns trigger
language plpgsql security definer set search_path='' as $$
declare r helpdesk_audit.write_effects%rowtype;t helpdesk_core.tickets%rowtype;v integer;d jsonb;reason text;public_event boolean;
begin
 select * into t from helpdesk_core.tickets where (workspace_id,account_id,id)=(new.workspace_id,new.account_id,new.ticket_id);
 if not found or not helpdesk_auth.has_scope(new.workspace_id,'tickets:read')
  or not helpdesk_auth.can_read_ticket(t.workspace_id,t.account_id,t.product_instance_id,t.created_by) then
  raise exception 'Unauthorized event parent' using errcode='42501';end if;
 if new.workspace_id is distinct from helpdesk_auth.workspace_id() or new.actor_id is distinct from helpdesk_auth.actor_id()
    or jsonb_typeof(new.data) is distinct from 'object' then
  raise exception 'Invalid event context' using errcode='23514';end if;
 if new.type in ('message.created','note.created') then
  select * into r from helpdesk_audit.write_effects
   where workspace_id=new.workspace_id and account_id=new.account_id and ticket_id=new.ticket_id and kind=new.type
    and source_id::text=new.data->>(case when new.type='message.created' then 'messageId' else 'noteId' end)
    and actor_id=new.actor_id and transaction_id=pg_current_xact_id() and event_id is null for update;
 else
  select version into v from helpdesk_core.tickets where (workspace_id,account_id,id)=(new.workspace_id,new.account_id,new.ticket_id);
  select * into r from helpdesk_audit.write_effects
   where workspace_id=new.workspace_id and account_id=new.account_id and ticket_id=new.ticket_id
    and ticket_version=v and kind=new.type and actor_id=new.actor_id
    and transaction_id=pg_current_xact_id() and event_id is null for update;
 end if;
 if not found or not r.applied then raise exception 'Event has no matching applied write in this transaction' using errcode='23514';end if;
 public_event:=r.kind not in ('note.created','ticket.assignment_changed');
 if new.customer_visible is distinct from public_event then raise exception 'Invalid event visibility' using errcode='23514';end if;
 d:=new.data;
 if r.kind in ('ticket.status_changed','ticket.priority_changed','ticket.assignment_changed') then
  if jsonb_typeof(d->'reason') is distinct from 'string' then raise exception 'Event reason required' using errcode='23514';end if;
  reason:=d->>'reason';d:=d-'reason';
  if length(reason)>2000 or ((r.kind<>'ticket.status_changed' or (r.expected_data->>'from'='resolved' and r.expected_data->>'to'='open'))
    and reason !~ '[^[:space:]]') then raise exception 'Invalid event reason' using errcode='23514';end if;
 end if;
 if d is distinct from r.expected_data then raise exception 'Event differs from actual write' using errcode='23514';end if;
 update helpdesk_audit.write_effects set event_id=new.id where workspace_id=r.workspace_id and id=r.id;
 return new;
end$$;
create trigger bind_write_effect_event before insert on helpdesk_core.ticket_events
 for each row execute function helpdesk_audit.bind_effect_event();

create function helpdesk_audit.bind_effect_outbox() returns trigger
language plpgsql security definer set search_path='' as $$
declare r helpdesk_audit.write_effects%rowtype;e helpdesk_core.ticket_events%rowtype;t helpdesk_core.tickets%rowtype;expected jsonb;
begin
 select * into t from helpdesk_core.tickets where (workspace_id,account_id,id)=(new.workspace_id,new.account_id,new.ticket_id);
 if not found or not helpdesk_auth.has_scope(new.workspace_id,'tickets:read')
  or not helpdesk_auth.can_read_ticket(t.workspace_id,t.account_id,t.product_instance_id,t.created_by) then
  raise exception 'Unauthorized outbox parent' using errcode='42501';end if;
 select * into r from helpdesk_audit.write_effects where workspace_id=new.workspace_id and account_id=new.account_id
  and ticket_id=new.ticket_id and event_id=new.id and actor_id=helpdesk_auth.actor_id()
  and transaction_id=pg_current_xact_id() and applied;
 if not found or r.kind in ('note.created','ticket.assignment_changed') or r.kind is distinct from new.type then
  raise exception 'Outbox requires matching public write in this transaction' using errcode='23514';end if;
 select * into e from helpdesk_core.ticket_events where workspace_id=r.workspace_id and id=r.event_id;
 if not found or not e.customer_visible or e.type<>r.kind or e.created_at is distinct from new.created_at
    or new.dispatched_at is not null then raise exception 'Invalid new outbox event' using errcode='23514';end if;
 expected:=jsonb_build_object('specversion','1.0','id',new.id,'source','helpdesk/workspaces/'||new.workspace_id::text,
  'type','com.helpdesk.'||new.type||'.v1','subject','tickets/'||new.ticket_id::text,'datacontenttype','application/json',
  'data',jsonb_build_object('ticket_id',new.ticket_id,'version',r.ticket_version));
 if jsonb_typeof(new.payload) is distinct from 'object' or (new.payload-'time') is distinct from expected
  or jsonb_typeof(new.payload->'time') is distinct from 'string' then
  raise exception 'Invalid or nonminimal external payload' using errcode='23514';end if;
 if not pg_input_is_valid(new.payload->>'time','timestamp with time zone') or (new.payload->>'time') !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' then
  raise exception 'Invalid outbox time' using errcode='23514';end if;
 if (new.payload->>'time')::timestamptz is distinct from e.created_at then raise exception 'Outbox time mismatch' using errcode='23514';end if;
 return new;
end$$;
create trigger bind_write_effect_outbox before insert on helpdesk_integration.outbox_events
 for each row execute function helpdesk_audit.bind_effect_outbox();

create function helpdesk_audit.require_write_effect() returns trigger
language plpgsql security definer set search_path='' as $$
declare r helpdesk_audit.write_effects%rowtype;e helpdesk_core.ticket_events%rowtype;has_outbox boolean;
begin
 -- Read the final receipt, not the initial NEW.applied=false from message insertion.
 select * into r from helpdesk_audit.write_effects where workspace_id=new.workspace_id and id=new.id;
 if not found or not r.applied or r.event_id is null or r.transaction_id is distinct from pg_current_xact_id() then
  raise exception 'Incomplete write effects; transaction cannot commit' using errcode='23514';end if;
 select * into e from helpdesk_core.ticket_events where workspace_id=r.workspace_id and id=r.event_id;
 if not found or (e.workspace_id,e.account_id,e.ticket_id,e.actor_id,e.type) is distinct from
  (r.workspace_id,r.account_id,r.ticket_id,r.actor_id,r.kind) then
  raise exception 'Missing matching functional event' using errcode='23514';end if;
 select exists(select 1 from helpdesk_integration.outbox_events o where
  (o.workspace_id,o.account_id,o.ticket_id,o.id,o.type)=(r.workspace_id,r.account_id,r.ticket_id,r.event_id,r.kind)) into has_outbox;
 if has_outbox is distinct from (r.kind not in ('note.created','ticket.assignment_changed')) then
  raise exception 'Public write requires outbox; private write forbids it' using errcode='23514';end if;
 return null;
end$$;
create constraint trigger complete_write_effect after insert on helpdesk_audit.write_effects
 deferrable initially deferred for each row execute function helpdesk_audit.require_write_effect();

revoke all on function helpdesk_audit.record_ticket_effect(),helpdesk_audit.record_conversation_effect(),
 helpdesk_audit.bind_effect_event(),helpdesk_audit.bind_effect_outbox(),helpdesk_audit.require_write_effect() from public,helpdesk_app;
do $clients$ declare r text;f text;begin
 foreach r in array array['anon','authenticated','service_role','helpdesk_maintenance'] loop
  if exists(select 1 from pg_roles where rolname=r) then
   execute format('revoke all on table helpdesk_audit.write_effects from %I',r);
   foreach f in array array['record_ticket_effect','record_conversation_effect','bind_effect_event','bind_effect_outbox','require_write_effect'] loop
    execute format('revoke all on function helpdesk_audit.%I() from %I',f,r);
   end loop;
  end if;
 end loop;
end $clients$;
create or replace function helpdesk_auth.schema_version() returns text language sql immutable set search_path='' as $$select '0.16.0'::text$$;
revoke all on function helpdesk_auth.schema_version() from public;
grant execute on function helpdesk_auth.schema_version() to helpdesk_app;
commit;
