-- PostgreSQL 17. Private schemas; no application table is placed in public.
-- Run through a migration administrator, not the application's login.
begin;
-- Private SECURITY DEFINER helpers read FORCE RLS tables. Their migration owner must bypass RLS.
do $owner$ begin
 if not exists(select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls)) then
  raise exception 'Use an approved migration administrator with BYPASSRLS; application login must never own these functions';
 end if;
end $owner$;
do $roles$ begin
 if not exists(select 1 from pg_roles where rolname='helpdesk_app') then
  create role helpdesk_app nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
 end if;
 if exists(select 1 from pg_roles where rolname='helpdesk_app' and (rolsuper or rolbypassrls or rolcreaterole or rolcreatedb)) then
  raise exception 'Unsafe existing helpdesk_app role';
 end if;
end $roles$;
create schema helpdesk_auth;
create schema helpdesk_core;
create schema helpdesk_integration;
create schema helpdesk_audit;
revoke all on schema helpdesk_auth,helpdesk_core,helpdesk_integration,helpdesk_audit from public;
grant usage on schema helpdesk_auth,helpdesk_core,helpdesk_integration,helpdesk_audit to helpdesk_app;
alter default privileges in schema helpdesk_auth revoke execute on functions from public;
alter default privileges in schema helpdesk_core revoke execute on functions from public;

create table helpdesk_core.workspaces(id uuid primary key default gen_random_uuid(),name text not null check(length(name) between 1 and 160),created_at timestamptz not null default now());
create table helpdesk_auth.principals(id uuid primary key default gen_random_uuid(),kind text not null check(kind in ('human','integration')),supabase_user_id uuid unique,active boolean not null default true,check((kind='human' and supabase_user_id is not null) or (kind='integration' and supabase_user_id is null)));
create table helpdesk_auth.workspace_memberships(workspace_id uuid not null references helpdesk_core.workspaces(id),principal_id uuid not null references helpdesk_auth.principals(id),role text not null check(role in ('admin','agent')),active boolean not null default true,primary key(workspace_id,principal_id));
create table helpdesk_core.accounts(workspace_id uuid not null references helpdesk_core.workspaces(id),id uuid not null default gen_random_uuid(),name text not null,primary key(workspace_id,id));
create table helpdesk_auth.account_grants(workspace_id uuid not null,account_id uuid not null,principal_id uuid not null references helpdesk_auth.principals(id),role text not null check(role in ('requester','account_manager','agent')),active boolean not null default true,primary key(workspace_id,account_id,principal_id),foreign key(workspace_id,account_id) references helpdesk_core.accounts(workspace_id,id));
create index account_grants_principal on helpdesk_auth.account_grants(principal_id,workspace_id) where active;
create table helpdesk_core.products(workspace_id uuid not null references helpdesk_core.workspaces(id),id uuid not null default gen_random_uuid(),code text not null,name text not null,primary key(workspace_id,id),unique(workspace_id,code));
create table helpdesk_core.product_instances(workspace_id uuid not null,product_id uuid not null,id uuid not null default gen_random_uuid(),environment text not null check(environment in ('development','staging','production')),primary key(workspace_id,id),unique(workspace_id,product_id,id),foreign key(workspace_id,product_id) references helpdesk_core.products(workspace_id,id));
create table helpdesk_core.services(workspace_id uuid not null,product_id uuid not null,code text not null,name text not null,primary key(workspace_id,product_id,code),foreign key(workspace_id,product_id) references helpdesk_core.products(workspace_id,id));
create table helpdesk_core.support_contracts(workspace_id uuid not null references helpdesk_core.workspaces(id),id uuid not null default gen_random_uuid(),name text not null,status text not null default 'active' check(status in ('active','suspended','terminated')),primary key(workspace_id,id));
create table helpdesk_core.contract_versions(workspace_id uuid not null,contract_id uuid not null,id uuid not null default gen_random_uuid(),version integer not null check(version>0),published boolean not null default false,valid_from timestamptz not null,valid_until timestamptz,policy jsonb not null default '{}'::jsonb,primary key(workspace_id,id),unique(workspace_id,contract_id,version),foreign key(workspace_id,contract_id) references helpdesk_core.support_contracts(workspace_id,id),check(valid_until is null or valid_until>valid_from),check(jsonb_typeof(policy)='object'));
create table helpdesk_core.coverages(workspace_id uuid not null,account_id uuid not null,product_id uuid not null,product_instance_id uuid not null,service_code text not null,contract_version_id uuid not null,id uuid not null default gen_random_uuid(),enabled boolean not null default true,primary key(workspace_id,id),unique(workspace_id,account_id,product_instance_id,service_code,contract_version_id,id),foreign key(workspace_id,account_id) references helpdesk_core.accounts(workspace_id,id),foreign key(workspace_id,product_id,product_instance_id) references helpdesk_core.product_instances(workspace_id,product_id,id),foreign key(workspace_id,product_id,service_code) references helpdesk_core.services(workspace_id,product_id,code),foreign key(workspace_id,contract_version_id) references helpdesk_core.contract_versions(workspace_id,id));
create index coverage_context on helpdesk_core.coverages(workspace_id,account_id,product_instance_id,service_code) where enabled;

create table helpdesk_auth.integration_connections(workspace_id uuid not null, id uuid not null default gen_random_uuid(),product_instance_id uuid not null,principal_id uuid not null unique references helpdesk_auth.principals(id),active boolean not null default true,scopes text[] not null default array['contexts:resolve','tickets:read','tickets:write'],primary key(workspace_id,id),foreign key(workspace_id,product_instance_id) references helpdesk_core.product_instances(workspace_id,id),check(scopes <@ array['contexts:resolve','tickets:read','tickets:write']::text[]));
create table helpdesk_auth.source_scope_bindings(workspace_id uuid not null,connection_id uuid not null,account_id uuid not null,external_account_ref text not null,active boolean not null default true,primary key(workspace_id,connection_id,external_account_ref),unique(workspace_id,connection_id,account_id),foreign key(workspace_id,connection_id) references helpdesk_auth.integration_connections(workspace_id,id),foreign key(workspace_id,account_id) references helpdesk_core.accounts(workspace_id,id));
create table helpdesk_auth.integration_credentials(id uuid primary key default gen_random_uuid(),workspace_id uuid not null,connection_id uuid not null,key_hash text not null unique check(length(key_hash)=64),expires_at timestamptz,revoked_at timestamptz,foreign key(workspace_id,connection_id) references helpdesk_auth.integration_connections(workspace_id,id));
create table helpdesk_auth.integration_sessions(token_hash text primary key check(length(token_hash)=64),credential_id uuid not null references helpdesk_auth.integration_credentials(id),expires_at timestamptz not null,created_at timestamptz not null default now());

create table helpdesk_core.tickets(workspace_id uuid not null,account_id uuid not null,id uuid not null default gen_random_uuid(),product_instance_id uuid not null,service_code text not null,coverage_id uuid not null,contract_version_id uuid not null,created_by uuid not null references helpdesk_auth.principals(id),subject text not null check(length(btrim(subject)) between 3 and 200),description text not null check(length(btrim(description)) between 1 and 12000),status text not null default 'new' check(status in ('new','triage','open','waiting_customer','waiting_internal','waiting_third_party','resolved','closed','cancelled')),priority text not null default 'normal' check(priority in ('low','normal','high','urgent')),version integer not null default 1 check(version>0),contract_snapshot jsonb not null,created_at timestamptz not null,updated_at timestamptz not null,primary key(workspace_id,account_id,id),unique(workspace_id,id),foreign key(workspace_id,account_id,product_instance_id,service_code,contract_version_id,coverage_id) references helpdesk_core.coverages(workspace_id,account_id,product_instance_id,service_code,contract_version_id,id),check(jsonb_typeof(contract_snapshot)='object'));
create index tickets_cursor on helpdesk_core.tickets(workspace_id,created_at desc,id desc);
create index tickets_account_cursor on helpdesk_core.tickets(workspace_id,account_id,created_at desc,id desc);
create index tickets_requester on helpdesk_core.tickets(workspace_id,created_by,created_at desc,id desc);
create table helpdesk_core.ticket_messages(workspace_id uuid not null,account_id uuid not null,ticket_id uuid not null,id uuid not null default gen_random_uuid(),actor_id uuid not null references helpdesk_auth.principals(id),actor_type text not null check(actor_type in ('human_agent','customer','integration')),body text not null check(length(btrim(body)) between 1 and 12000),created_at timestamptz not null,primary key(workspace_id,id),foreign key(workspace_id,account_id,ticket_id) references helpdesk_core.tickets(workspace_id,account_id,id));
create index messages_ticket on helpdesk_core.ticket_messages(workspace_id,account_id,ticket_id,created_at,id);
create table helpdesk_core.internal_notes(workspace_id uuid not null,account_id uuid not null,ticket_id uuid not null,id uuid not null default gen_random_uuid(),actor_id uuid not null references helpdesk_auth.principals(id),body text not null check(length(btrim(body)) between 1 and 12000),created_at timestamptz not null,primary key(workspace_id,id),foreign key(workspace_id,account_id,ticket_id) references helpdesk_core.tickets(workspace_id,account_id,id));
create index notes_ticket on helpdesk_core.internal_notes(workspace_id,account_id,ticket_id,created_at,id);
create table helpdesk_core.ticket_events(workspace_id uuid not null,account_id uuid not null,ticket_id uuid not null,id uuid not null,actor_id uuid not null references helpdesk_auth.principals(id),type text not null,customer_visible boolean not null,data jsonb not null,created_at timestamptz not null,primary key(workspace_id,id),foreign key(workspace_id,account_id,ticket_id) references helpdesk_core.tickets(workspace_id,account_id,id));
create index events_ticket on helpdesk_core.ticket_events(workspace_id,account_id,ticket_id,created_at,id);
create table helpdesk_integration.api_idempotency_keys(workspace_id uuid not null references helpdesk_core.workspaces(id),principal_id uuid not null references helpdesk_auth.principals(id),operation text not null,key text not null check(length(key) between 16 and 128),request_hash text not null check(length(request_hash)=64),result jsonb not null,created_at timestamptz not null default now(),primary key(workspace_id,principal_id,operation,key));
create table helpdesk_integration.outbox_events(workspace_id uuid not null,account_id uuid not null,ticket_id uuid not null,id uuid not null,type text not null,payload jsonb not null,request_id text not null,created_at timestamptz not null,dispatched_at timestamptz,primary key(workspace_id,id),foreign key(workspace_id,account_id,ticket_id) references helpdesk_core.tickets(workspace_id,account_id,id));
create index outbox_pending on helpdesk_integration.outbox_events(created_at,workspace_id,id) where dispatched_at is null;
create table helpdesk_audit.audit_events(workspace_id uuid not null references helpdesk_core.workspaces(id),id uuid not null default gen_random_uuid(),principal_id uuid not null references helpdesk_auth.principals(id),action text not null,resource_id uuid,request_id text not null,created_at timestamptz not null default now(),primary key(workspace_id,id));

-- Context helpers do not authenticate. Only the trusted backend sets this transaction-local context.
create function helpdesk_auth.actor_id() returns uuid language sql stable set search_path='' as $$select nullif(current_setting('app.principal_id',true),'')::uuid$$;
create function helpdesk_auth.workspace_id() returns uuid language sql stable set search_path='' as $$select nullif(current_setting('app.workspace_id',true),'')::uuid$$;
create function helpdesk_auth.is_human() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from helpdesk_auth.principals where id=helpdesk_auth.actor_id() and active and kind='human')$$;
create function helpdesk_auth.has_account(w uuid,a uuid) returns boolean language sql stable security definer set search_path='' as $$
 select w=helpdesk_auth.workspace_id() and exists(select 1 from helpdesk_auth.principals p where p.id=helpdesk_auth.actor_id() and p.active) and (
 (helpdesk_auth.is_human() and exists(select 1 from helpdesk_auth.workspace_memberships m where m.workspace_id=w and m.principal_id=helpdesk_auth.actor_id() and m.active and m.role='admin')) or
 (helpdesk_auth.is_human() and exists(select 1 from helpdesk_auth.account_grants g where g.workspace_id=w and g.account_id=a and g.principal_id=helpdesk_auth.actor_id() and g.active)) or
 exists(select 1 from helpdesk_auth.integration_connections c join helpdesk_auth.source_scope_bindings b on b.workspace_id=c.workspace_id and b.connection_id=c.id where c.workspace_id=w and c.principal_id=helpdesk_auth.actor_id() and c.active and b.active and b.account_id=a)
 )$$;
create function helpdesk_auth.is_operator(w uuid,a uuid) returns boolean language sql stable security definer set search_path='' as $$
 select w=helpdesk_auth.workspace_id() and helpdesk_auth.is_human() and (
 exists(select 1 from helpdesk_auth.workspace_memberships m where m.workspace_id=w and m.principal_id=helpdesk_auth.actor_id() and m.active and m.role='admin') or
 exists(select 1 from helpdesk_auth.account_grants g where g.workspace_id=w and g.account_id=a and g.principal_id=helpdesk_auth.actor_id() and g.active and g.role='agent'))$$;
create function helpdesk_auth.product_allowed(w uuid,i uuid) returns boolean language sql stable security definer set search_path='' as $$
 select w=helpdesk_auth.workspace_id() and (helpdesk_auth.is_human() or exists(select 1 from helpdesk_auth.integration_connections c join helpdesk_auth.principals p on p.id=c.principal_id where c.workspace_id=w and c.principal_id=helpdesk_auth.actor_id() and c.product_instance_id=i and c.active and p.active))$$;
create function helpdesk_auth.can_read_ticket(w uuid,a uuid,i uuid,requester uuid) returns boolean language sql stable security definer set search_path='' as $$
 select helpdesk_auth.has_account(w,a) and helpdesk_auth.product_allowed(w,i) and (requester=helpdesk_auth.actor_id() or helpdesk_auth.is_operator(w,a) or (helpdesk_auth.is_human() and exists(select 1 from helpdesk_auth.account_grants g where g.workspace_id=w and g.account_id=a and g.principal_id=helpdesk_auth.actor_id() and g.active and g.role='account_manager')))$$;

-- Bootstrap returns live grants; roles are never read from user-editable JWT metadata.
create function helpdesk_auth.resolve_human(user_id uuid,w uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',p.id,'kind','human','workspaceId',w,'workspaceRole',(select role from helpdesk_auth.workspace_memberships m where m.workspace_id=w and m.principal_id=p.id and m.active),'grants',coalesce((select jsonb_agg(jsonb_build_object('accountId',account_id,'role',role)) from helpdesk_auth.account_grants g where g.workspace_id=w and g.principal_id=p.id and g.active),'[]'::jsonb),'scopes',jsonb_build_array('contexts:resolve','tickets:read','tickets:write','notes:read','notes:write'))
 from helpdesk_auth.principals p where p.supabase_user_id=user_id and p.kind='human' and p.active and (exists(select 1 from helpdesk_auth.workspace_memberships m where m.workspace_id=w and m.principal_id=p.id and m.active) or exists(select 1 from helpdesk_auth.account_grants g where g.workspace_id=w and g.principal_id=p.id and g.active))$$;
create function helpdesk_auth.exchange_key(credential_hash text,session_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
 declare c record; exp timestamptz:=clock_timestamp()+interval '10 minutes';
 begin
 select k.id,k.workspace_id,k.expires_at into c from helpdesk_auth.integration_credentials k join helpdesk_auth.integration_connections i on i.workspace_id=k.workspace_id and i.id=k.connection_id join helpdesk_auth.principals p on p.id=i.principal_id where k.key_hash=credential_hash and k.revoked_at is null and (k.expires_at is null or k.expires_at>clock_timestamp()) and i.active and p.active and p.kind='integration' for share of k,i,p;
 if not found then return null; end if;
 if c.expires_at is not null then exp:=least(exp,c.expires_at); end if;
 insert into helpdesk_auth.integration_sessions(token_hash,credential_id,expires_at) values(session_hash,c.id,exp);
 return jsonb_build_object('workspaceId',c.workspace_id,'expiresAt',exp);
 end$$;
create function helpdesk_auth.resolve_session(session_hash text,w uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',p.id,'kind','integration','workspaceId',c.workspace_id,'workspaceRole',null,'connectionId',c.id,'productInstanceIds',jsonb_build_array(c.product_instance_id),'grants',coalesce((select jsonb_agg(jsonb_build_object('accountId',b.account_id,'role','requester')) from helpdesk_auth.source_scope_bindings b where b.workspace_id=c.workspace_id and b.connection_id=c.id and b.active),'[]'::jsonb),'scopes',to_jsonb(c.scopes))
 from helpdesk_auth.integration_sessions s join helpdesk_auth.integration_credentials k on k.id=s.credential_id join helpdesk_auth.integration_connections c on c.workspace_id=k.workspace_id and c.id=k.connection_id join helpdesk_auth.principals p on p.id=c.principal_id
 where s.token_hash=session_hash and s.expires_at>statement_timestamp() and k.revoked_at is null and (k.expires_at is null or k.expires_at>statement_timestamp()) and c.active and p.active and p.kind='integration' and c.workspace_id=w$$;

-- Revalidation and row locks share the ticket transaction, without UPDATE grants to the request role.
create function helpdesk_auth.locked_coverages(w uuid,a uuid,i uuid,svc text)
returns setof jsonb language plpgsql security definer set search_path='' as $$
declare r record;
begin
 if not helpdesk_auth.has_account(w,a) or not helpdesk_auth.product_allowed(w,i) then
  raise exception 'Unauthorized context' using errcode='42501';
 end if;
 for r in select c.id,c.workspace_id,c.account_id,c.product_instance_id,c.service_code,c.enabled,v.id as contract_version_id,v.version,v.published,v.valid_from,v.valid_until,v.policy,k.id as contract_id,k.status
 from helpdesk_core.coverages c join helpdesk_core.contract_versions v on v.workspace_id=c.workspace_id and v.id=c.contract_version_id join helpdesk_core.support_contracts k on k.workspace_id=v.workspace_id and k.id=v.contract_id
 where c.workspace_id=w and c.account_id=a and c.product_instance_id=i and c.service_code=svc
 order by c.id for share of c,v,k
 loop
  return next jsonb_build_object('id',r.id,'workspaceId',r.workspace_id,'accountId',r.account_id,'productInstanceId',r.product_instance_id,'serviceCode',r.service_code,'enabled',r.enabled,'contractVersionId',r.contract_version_id,'contractVersion',r.version,'published',r.published,'validFrom',r.valid_from,'validUntil',r.valid_until,'policy',r.policy,'contractId',r.contract_id,'contractStatus',r.status);
 end loop;
end$$;

-- Enable RLS on all application tables, including credential tables with NO direct grants.
do $rls$ declare t record;begin
 for t in select schemaname,tablename from pg_tables where schemaname in ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit') loop
 execute format('alter table %I.%I enable row level security',t.schemaname,t.tablename);
 execute format('alter table %I.%I force row level security',t.schemaname,t.tablename);
 end loop;
end $rls$;
create policy account_read on helpdesk_core.accounts for select to helpdesk_app using(helpdesk_auth.has_account(workspace_id,id));
create policy coverage_read on helpdesk_core.coverages for select to helpdesk_app using(helpdesk_auth.has_account(workspace_id,account_id) and helpdesk_auth.product_allowed(workspace_id,product_instance_id));
create policy contract_version_read on helpdesk_core.contract_versions for select to helpdesk_app using(workspace_id=helpdesk_auth.workspace_id() and exists(select 1 from helpdesk_core.coverages c where c.workspace_id=contract_versions.workspace_id and c.contract_version_id=contract_versions.id));
create policy contract_read on helpdesk_core.support_contracts for select to helpdesk_app using(workspace_id=helpdesk_auth.workspace_id() and exists(select 1 from helpdesk_core.contract_versions v where v.workspace_id=support_contracts.workspace_id and v.contract_id=support_contracts.id));
create policy ticket_read on helpdesk_core.tickets for select to helpdesk_app using(helpdesk_auth.can_read_ticket(workspace_id,account_id,product_instance_id,created_by));
create policy ticket_insert on helpdesk_core.tickets for insert to helpdesk_app with check(created_by=helpdesk_auth.actor_id() and helpdesk_auth.has_account(workspace_id,account_id) and helpdesk_auth.product_allowed(workspace_id,product_instance_id));
create policy ticket_update on helpdesk_core.tickets for update to helpdesk_app using(helpdesk_auth.can_read_ticket(workspace_id,account_id,product_instance_id,created_by)) with check(helpdesk_auth.can_read_ticket(workspace_id,account_id,product_instance_id,created_by));
create policy message_read on helpdesk_core.ticket_messages for select to helpdesk_app using(exists(select 1 from helpdesk_core.tickets t where t.workspace_id=ticket_messages.workspace_id and t.account_id=ticket_messages.account_id and t.id=ticket_messages.ticket_id));
create policy message_insert on helpdesk_core.ticket_messages for insert to helpdesk_app with check(actor_id=helpdesk_auth.actor_id() and exists(select 1 from helpdesk_core.tickets t where t.workspace_id=ticket_messages.workspace_id and t.account_id=ticket_messages.account_id and t.id=ticket_messages.ticket_id));
create policy note_read on helpdesk_core.internal_notes for select to helpdesk_app using(helpdesk_auth.is_operator(workspace_id,account_id));
create policy note_insert on helpdesk_core.internal_notes for insert to helpdesk_app with check(actor_id=helpdesk_auth.actor_id() and helpdesk_auth.is_operator(workspace_id,account_id));
create policy event_read on helpdesk_core.ticket_events for select to helpdesk_app using((customer_visible or helpdesk_auth.is_operator(workspace_id,account_id)) and exists(select 1 from helpdesk_core.tickets t where t.workspace_id=ticket_events.workspace_id and t.account_id=ticket_events.account_id and t.id=ticket_events.ticket_id));
create policy event_insert on helpdesk_core.ticket_events for insert to helpdesk_app with check(actor_id=helpdesk_auth.actor_id() and exists(select 1 from helpdesk_core.tickets t where t.workspace_id=ticket_events.workspace_id and t.account_id=ticket_events.account_id and t.id=ticket_events.ticket_id));
create policy idem_read on helpdesk_integration.api_idempotency_keys for select to helpdesk_app using(workspace_id=helpdesk_auth.workspace_id() and principal_id=helpdesk_auth.actor_id());
create policy idem_insert on helpdesk_integration.api_idempotency_keys for insert to helpdesk_app with check(workspace_id=helpdesk_auth.workspace_id() and principal_id=helpdesk_auth.actor_id());
create policy outbox_insert on helpdesk_integration.outbox_events for insert to helpdesk_app with check(exists(select 1 from helpdesk_core.tickets t where t.workspace_id=outbox_events.workspace_id and t.account_id=outbox_events.account_id and t.id=outbox_events.ticket_id));
create policy audit_insert on helpdesk_audit.audit_events for insert to helpdesk_app with check(workspace_id=helpdesk_auth.workspace_id() and principal_id=helpdesk_auth.actor_id());

-- Least privilege: no business-table DELETE; no identity/credential table direct access.
grant select on helpdesk_core.accounts,helpdesk_core.coverages,helpdesk_core.contract_versions,helpdesk_core.support_contracts to helpdesk_app;
-- Contract row locks are obtained only by the bounded, authorized locked_coverages helper.
-- The request role has NO UPDATE privilege on contractual configuration.
grant select,insert on helpdesk_core.tickets,helpdesk_core.ticket_messages,helpdesk_core.internal_notes,helpdesk_core.ticket_events,helpdesk_integration.api_idempotency_keys to helpdesk_app;
grant update(status,version,updated_at) on helpdesk_core.tickets to helpdesk_app;
grant insert on helpdesk_integration.outbox_events,helpdesk_audit.audit_events to helpdesk_app;
revoke execute on all functions in schema helpdesk_auth from public;
grant execute on all functions in schema helpdesk_auth to helpdesk_app;

-- Immutable financial/contract history; mutable contract status lives in support_contracts.
create function helpdesk_core.reject_published_version_change() returns trigger language plpgsql set search_path='' as $$begin if old.published then raise exception 'Published contract versions are immutable' using errcode='23514'; end if; if tg_op='DELETE' then return old; end if; return new; end$$;
create trigger immutable_contract_version before update or delete on helpdesk_core.contract_versions for each row execute function helpdesk_core.reject_published_version_change();
create function helpdesk_core.guard_ticket_update() returns trigger language plpgsql set search_path='' as $$begin
 if (new.workspace_id,new.account_id,new.id,new.created_by,new.product_instance_id,new.service_code,new.coverage_id,new.contract_version_id,new.contract_snapshot,new.created_at) is distinct from (old.workspace_id,old.account_id,old.id,old.created_by,old.product_instance_id,old.service_code,old.coverage_id,old.contract_version_id,old.contract_snapshot,old.created_at) then raise exception 'Ticket identity and contract snapshot are immutable' using errcode='23514'; end if;
 if new.version<>old.version+1 then raise exception 'Ticket version must advance by one' using errcode='23514'; end if;
 return new;end$$;
create trigger immutable_ticket_context before update on helpdesk_core.tickets for each row execute function helpdesk_core.guard_ticket_update();
-- Deferred invariant: a committed new ticket must have its initial functional event and outbox intention.
create function helpdesk_core.require_initial_outbox() returns trigger language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from helpdesk_core.ticket_events e join helpdesk_integration.outbox_events o on o.workspace_id=e.workspace_id and o.account_id=e.account_id and o.ticket_id=e.ticket_id and o.id=e.id where e.workspace_id=new.workspace_id and e.account_id=new.account_id and e.ticket_id=new.id and e.type='ticket.created' and o.type='ticket.created') then
 raise exception 'Ticket creation requires event and outbox in the same transaction' using errcode='23514';
 end if;return null;end$$;
create constraint trigger ticket_initial_outbox after insert on helpdesk_core.tickets deferrable initially deferred for each row execute function helpdesk_core.require_initial_outbox();
revoke execute on all functions in schema helpdesk_core from public;
-- Supabase installations may have inherited default grants; explicitly remove client access.
do $client_grants$ declare r text;begin
 foreach r in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=r) then
   execute format('revoke all on schema helpdesk_auth,helpdesk_core,helpdesk_integration,helpdesk_audit from %I',r);
   execute format('revoke all on all tables in schema helpdesk_auth,helpdesk_core,helpdesk_integration,helpdesk_audit from %I',r);
   execute format('revoke all on all functions in schema helpdesk_auth,helpdesk_core,helpdesk_integration,helpdesk_audit from %I',r);
  end if;
 end loop;
end $client_grants$;
-- Do not grant new functions automatically; later migrations must explicitly grant each helper.
commit;
