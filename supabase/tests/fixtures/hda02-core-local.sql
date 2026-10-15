-- Synthetic core for isolated HDA candidate tests. NOT the actual 17 migrations.
-- Same names/keys used by the candidate; authorization fixture is deliberately
-- small. Full-core RLS, scopes, grants, upgrade and hosted acceptance remain gates.
do $$begin if current_database()<>'helpdesk_test' or current_user<>'hda_test_owner' then raise exception 'Owned test cluster only';end if;end$$;
create schema helpdesk_auth;create schema helpdesk_core;create schema helpdesk_integration;
revoke all on schema helpdesk_auth,helpdesk_core,helpdesk_integration from public;
grant usage on schema helpdesk_auth,helpdesk_core,helpdesk_integration to helpdesk_app;
create table helpdesk_auth.principals(id uuid primary key,kind text not null,active boolean not null);
create table helpdesk_auth.workspace_memberships(workspace_id uuid,principal_id uuid,role text,active boolean,primary key(workspace_id,principal_id));
create table helpdesk_auth.account_grants(workspace_id uuid,account_id uuid,principal_id uuid,role text,active boolean,primary key(workspace_id,account_id,principal_id));
create table helpdesk_auth.integration_connections(workspace_id uuid,id uuid,principal_id uuid,product_instance_id uuid,active boolean,scopes text[] not null default array['tickets:read']::text[],primary key(workspace_id,id));
create table helpdesk_auth.source_scope_bindings(workspace_id uuid,connection_id uuid,account_id uuid,active boolean,primary key(workspace_id,connection_id,account_id));
create table helpdesk_core.tickets(workspace_id uuid,account_id uuid,id uuid,product_instance_id uuid,created_by uuid,status text,primary key(workspace_id,account_id,id));
create function helpdesk_auth.actor_id() returns uuid language sql stable set search_path='' as $$select nullif(current_setting('app.principal_id',true),'')::uuid$$;
create function helpdesk_auth.workspace_id() returns uuid language sql stable set search_path='' as $$select nullif(current_setting('app.workspace_id',true),'')::uuid$$;
create function helpdesk_auth.has_account(w uuid,a uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from helpdesk_auth.principals p where p.id=helpdesk_auth.actor_id() and p.active and ((p.kind='human' and exists(select 1 from helpdesk_auth.account_grants g where g.workspace_id=w and g.account_id=a and g.principal_id=p.id and g.active)) or (p.kind='integration' and exists(select 1 from helpdesk_auth.integration_connections c join helpdesk_auth.source_scope_bindings s on s.workspace_id=c.workspace_id and s.connection_id=c.id where c.workspace_id=w and c.principal_id=p.id and s.account_id=a and c.active and s.active))))$$;
create function helpdesk_auth.product_allowed(w uuid,i uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from helpdesk_auth.principals p where p.id=helpdesk_auth.actor_id() and p.active and (p.kind='human' or exists(select 1 from helpdesk_auth.integration_connections c where c.workspace_id=w and c.principal_id=p.id and c.product_instance_id=i and c.active)))$$;
create function helpdesk_auth.can_read_ticket(w uuid,a uuid,i uuid,requester uuid) returns boolean language sql stable security definer set search_path='' as $$select helpdesk_auth.has_account(w,a) and helpdesk_auth.product_allowed(w,i) and (requester=helpdesk_auth.actor_id() or exists(select 1 from helpdesk_auth.account_grants g where g.workspace_id=w and g.account_id=a and g.principal_id=helpdesk_auth.actor_id() and g.active and g.role in ('agent','account_manager')))$$;
-- E03: synthetic versioned scope authority, mirroring the core lock namespace.
-- It remains a minimal fixture, NOT a replacement for migration 009 or its tests.
create table helpdesk_auth.human_scope_versions(workspace_id uuid not null,principal_id uuid not null,revision integer not null,scopes text[] not null,primary key(workspace_id,principal_id,revision));
create function helpdesk_auth.hda_test_scope_version() returns trigger language plpgsql set search_path='' as $$
declare prior integer;
begin
 perform pg_advisory_xact_lock(hashtextextended('helpdesk-human-scopes:'||new.workspace_id::text||':'||new.principal_id::text,0));
 select coalesce(max(revision),0) into prior from helpdesk_auth.human_scope_versions where workspace_id=new.workspace_id and principal_id=new.principal_id;
 if new.revision<>prior+1 then raise exception 'Synthetic scope revision mismatch' using errcode='40001';end if;return new;
end$$;
create trigger hda_test_scope_version before insert on helpdesk_auth.human_scope_versions for each row execute function helpdesk_auth.hda_test_scope_version();
create function helpdesk_auth.has_scope(w uuid,requested text) returns boolean language sql stable security definer set search_path='' as $$
 select w=helpdesk_auth.workspace_id() and exists(select 1 from helpdesk_auth.principals p where p.id=helpdesk_auth.actor_id() and p.active and (
  (p.kind='human' and requested=any(coalesce((select v.scopes from helpdesk_auth.human_scope_versions v where v.workspace_id=w and v.principal_id=p.id order by v.revision desc limit 1),array[]::text[])))
  or (p.kind='integration' and exists(select 1 from helpdesk_auth.integration_connections c where c.workspace_id=w and c.principal_id=p.id and c.active and requested=any(c.scopes)))
 ))
$$;
-- Explicit resource-policy double, including denial and expiry. Not full-core proof.
create table helpdesk_auth.hda_test_resources(ticket_id uuid primary key,allow_read boolean not null,allow_write boolean not null,expires_at timestamptz not null);
create function helpdesk_auth.cg_unscoped_product(w uuid,product uuid) returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from helpdesk_auth.hda_test_resources r join helpdesk_core.tickets t on t.id=r.ticket_id where t.workspace_id=w and t.product_instance_id=product)
$$;
create function helpdesk_auth.cg_ticket_resource_allowed(w uuid,a uuid,ticket uuid,op text) returns boolean language sql volatile security definer set search_path='' as $$
 select case when not exists(select 1 from helpdesk_auth.hda_test_resources where ticket_id=ticket) then true
 else exists(select 1 from helpdesk_auth.hda_test_resources r join helpdesk_auth.principals p on p.id=helpdesk_auth.actor_id() where r.ticket_id=ticket and p.kind='human' and r.expires_at>clock_timestamp() and case op when 'tickets.read' then r.allow_read when 'tickets.write' then r.allow_read and r.allow_write else false end) end
$$;
create function helpdesk_auth.cg_lock_ticket_scope(ticket uuid,op text) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare r helpdesk_auth.hda_test_resources%rowtype;
begin
 select * into r from helpdesk_auth.hda_test_resources where ticket_id=ticket for share;
 if not found or not helpdesk_auth.cg_ticket_resource_allowed(helpdesk_auth.workspace_id(),null,ticket,op) then return null;end if;
 return jsonb_build_object('expiresAt',to_char(r.expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
end $$;
revoke all on all functions in schema helpdesk_auth from public;
