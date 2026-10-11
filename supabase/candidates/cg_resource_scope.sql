-- CG03d SQL CANDIDATE ONLY, not in the migration manifest, not a hosted installer.
-- The guarded rls.test.ts scenario owns BEGIN/COMMIT and a fresh disposable PG17.
-- Promotion requires CLI-generated migration, schema/readiness/upgrade review.
do $candidate$
begin
 if current_setting('app.cg03d_candidate',true) is distinct from 'disposable-pg17'
    or current_database() <> 'helpdesk_test'
    or current_setting('server_version_num')::integer not between 170000 and 179999 then
  raise exception 'CG03d requires the owned disposable PostgreSQL17 scenario' using errcode='42501';
 end if;
 if not exists(select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls)) then
  raise exception 'Candidate DDL requires its approved test administrator' using errcode='42501';
 end if;
end $candidate$;

create table helpdesk_auth.cg_resource_connections(
 workspace_id uuid not null,
 id uuid not null,
 product_instance_id uuid not null,
 active boolean not null default true,
 primary key(workspace_id,id),
 foreign key(workspace_id,product_instance_id) references helpdesk_core.product_instances(workspace_id,id)
);
create index cg_resource_product on helpdesk_auth.cg_resource_connections(workspace_id,product_instance_id);
create table helpdesk_auth.cg_resource_bindings(
 workspace_id uuid not null, account_id uuid not null, id uuid not null,
 connection_id uuid not null, tenant_id text collate "C" not null,
 active boolean not null default true,
 primary key(workspace_id,account_id,id),
 unique(workspace_id,connection_id,tenant_id),
 foreign key(workspace_id,account_id) references helpdesk_core.accounts(workspace_id,id),
 foreign key(workspace_id,connection_id) references helpdesk_auth.cg_resource_connections(workspace_id,id),
 check(length(tenant_id) between 1 and 256 and btrim(tenant_id)=tenant_id and tenant_id !~ '[[:cntrl:]]')
);
create table helpdesk_auth.cg_resource_grant_sets(
 workspace_id uuid not null, account_id uuid not null, binding_id uuid not null,
 principal_id uuid not null references helpdesk_auth.principals(id),
 operation text not null check(operation in ('tickets.read','tickets.write','notes.read','notes.write')),
 revision bigint not null default 1 check(revision>0),
 source_revision text collate "C" not null check(length(source_revision) between 1 and 256),
 as_of timestamptz not null, expires_at timestamptz not null,
 expected_count integer not null check(expected_count between 0 and 1000),
 active boolean not null default false,
 primary key(workspace_id,account_id,binding_id,principal_id,operation),
 foreign key(workspace_id,account_id,binding_id) references helpdesk_auth.cg_resource_bindings(workspace_id,account_id,id),
 check(isfinite(as_of) and isfinite(expires_at) and expires_at>as_of)
);
create table helpdesk_auth.cg_resource_grant_refs(
 workspace_id uuid not null, account_id uuid not null, binding_id uuid not null,
 principal_id uuid not null, operation text not null,
 resource_type text collate "C" not null check(resource_type ~ '^[a-z][a-z0-9_]{0,31}$'),
 resource_id text collate "C" not null check(length(resource_id) between 1 and 256 and btrim(resource_id)=resource_id and resource_id !~ '[[:cntrl:]]'),
 primary key(workspace_id,account_id,binding_id,principal_id,operation,resource_type,resource_id),
 foreign key(workspace_id,account_id,binding_id,principal_id,operation)
  references helpdesk_auth.cg_resource_grant_sets(workspace_id,account_id,binding_id,principal_id,operation)
);
create table helpdesk_core.cg_ticket_resource_sets(
 workspace_id uuid not null, account_id uuid not null, ticket_id uuid not null,
 binding_id uuid not null, expected_count integer not null check(expected_count between 1 and 100),
 sealed boolean not null default false,
 primary key(workspace_id,account_id,ticket_id),
 foreign key(workspace_id,account_id,ticket_id) references helpdesk_core.tickets(workspace_id,account_id,id),
 foreign key(workspace_id,account_id,binding_id) references helpdesk_auth.cg_resource_bindings(workspace_id,account_id,id)
);
create table helpdesk_core.cg_ticket_resource_refs(
 workspace_id uuid not null, account_id uuid not null, ticket_id uuid not null,
 resource_type text collate "C" not null check(resource_type ~ '^[a-z][a-z0-9_]{0,31}$'),
 resource_id text collate "C" not null check(length(resource_id) between 1 and 256 and btrim(resource_id)=resource_id and resource_id !~ '[[:cntrl:]]'),
 primary key(workspace_id,account_id,ticket_id,resource_type,resource_id),
 foreign key(workspace_id,account_id,ticket_id) references helpdesk_core.cg_ticket_resource_sets(workspace_id,account_id,ticket_id)
);

-- A protected product must not become legacy through deletion or identity retargeting.
create function helpdesk_auth.cg_fixed_resource_namespace() returns trigger
language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'Resource namespaces may be deactivated, not deleted' using errcode='23514'; end if;
 if (to_jsonb(new)-'active') is distinct from (to_jsonb(old)-'active') then
  raise exception 'Resource namespace identity is immutable' using errcode='23514';
 end if;
 return new;
end$$;
create trigger cg_fixed_connection before update or delete on helpdesk_auth.cg_resource_connections
 for each row execute function helpdesk_auth.cg_fixed_resource_namespace();
create trigger cg_fixed_binding before update or delete on helpdesk_auth.cg_resource_bindings
 for each row execute function helpdesk_auth.cg_fixed_resource_namespace();

-- A child write acquires the SAME parent lock used by authorized reads, and
-- invalidates the complete snapshot. No application role may republish it.
create function helpdesk_auth.cg_invalidate_resource_grant() returns trigger
language plpgsql security definer set search_path='' as $$
declare r record;
begin
 if tg_op='UPDATE' and (new.workspace_id,new.account_id,new.binding_id,new.principal_id,new.operation)
  is distinct from (old.workspace_id,old.account_id,old.binding_id,old.principal_id,old.operation) then
  raise exception 'Resource grant identity is immutable' using errcode='23514';
 end if;
 if tg_op='DELETE' then r:=old; else r:=new; end if;
 update helpdesk_auth.cg_resource_grant_sets set active=false,revision=revision+1
  where workspace_id=r.workspace_id and account_id=r.account_id and binding_id=r.binding_id
   and principal_id=r.principal_id and operation=r.operation;
 if not found then raise exception 'Resource grant parent is missing' using errcode='23503'; end if;
 if tg_op='DELETE' then return old; else return new; end if;
end$$;
create trigger cg_invalidate_grant_refs before insert or update or delete on helpdesk_auth.cg_resource_grant_refs
 for each row execute function helpdesk_auth.cg_invalidate_resource_grant();

create function helpdesk_core.cg_guard_ticket_resource_set() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op<>'INSERT' then
  if old.sealed then raise exception 'Sealed resource selection is immutable' using errcode='23514'; end if;
  if tg_op='DELETE' then return old; end if;
  if (new.workspace_id,new.account_id,new.ticket_id,new.binding_id) is distinct from (old.workspace_id,old.account_id,old.ticket_id,old.binding_id) then
   raise exception 'Ticket resource identity is immutable' using errcode='23514';
  end if;
 end if;
 if not exists(select 1 from helpdesk_core.tickets t
  join helpdesk_auth.cg_resource_bindings b on b.workspace_id=t.workspace_id and b.account_id=t.account_id and b.id=new.binding_id
  join helpdesk_auth.cg_resource_connections c on c.workspace_id=b.workspace_id and c.id=b.connection_id and c.product_instance_id=t.product_instance_id
  where t.workspace_id=new.workspace_id and t.account_id=new.account_id and t.id=new.ticket_id) then
  raise exception 'Ticket resource binding does not match the product' using errcode='23514';
 end if;
 if new.sealed and (select count(*) from helpdesk_core.cg_ticket_resource_refs r
   where r.workspace_id=new.workspace_id and r.account_id=new.account_id and r.ticket_id=new.ticket_id)<>new.expected_count then
  raise exception 'Incomplete resource selection cannot be sealed' using errcode='23514';
 end if;
 return new;
end$$;
create trigger cg_guard_ticket_set before insert or update or delete on helpdesk_core.cg_ticket_resource_sets
 for each row execute function helpdesk_core.cg_guard_ticket_resource_set();
create function helpdesk_core.cg_guard_ticket_resource_ref() returns trigger
language plpgsql security definer set search_path='' as $$
declare r record; closed boolean;
begin
 if tg_op='UPDATE' and (new.workspace_id,new.account_id,new.ticket_id)
   is distinct from (old.workspace_id,old.account_id,old.ticket_id) then
  raise exception 'Ticket resource parent is immutable' using errcode='23514';
 end if;
 if tg_op='DELETE' then r:=old; else r:=new; end if;
 select sealed into closed from helpdesk_core.cg_ticket_resource_sets
  where workspace_id=r.workspace_id and account_id=r.account_id and ticket_id=r.ticket_id for update;
 if not found then raise exception 'Ticket resource parent is missing' using errcode='23503'; end if;
 if closed then raise exception 'Sealed resource selection is immutable' using errcode='23514'; end if;
 if tg_op='DELETE' then return old; else return new; end if;
end$$;
create trigger cg_guard_ticket_ref before insert or update or delete on helpdesk_core.cg_ticket_resource_refs
 for each row execute function helpdesk_core.cg_guard_ticket_resource_ref();

-- Additional predicate ONLY: pre-existing ownership/relationship/scopes remain in force.
-- Definer is necessary to read private configuration without granting SELECT/UPDATE
-- on the grant tables to helpdesk_app. It exposes only a current-actor Boolean.
create function helpdesk_auth.cg_ticket_resource_allowed(w uuid,a uuid,ticket uuid,op text)
returns boolean language plpgsql volatile security definer set search_path='' as $$
declare t helpdesk_core.tickets%rowtype; allowed record; clock_now timestamptz;
begin
 if op is null or op not in ('tickets.read','tickets.write','notes.read','notes.write') then return false; end if;
 if not coalesce(helpdesk_auth.has_scope(w,'tickets:read'),false) or not coalesce(helpdesk_auth.has_account(w,a),false) then return false; end if;
 select * into t from helpdesk_core.tickets where workspace_id=w and account_id=a and id=ticket;
 if not found or not coalesce(helpdesk_auth.can_read_ticket(w,a,t.product_instance_id,t.created_by),false) then return false; end if;
 -- No absence/default fallback is allowed once a source connection protects this product.
 if not exists(select 1 from helpdesk_auth.cg_resource_connections c where c.workspace_id=w and c.product_instance_id=t.product_instance_id) then return true; end if;
 if not helpdesk_auth.is_human() then return false; end if;
 if op<>'tickets.read' then
  if not helpdesk_auth.cg_ticket_resource_allowed(w,a,ticket,'tickets.read') then return false; end if;
  if op='tickets.write' and not helpdesk_auth.has_scope(w,'tickets:write') then return false; end if;
  if op in ('notes.read','notes.write') and (not helpdesk_auth.is_operator(w,a)
    or not helpdesk_auth.has_scope(w,case op when 'notes.read' then 'notes:read' else 'notes:write' end)) then return false; end if;
 end if;
 -- SHARE locks serialize local revocation and child invalidation with this read.
 select b.id as binding_id,s.expected_count as ticket_count,g.expected_count as grant_count,g.as_of,g.expires_at
 into allowed
 from helpdesk_core.cg_ticket_resource_sets s
 join helpdesk_auth.cg_resource_bindings b on b.workspace_id=s.workspace_id and b.account_id=s.account_id and b.id=s.binding_id
 join helpdesk_auth.cg_resource_connections c on c.workspace_id=b.workspace_id and c.id=b.connection_id and c.product_instance_id=t.product_instance_id
 join helpdesk_auth.cg_resource_grant_sets g on g.workspace_id=b.workspace_id and g.account_id=b.account_id and g.binding_id=b.id
  and g.principal_id=helpdesk_auth.actor_id() and g.operation=op
 where s.workspace_id=w and s.account_id=a and s.ticket_id=ticket and s.sealed and b.active and c.active and g.active
 for share of c,b,s,g;
 if not found then return false; end if;
 clock_now:=clock_timestamp();
 if allowed.as_of>clock_now or allowed.expires_at<=clock_now then return false; end if;
 if (select count(*) from helpdesk_core.cg_ticket_resource_refs r where r.workspace_id=w and r.account_id=a and r.ticket_id=ticket)<>allowed.ticket_count then return false; end if;
 if (select count(*) from helpdesk_auth.cg_resource_grant_refs r where r.workspace_id=w and r.account_id=a and r.binding_id=allowed.binding_id and r.principal_id=helpdesk_auth.actor_id() and r.operation=op)<>allowed.grant_count then return false; end if;
 return not exists(
  select 1 from helpdesk_core.cg_ticket_resource_refs r
  where r.workspace_id=w and r.account_id=a and r.ticket_id=ticket and not exists(
   select 1 from helpdesk_auth.cg_resource_grant_refs g where g.workspace_id=w and g.account_id=a and g.binding_id=allowed.binding_id
    and g.principal_id=helpdesk_auth.actor_id() and g.operation=op and g.resource_type=r.resource_type and g.resource_id=r.resource_id
  )
 );
end$$;

create function helpdesk_auth.cg_unscoped_product(w uuid,product uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select w=helpdesk_auth.workspace_id() and not exists(select 1 from helpdesk_auth.cg_resource_connections c where c.workspace_id=w and c.product_instance_id=product)
$$;
create policy cg_ticket_resource_read on helpdesk_core.tickets as restrictive for select to helpdesk_app
 using(helpdesk_auth.cg_ticket_resource_allowed(workspace_id,account_id,id,'tickets.read'));
create policy cg_ticket_resource_update on helpdesk_core.tickets as restrictive for update to helpdesk_app
 using(helpdesk_auth.cg_ticket_resource_allowed(workspace_id,account_id,id,'tickets.write'))
 with check(helpdesk_auth.cg_ticket_resource_allowed(workspace_id,account_id,id,'tickets.write'));
-- A dedicated atomic intake is still needed: the generic INSERT cannot omit metadata.
create policy cg_ticket_resource_insert on helpdesk_core.tickets as restrictive for insert to helpdesk_app
 with check(helpdesk_auth.cg_unscoped_product(workspace_id,product_instance_id));
create policy cg_message_resource_read on helpdesk_core.ticket_messages as restrictive for select to helpdesk_app
 using(helpdesk_auth.cg_ticket_resource_allowed(workspace_id,account_id,ticket_id,'tickets.read'));
create policy cg_message_resource_insert on helpdesk_core.ticket_messages as restrictive for insert to helpdesk_app
 with check(helpdesk_auth.cg_ticket_resource_allowed(workspace_id,account_id,ticket_id,'tickets.write'));
create policy cg_note_resource_read on helpdesk_core.internal_notes as restrictive for select to helpdesk_app
 using(helpdesk_auth.cg_ticket_resource_allowed(workspace_id,account_id,ticket_id,'notes.read'));
create policy cg_note_resource_insert on helpdesk_core.internal_notes as restrictive for insert to helpdesk_app
 with check(helpdesk_auth.cg_ticket_resource_allowed(workspace_id,account_id,ticket_id,'notes.write'));
create policy cg_event_resource_read on helpdesk_core.ticket_events as restrictive for select to helpdesk_app
 using(helpdesk_auth.cg_ticket_resource_allowed(workspace_id,account_id,ticket_id,case when type='note.created' then 'notes.read' else 'tickets.read' end));
create policy cg_event_resource_insert on helpdesk_core.ticket_events as restrictive for insert to helpdesk_app
 with check(helpdesk_auth.cg_ticket_resource_allowed(workspace_id,account_id,ticket_id,case when type='note.created' then 'notes.write' else 'tickets.write' end));
create policy cg_outbox_resource_insert on helpdesk_integration.outbox_events as restrictive for insert to helpdesk_app
 with check(helpdesk_auth.cg_ticket_resource_allowed(workspace_id,account_id,ticket_id,'tickets.write'));

-- Preserve the 009 receipt semantics; add resource checks BEFORE returning any cache.
-- VOLATILE permits the scoped helper's local SHARE locks and current snapshots.
create or replace function helpdesk_auth.lookup_idempotency(op text,request_key text) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare saved helpdesk_integration.api_idempotency_keys%rowtype; t helpdesk_core.tickets%rowtype;
begin
 select * into saved from helpdesk_integration.api_idempotency_keys
  where workspace_id=helpdesk_auth.workspace_id() and principal_id=helpdesk_auth.actor_id() and operation=op and key=request_key;
 if not found then return null; end if;
 select * into t from helpdesk_core.tickets where workspace_id=saved.workspace_id and id=saved.resource_ticket_id;
 if not found or not helpdesk_auth.has_scope(saved.workspace_id,'tickets:read')
   or not helpdesk_auth.can_read_ticket(t.workspace_id,t.account_id,t.product_instance_id,t.created_by)
   or not helpdesk_auth.cg_ticket_resource_allowed(t.workspace_id,t.account_id,t.id,'tickets.read')
   or (op like 'notes.create:%' and (not helpdesk_auth.has_scope(t.workspace_id,'notes:write')
       or not helpdesk_auth.is_operator(t.workspace_id,t.account_id)
       or not helpdesk_auth.cg_ticket_resource_allowed(t.workspace_id,t.account_id,t.id,'notes.write')))
   or ((op like 'priority.change:%' or op like 'assignments.change:%') and (not helpdesk_auth.has_scope(t.workspace_id,'tickets:write')
       or not helpdesk_auth.is_operator(t.workspace_id,t.account_id)
       or not helpdesk_auth.cg_ticket_resource_allowed(t.workspace_id,t.account_id,t.id,'tickets.write'))) then
  return jsonb_build_object('denied',true);
 end if;
 if saved.response_expires_at<=statement_timestamp() or saved.result is null then return jsonb_build_object('expired',true); end if;
 return jsonb_build_object('hash',saved.request_hash,'result',saved.result,'expired',false);
end$$;

-- Private config: no direct table privileges or public/client helper access.
do $privileges$ declare obj text; role_name text;
begin
 foreach obj in array array[
  'helpdesk_auth.cg_resource_connections','helpdesk_auth.cg_resource_bindings',
  'helpdesk_auth.cg_resource_grant_sets','helpdesk_auth.cg_resource_grant_refs',
  'helpdesk_core.cg_ticket_resource_sets','helpdesk_core.cg_ticket_resource_refs'] loop
  execute 'alter table '||obj||' enable row level security';
  execute 'alter table '||obj||' force row level security';
  execute 'revoke all on table '||obj||' from public,helpdesk_app';
  foreach role_name in array array['anon','authenticated','service_role','helpdesk_maintenance'] loop
   if exists(select 1 from pg_roles where rolname=role_name) then execute format('revoke all on table %s from %I',obj,role_name); end if;
  end loop;
 end loop;
 foreach obj in array array[
  'helpdesk_auth.cg_fixed_resource_namespace()','helpdesk_auth.cg_invalidate_resource_grant()',
  'helpdesk_core.cg_guard_ticket_resource_set()','helpdesk_core.cg_guard_ticket_resource_ref()',
  'helpdesk_auth.cg_ticket_resource_allowed(uuid,uuid,uuid,text)','helpdesk_auth.cg_unscoped_product(uuid,uuid)',
  'helpdesk_auth.lookup_idempotency(text,text)'] loop
  execute 'revoke all on function '||obj||' from public,helpdesk_app';
  foreach role_name in array array['anon','authenticated','service_role','helpdesk_maintenance'] loop
   if exists(select 1 from pg_roles where rolname=role_name) then execute format('revoke all on function %s from %I',obj,role_name); end if;
  end loop;
 end loop;
end $privileges$;
grant execute on function helpdesk_auth.cg_ticket_resource_allowed(uuid,uuid,uuid,text),helpdesk_auth.cg_unscoped_product(uuid,uuid),helpdesk_auth.lookup_idempotency(text,text) to helpdesk_app;
