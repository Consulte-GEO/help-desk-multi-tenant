-- Consulte GEO M05: transactional promotion of qualified M04 source.
-- Run only as the reviewed migration operator. No business seeds or gate activation.
BEGIN;
SET LOCAL statement_timeout='120s';
SET LOCAL lock_timeout='10s';
SET LOCAL idle_in_transaction_session_timeout='30s';
DO $m05$
DECLARE who oid:=current_user::regrole;name text;role_row record;relation record;
BEGIN
 IF current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999 OR current_user<>session_user
  OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE oid=who AND (rolsuper OR rolbypassrls) AND rolcreaterole)
  OR (SELECT count(*) FROM pg_namespace WHERE nspname IN ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit') AND nspowner=who)<>4
  OR to_regprocedure('helpdesk_auth.schema_version()') IS NULL THEN RAISE EXCEPTION 'Reviewed migration operator required' USING ERRCODE='HDU01';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('Consulte GEO schema upgrade',0));
 IF helpdesk_auth.schema_version() IS DISTINCT FROM '0.19.0' THEN RAISE EXCEPTION 'Exact prior schema required' USING ERRCODE='HDU02';END IF;
 -- Owner defaults can grant new objects even when existing service rights are empty.
 -- Qualified bodies explicitly revoke built-in PUBLIC function EXECUTE. No other
 -- non-owner automatic grant is adopted, globally or in these private schemas.
 IF EXISTS(SELECT 1 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
  WHERE d.defaclrole=who AND (d.defaclnamespace=0 OR d.defaclnamespace IN (SELECT oid FROM pg_namespace WHERE nspname IN ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit')))
   AND a.grantee<>who AND NOT (a.grantee=0 AND d.defaclobjtype='f' AND a.privilege_type='EXECUTE'))
 THEN RAISE EXCEPTION 'Incompatible operator defaults refused' USING ERRCODE='HDU05';END IF;
 IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit') AND c.relkind='r')<>25
  OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname LIKE 'helpdesk_%' AND c.relname ~ '^(cg_|hdn_)')
  OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname LIKE 'helpdesk_%' AND p.proname ~ '^(cg_|hdn_)') THEN RAISE EXCEPTION 'Partial or incompatible installation refused' USING ERRCODE='HDU03';END IF;
 FOR relation IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit') AND c.relkind='r' ORDER BY n.nspname,c.relname LOOP
  EXECUTE format('LOCK TABLE %I.%I IN ACCESS EXCLUSIVE MODE',relation.nspname,relation.relname);
 END LOOP;
 FOREACH name IN ARRAY ARRAY['helpdesk_resource_publisher','helpdesk_notification_worker'] LOOP
  SELECT * INTO role_row FROM pg_roles WHERE rolname=name;
  IF FOUND THEN
   IF role_row.rolsuper OR role_row.rolbypassrls OR role_row.rolcreaterole OR role_row.rolcreatedb OR role_row.rolreplication OR role_row.rolinherit
    OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=role_row.oid OR roleid=role_row.oid)
    OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname LIKE 'helpdesk_%' AND nspowner=role_row.oid)
    OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname LIKE 'helpdesk_%' AND c.relowner=role_row.oid)
    OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname LIKE 'helpdesk_%' AND p.proowner=role_row.oid)
    OR EXISTS(SELECT 1 FROM pg_namespace n WHERE n.nspname LIKE 'helpdesk_%' AND (has_schema_privilege(role_row.oid,n.oid,'CREATE,USAGE WITH GRANT OPTION') OR has_schema_privilege(role_row.oid,n.oid,'USAGE') AND (name<>'helpdesk_resource_publisher' OR n.nspname<>'helpdesk_auth')))
    OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname LIKE 'helpdesk_%' AND c.relkind='r' AND (has_table_privilege(role_row.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') OR has_any_column_privilege(role_row.oid,c.oid,'SELECT,INSERT,UPDATE,REFERENCES')))
    OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname LIKE 'helpdesk_%' AND has_function_privilege(role_row.oid,p.oid,'EXECUTE'))
   THEN RAISE EXCEPTION 'Existing service role is unsafe' USING ERRCODE='HDU04';END IF;
  ELSE EXECUTE format('CREATE ROLE %I NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS',name);END IF;
 END LOOP;
END $m05$;

-- SOURCE cg_resource_scope.sql SHA256 6e95aaba83e9411e11addc7f734c9f28f0713b81f3756d666fe000efd7d3e3c7
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

-- SOURCE cg_resource_observation.sql SHA256 b3fd7bddcdc352e738615c20eaa7377eaebe16985f262ddf7e08fab8682c1fe3
-- This records the provenance assigned by an authorized SERVER publisher, not
-- approval supplied by a browser. No production publisher is provided in this slice.
-- Historical observations survive grant revision changes; only an exact current
-- revision plus matching metadata is eligible for admission.
create table helpdesk_auth.cg_resource_observations(
 workspace_id uuid not null,account_id uuid not null,binding_id uuid not null,
 principal_id uuid not null,operation text not null,grant_revision bigint not null check(grant_revision>0),
 binding_revision text collate "C" not null check(length(binding_revision) between 1 and 256 and btrim(binding_revision)=binding_revision and binding_revision !~ '[[:cntrl:]]'),
 access_revision text collate "C" not null check(length(access_revision) between 1 and 256 and btrim(access_revision)=access_revision and access_revision !~ '[[:cntrl:]]'),
 manifest_fingerprint text collate "C" not null check(manifest_fingerprint ~ '^[a-f0-9]{64}$'),
 as_of timestamptz not null,expires_at timestamptz not null,
 expected_count integer not null check(expected_count between 0 and 1000),
 recorded_at timestamptz not null default clock_timestamp(),recorded_by name not null default session_user,
 primary key(workspace_id,account_id,binding_id,principal_id,operation,grant_revision),
 foreign key(workspace_id,account_id,binding_id,principal_id,operation)
  references helpdesk_auth.cg_resource_grant_sets(workspace_id,account_id,binding_id,principal_id,operation),
 check(isfinite(as_of) and isfinite(expires_at) and expires_at>as_of)
);
alter table helpdesk_auth.cg_resource_observations enable row level security;
alter table helpdesk_auth.cg_resource_observations force row level security;
revoke all on table helpdesk_auth.cg_resource_observations from public,helpdesk_app;

create function helpdesk_auth.cg_guard_resource_observation() returns trigger
language plpgsql security definer set search_path='' as $$
declare g helpdesk_auth.cg_resource_grant_sets%rowtype;
begin
 if tg_op<>'INSERT' then raise exception 'Resource observations are append-only' using errcode='23514'; end if;
 select * into g from helpdesk_auth.cg_resource_grant_sets
  where workspace_id=new.workspace_id and account_id=new.account_id and binding_id=new.binding_id
   and principal_id=new.principal_id and operation=new.operation for share;
 if not found then raise exception 'Resource observation has no grant parent' using errcode='23503'; end if;
 if not g.active or (g.revision,g.source_revision,g.as_of,g.expires_at,g.expected_count)
   is distinct from (new.grant_revision,new.access_revision,new.as_of,new.expires_at,new.expected_count)
  or g.as_of>clock_timestamp() or g.expires_at<=clock_timestamp()
  or (select count(*) from helpdesk_auth.cg_resource_grant_refs r
   where r.workspace_id=g.workspace_id and r.account_id=g.account_id and r.binding_id=g.binding_id
    and r.principal_id=g.principal_id and r.operation=g.operation)<>g.expected_count then
  raise exception 'Resource observation does not match its complete current grant' using errcode='23514';
 end if;
 -- These are database-controlled audit values, not proof that an external provider approved.
 new.recorded_at:=clock_timestamp();new.recorded_by:=session_user;
 return new;
end$$;
create trigger cg_immutable_resource_observation before insert or update or delete
 on helpdesk_auth.cg_resource_observations for each row execute function helpdesk_auth.cg_guard_resource_observation();

-- The JSON result is private DATA to be compared with the resolver-owned active
-- lease by resource-access-store.ts, not a transferable credential or a setter.
-- RLS/current-actor checks remain mandatory even for a matching recorded revision.
create function helpdesk_auth.cg_lock_ticket_scope(ticket uuid,op text) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare w uuid:=helpdesk_auth.workspace_id();p uuid:=helpdesk_auth.actor_id();a uuid;r record;refs jsonb;
begin
 if ticket is null or w is null or p is null or op is null
  or op not in ('tickets.read','tickets.write','notes.read','notes.write') then return null; end if;
 select account_id into a from helpdesk_core.tickets where workspace_id=w and id=ticket;
 if not found or not coalesce(helpdesk_auth.cg_ticket_resource_allowed(w,a,ticket,op),false) then return null; end if;
 select s.binding_id,b.connection_id,b.tenant_id,o.binding_revision,o.access_revision,o.manifest_fingerprint,g.as_of,g.expires_at
 into r
 from helpdesk_core.cg_ticket_resource_sets s
 join helpdesk_core.tickets t on t.workspace_id=s.workspace_id and t.account_id=s.account_id and t.id=s.ticket_id
 join helpdesk_auth.cg_resource_bindings b on b.workspace_id=s.workspace_id and b.account_id=s.account_id and b.id=s.binding_id
 join helpdesk_auth.cg_resource_connections c on c.workspace_id=b.workspace_id and c.id=b.connection_id and c.product_instance_id=t.product_instance_id
 join helpdesk_auth.cg_resource_grant_sets g on g.workspace_id=b.workspace_id and g.account_id=b.account_id and g.binding_id=b.id
  and g.principal_id=p and g.operation=op
 join helpdesk_auth.cg_resource_observations o on o.workspace_id=g.workspace_id and o.account_id=g.account_id and o.binding_id=g.binding_id
  and o.principal_id=g.principal_id and o.operation=g.operation and o.grant_revision=g.revision
  and o.access_revision=g.source_revision and o.as_of=g.as_of and o.expires_at=g.expires_at and o.expected_count=g.expected_count
 where s.workspace_id=w and s.account_id=a and s.ticket_id=ticket and s.sealed and c.active and b.active and g.active
 for share of c,b,s,g,o;
 if not found or r.as_of>clock_timestamp() or r.expires_at<=clock_timestamp() then return null; end if;
 -- Recheck the current policy after all local rows have been locked. The helper
 -- also checks cardinality and full coverage; a grant for only A cannot admit A+C.
 if not coalesce(helpdesk_auth.cg_ticket_resource_allowed(w,a,ticket,op),false) then return null; end if;
 select jsonb_agg(jsonb_build_object('connectionId',r.connection_id,'tenantId',r.tenant_id,'type',x.resource_type,'id',x.resource_id)
  order by x.resource_type,x.resource_id) into refs
 from helpdesk_core.cg_ticket_resource_refs x where x.workspace_id=w and x.account_id=a and x.ticket_id=ticket;
 return jsonb_build_object('ticketId',ticket,'principalId',p,'workspaceId',w,'accountId',a,'bindingId',r.binding_id,
  'bindingRevision',r.binding_revision,'accessRevision',r.access_revision,'manifestFingerprint',r.manifest_fingerprint,'operation',op,
  'asOf',to_char(r.as_of at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
  'expiresAt',to_char(r.expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'refs',refs);
end$$;
revoke all on function helpdesk_auth.cg_guard_resource_observation(),helpdesk_auth.cg_lock_ticket_scope(uuid,text) from public,helpdesk_app;
do $clients$ declare r text;
begin
 foreach r in array array['anon','authenticated','service_role','helpdesk_maintenance'] loop
  if exists(select 1 from pg_roles where rolname=r) then
   execute format('revoke all on table helpdesk_auth.cg_resource_observations from %I',r);
   execute format('revoke all on function helpdesk_auth.cg_guard_resource_observation(),helpdesk_auth.cg_lock_ticket_scope(uuid,text) from %I',r);
  end if;
 end loop;
end $clients$;
grant execute on function helpdesk_auth.cg_lock_ticket_scope(uuid,text) to helpdesk_app;

-- SOURCE cg_resource_publication.sql SHA256 09d610deec654d5c9d52d2e08f35d85728fb78ba7dd6a7e045d77132c028593c
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
   and not p.rolcreaterole and not p.rolcreatedb and not p.rolinherit and not p.rolreplication
   and not exists(select 1 from pg_auth_members m where m.member=p.oid)
   and not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relowner=p.oid and n.nspname like 'helpdesk_%')
   and not exists(select 1 from pg_namespace n where n.nspowner=p.oid and n.nspname like 'helpdesk_%')
   and not exists(select 1 from pg_proc f join pg_namespace n on n.oid=f.pronamespace where f.proowner=p.oid and n.nspname like 'helpdesk_%')
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
declare v jsonb;opened jsonb;old_snapshot jsonb;n jsonb;v_ref jsonb;k text;start_at timestamptz;end_at timestamptz;
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
   (case when length(n->>k)=24 then left(n->>k,23)||'000Z' else n->>k end) then
   raise exception 'Invalid publication instant' using errcode='PGR03'; end if;
 end loop;
 start_at:=(n->>'asOf')::timestamptz;end_at:=(n->>'expiresAt')::timestamptz;
 if not isfinite(start_at) or not isfinite(end_at) or start_at>clock_timestamp() or end_at<=clock_timestamp() or end_at<=start_at then
  raise exception 'Publication snapshot not current' using errcode='PGR01'; end if;
 count_refs:=jsonb_array_length(n->'resources');
 if count_refs>1000 or (n->>'state'='revoked' and count_refs<>0) then raise exception 'Invalid complete coverage' using errcode='PGR03'; end if;
 for v_ref in select * from jsonb_array_elements(n->'resources') loop
  if jsonb_typeof(v_ref)<>'object' or (select count(*) from jsonb_object_keys(v_ref))<>4
   or v_ref->'connectionId' is distinct from v->'connectionId' or v_ref->'tenantId' is distinct from v->'tenantId'
   or jsonb_typeof(v_ref->'type') is distinct from 'string' or v_ref->>'type' !~ '^[a-z][a-z0-9_]{0,31}$'
   or jsonb_typeof(v_ref->'id') is distinct from 'string' or length(v_ref->>'id') not between 1 and 256
   or btrim(v_ref->>'id')<>v_ref->>'id' or v_ref->>'id' ~ '[[:cntrl:]]' then
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

-- SOURCE hdn_execution_checklist.sql SHA256 7b7baab705549e0b706fbd1aaf76cb80558e68a53784718cf7029f1f62ec77bd
CREATE FUNCTION helpdesk_auth.hdn_valid_execution_template(d jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE item jsonb;seen text[]:='{}'::text[];has_required boolean:=false;
BEGIN
 IF d IS NULL OR jsonb_typeof(d)<>'object' THEN RETURN false;END IF;
 IF (SELECT count(*) FROM jsonb_object_keys(d))<>5 OR NOT (d ?& ARRAY['schema','id','version','status','items'])
  OR d->'schema'<>'1'::jsonb OR d->>'status' IS DISTINCT FROM 'published'
  OR jsonb_typeof(d->'id')<>'string' OR d->>'id'!~'^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$'
  OR jsonb_typeof(d->'version')<>'number' OR d->>'version'!~'^[1-9][0-9]{0,8}$'
  OR jsonb_typeof(d->'items')<>'array' OR jsonb_array_length(d->'items') NOT BETWEEN 1 AND 100 THEN RETURN false;END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(d->'items') LOOP
  IF jsonb_typeof(item)<>'object' THEN RETURN false;END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(item))<>6 OR NOT (item ?& ARRAY['id','label','required','allowNotApplicable','evidenceRequired','risk'])
   OR jsonb_typeof(item->'id')<>'string' OR item->>'id'!~'^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$'
   OR item->>'id'=ANY(seen) OR jsonb_typeof(item->'label')<>'string' OR length(btrim(item->>'label')) NOT BETWEEN 1 AND 300
   OR jsonb_typeof(item->'required')<>'boolean' OR jsonb_typeof(item->'allowNotApplicable')<>'boolean'
   OR jsonb_typeof(item->'evidenceRequired')<>'boolean' OR (item->>'risk') NOT IN ('ordinary','sensitive')
   OR jsonb_typeof(item->'risk')<>'string' THEN RETURN false;END IF;
  IF item->>'risk'='sensitive' AND (item->'required'<>'true'::jsonb OR item->'allowNotApplicable'<>'false'::jsonb OR item->'evidenceRequired'<>'true'::jsonb) THEN RETURN false;END IF;
  seen:=array_append(seen,item->>'id');has_required:=has_required OR item->'required'='true'::jsonb;
 END LOOP;
 RETURN has_required;
EXCEPTION WHEN data_exception THEN RETURN false;
END$$;

CREATE TABLE helpdesk_core.hdn_execution_templates(
 workspace_id uuid NOT NULL REFERENCES helpdesk_core.workspaces(id),
 template_id text COLLATE "C" NOT NULL CHECK(template_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$'),
 version integer NOT NULL CHECK(version>0),
 sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 document jsonb NOT NULL CHECK(helpdesk_auth.hdn_valid_execution_template(document)),
 PRIMARY KEY(workspace_id,template_id,version),
 UNIQUE(workspace_id,template_id,version,sha256),
 CHECK(document->>'status'='published' AND document->>'id'=template_id AND (document->>'version')::integer=version),
 CHECK(jsonb_typeof(document->'items')='array' AND jsonb_array_length(document->'items') BETWEEN 1 AND 100)
);
-- This binding is provisioned by a future qualified intake/profile publisher,
-- not by the caller. Do not infer it from a ticket's text or from a draft template.
CREATE TABLE helpdesk_core.hdn_execution_bindings(
 workspace_id uuid NOT NULL,account_id uuid NOT NULL,ticket_id uuid NOT NULL,
 profile_version_id text COLLATE "C" NOT NULL CHECK(profile_version_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$'),
 template_id text NOT NULL,template_version integer NOT NULL,template_sha256 text NOT NULL,
 PRIMARY KEY(workspace_id,account_id,ticket_id),
 FOREIGN KEY(workspace_id,account_id,ticket_id) REFERENCES helpdesk_core.tickets(workspace_id,account_id,id),
 FOREIGN KEY(workspace_id,template_id,template_version,template_sha256) REFERENCES helpdesk_core.hdn_execution_templates(workspace_id,template_id,version,sha256)
);
CREATE TABLE helpdesk_core.hdn_execution_snapshots(
 workspace_id uuid NOT NULL,account_id uuid NOT NULL,ticket_id uuid NOT NULL,ticket_version integer NOT NULL CHECK(ticket_version>0),
 revision bigint NOT NULL CHECK(revision BETWEEN 1 AND 9007199254740990),document jsonb NOT NULL,
 PRIMARY KEY(workspace_id,account_id,ticket_id,ticket_version),
 FOREIGN KEY(workspace_id,account_id,ticket_id) REFERENCES helpdesk_core.hdn_execution_bindings(workspace_id,account_id,ticket_id),
 CHECK(jsonb_typeof(document)='object' AND document ?& ARRAY['workspaceId','accountId','ticketId','ticketVersion','profileVersionId','reference','revision','entries']
  AND (document->>'workspaceId')::uuid=workspace_id AND (document->>'accountId')::uuid=account_id AND (document->>'ticketId')::uuid=ticket_id
  AND (document->>'ticketVersion')::integer=ticket_version AND (document->>'revision')::bigint=revision
  AND jsonb_typeof(document->'entries')='array' AND jsonb_array_length(document->'entries')<=100)
);
CREATE TABLE helpdesk_core.hdn_execution_audit(
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL,account_id uuid NOT NULL,ticket_id uuid NOT NULL,ticket_version integer NOT NULL,
 checklist_revision bigint NOT NULL,actor_id uuid NOT NULL REFERENCES helpdesk_auth.principals(id),request_id uuid NOT NULL,
 at timestamptz NOT NULL,reason text,before_document jsonb,after_document jsonb NOT NULL,
 UNIQUE(workspace_id,account_id,ticket_id,ticket_version,checklist_revision),
 FOREIGN KEY(workspace_id,account_id,ticket_id,ticket_version) REFERENCES helpdesk_core.hdn_execution_snapshots(workspace_id,account_id,ticket_id,ticket_version)
);
CREATE TABLE helpdesk_core.hdn_execution_receipts(
 workspace_id uuid NOT NULL,account_id uuid NOT NULL,ticket_id uuid NOT NULL,actor_id uuid NOT NULL REFERENCES helpdesk_auth.principals(id),
 key text NOT NULL CHECK(key ~ '^[A-Za-z0-9._:-]{16,128}$'),intent_hash text NOT NULL CHECK(intent_hash ~ '^[a-f0-9]{64}$'),
 command jsonb NOT NULL,audit_id uuid NOT NULL REFERENCES helpdesk_core.hdn_execution_audit(id),result jsonb NOT NULL,
 PRIMARY KEY(workspace_id,account_id,ticket_id,actor_id,key),
 FOREIGN KEY(workspace_id,account_id,ticket_id) REFERENCES helpdesk_core.hdn_execution_bindings(workspace_id,account_id,ticket_id)
);
CREATE FUNCTION helpdesk_auth.hdn_execution_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'Published records are immutable' USING ERRCODE='23514'; END$$;
CREATE TRIGGER hdn_template_immutable BEFORE UPDATE OR DELETE ON helpdesk_core.hdn_execution_templates FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdn_execution_immutable();
CREATE TRIGGER hdn_binding_immutable BEFORE UPDATE OR DELETE ON helpdesk_core.hdn_execution_bindings FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdn_execution_immutable();
CREATE TRIGGER hdn_audit_immutable BEFORE UPDATE OR DELETE ON helpdesk_core.hdn_execution_audit FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdn_execution_immutable();
CREATE TRIGGER hdn_receipt_immutable BEFORE UPDATE OR DELETE ON helpdesk_core.hdn_execution_receipts FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdn_execution_immutable();

CREATE FUNCTION helpdesk_auth.hdn_checklist_contract() RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$SELECT 'hdn-checklist-candidate-1'::text$$;
-- Definer functions are restricted entrypoints for otherwise unreadable private
-- rows. They expose no arbitrary SQL and reauthorize the CURRENT server actor.
-- No client/Data API role receives access. The application login remains restricted.
CREATE FUNCTION helpdesk_auth.hdn_checklist_ticket(target uuid,writing boolean)
RETURNS helpdesk_core.tickets LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE t helpdesk_core.tickets%rowtype; w uuid:=helpdesk_auth.workspace_id(); a uuid:=helpdesk_auth.actor_id();
BEGIN
 IF session_user<>'helpdesk_app' OR NOT coalesce(helpdesk_auth.is_human(),false) THEN RAISE EXCEPTION 'Denied' USING ERRCODE='HD001'; END IF;
 SELECT * INTO t FROM helpdesk_core.tickets WHERE workspace_id=w AND id=target FOR UPDATE;
 IF NOT FOUND OR NOT coalesce(helpdesk_auth.is_operator(w,t.account_id),false)
  OR NOT coalesce(helpdesk_auth.has_scope(w,'notes:read'),false)
  OR NOT coalesce(helpdesk_auth.can_read_ticket(w,t.account_id,t.product_instance_id,t.created_by),false)
  OR NOT coalesce(helpdesk_auth.cg_ticket_resource_allowed(w,t.account_id,target,'notes.read'),false) THEN
  RAISE EXCEPTION 'Denied' USING ERRCODE='HD001';
 END IF;
 IF writing AND (t.assigned_to IS DISTINCT FROM a OR NOT coalesce(helpdesk_auth.has_scope(w,'tickets:write'),false)
  OR NOT coalesce(helpdesk_auth.has_scope(w,'notes:write'),false)
  OR NOT coalesce(helpdesk_auth.cg_ticket_resource_allowed(w,t.account_id,target,'tickets.write'),false)
  OR NOT coalesce(helpdesk_auth.cg_ticket_resource_allowed(w,t.account_id,target,'notes.write'),false)) THEN
  RAISE EXCEPTION 'Denied' USING ERRCODE='HD001';
 END IF;
 RETURN t;
END$$;
CREATE FUNCTION helpdesk_auth.hdn_lock_execution_checklist(target uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE t helpdesk_core.tickets%rowtype;b helpdesk_core.hdn_execution_bindings%rowtype;
 d jsonb;s jsonb;r jsonb;c jsonb;
BEGIN
 t:=helpdesk_auth.hdn_checklist_ticket(target,false);
 SELECT * INTO b FROM helpdesk_core.hdn_execution_bindings WHERE workspace_id=t.workspace_id AND account_id=t.account_id AND ticket_id=t.id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Required binding unavailable' USING ERRCODE='HD007'; END IF;
 SELECT document INTO d FROM helpdesk_core.hdn_execution_templates WHERE workspace_id=b.workspace_id AND template_id=b.template_id AND version=b.template_version AND sha256=b.template_sha256 FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Required template unavailable' USING ERRCODE='HD007'; END IF;
 r:=jsonb_build_object('id',b.template_id,'version',b.template_version,'sha256',b.template_sha256);
 c:=jsonb_build_object('workspaceId',t.workspace_id,'accountId',t.account_id,'ticketId',t.id,'ticketVersion',t.version,'profileVersionId',b.profile_version_id,'reference',r);
 SELECT document INTO s FROM helpdesk_core.hdn_execution_snapshots WHERE workspace_id=t.workspace_id AND account_id=t.account_id AND ticket_id=t.id AND ticket_version=t.version FOR UPDATE;
 RETURN jsonb_build_object('context',c,'template',d,'snapshot',s,'ticketStatus',t.status,'assignedTo',t.assigned_to,
  'readAt',to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
END$$;
CREATE FUNCTION helpdesk_auth.hdn_checklist_receipt(target uuid,intent_key text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE t helpdesk_core.tickets%rowtype;r helpdesk_core.hdn_execution_receipts%rowtype;
BEGIN
 t:=helpdesk_auth.hdn_checklist_ticket(target,false);
 SELECT * INTO r FROM helpdesk_core.hdn_execution_receipts WHERE workspace_id=t.workspace_id AND account_id=t.account_id AND ticket_id=target AND actor_id=helpdesk_auth.actor_id() AND key=intent_key;
 IF NOT FOUND THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('key',r.key,'hash',r.intent_hash,'command',r.command,'result',r.result);
END$$;
CREATE FUNCTION helpdesk_auth.hdn_checklist_evidence(target uuid,selectors text[]) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE t helpdesk_core.tickets%rowtype;selector text;n helpdesk_core.internal_notes%rowtype;result jsonb:='[]'::jsonb;
BEGIN
 t:=helpdesk_auth.hdn_checklist_ticket(target,false);
 IF selectors IS NULL OR coalesce(array_ndims(selectors),1)<>1 OR cardinality(selectors)>20
  OR (SELECT count(DISTINCT x) FROM unnest(selectors) x)<>cardinality(selectors) THEN RAISE EXCEPTION 'Evidence denied' USING ERRCODE='HD004';END IF;
 FOREACH selector IN ARRAY selectors LOOP
  IF selector IS NULL OR selector!~'^note:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'Evidence denied' USING ERRCODE='HD004';END IF;
  SELECT * INTO n FROM helpdesk_core.internal_notes WHERE workspace_id=t.workspace_id AND account_id=t.account_id AND ticket_id=target AND id=substring(selector FROM 6)::uuid FOR SHARE;
  IF NOT FOUND OR n.actor_id IS DISTINCT FROM helpdesk_auth.actor_id() OR n.created_at>clock_timestamp() THEN RAISE EXCEPTION 'Evidence denied' USING ERRCODE='HD004';END IF;
  result:=result||jsonb_build_array(jsonb_build_object('reference',selector,'workspaceId',n.workspace_id,'accountId',n.account_id,'ticketId',n.ticket_id,'actorId',n.actor_id,'at',to_char(n.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')));
 END LOOP;
 RETURN result;
END$$;

-- A resolution snapshot must still have its referenced notes. UI/read and receipt
-- reads remain separate so an operator can repair an incomplete checklist and
-- inspect historical receipts without pretending to repeat a resolution.
CREATE FUNCTION helpdesk_auth.hdn_lock_execution_checklist_resolution(target uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_record jsonb;v_snapshot jsonb;v_entry jsonb;v_selector jsonb;v_request jsonb;
 v_requests jsonb:='[]'::jsonb;v_note_ids uuid[]:='{}'::uuid[];v_unique integer;
 v_note record;v_evidence jsonb:='[]'::jsonb;v_reference text;
BEGIN
 -- Reuses the current actor/resource checks and ticket/template/snapshot locks.
 v_record:=helpdesk_auth.hdn_lock_execution_checklist(target);
 v_snapshot:=nullif(v_record->'snapshot','null'::jsonb);
 IF v_snapshot IS NULL THEN
  RETURN jsonb_build_object('record',v_record,'evidence',v_evidence);
 END IF;
 IF jsonb_typeof(v_snapshot->'entries') IS DISTINCT FROM 'array'
  OR jsonb_array_length(v_snapshot->'entries')>100 THEN
  RAISE EXCEPTION 'Evidence denied' USING ERRCODE='HD004';
 END IF;
 FOR v_entry IN SELECT value FROM jsonb_array_elements(v_snapshot->'entries') LOOP
  IF jsonb_typeof(v_entry->'evidenceRefs') IS DISTINCT FROM 'array'
   OR jsonb_array_length(v_entry->'evidenceRefs')>20 THEN
   RAISE EXCEPTION 'Evidence denied' USING ERRCODE='HD004';
  END IF;
  FOR v_selector IN SELECT value FROM jsonb_array_elements(v_entry->'evidenceRefs') LOOP
   v_reference:=v_selector#>>'{}';
   IF jsonb_typeof(v_selector) IS DISTINCT FROM 'string'
    OR v_reference IS NULL OR v_reference!~'^note:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    OR v_entry->>'status' IS DISTINCT FROM 'done'
    OR jsonb_typeof(v_entry->'actorId') IS DISTINCT FROM 'string'
    OR jsonb_typeof(v_entry->'at') IS DISTINCT FROM 'string' THEN
    RAISE EXCEPTION 'Evidence denied' USING ERRCODE='HD004';
   END IF;
   -- Bind each reference to EVERY marking using it, not only to one final item.
   v_requests:=v_requests||jsonb_build_array(jsonb_build_object('reference',v_reference,'actorId',v_entry->>'actorId','at',v_entry->>'at'));
   v_note_ids:=array_append(v_note_ids,substring(v_reference FROM 6)::uuid);
  END LOOP;
 END LOOP;
 SELECT count(DISTINCT n)::integer INTO v_unique FROM unnest(v_note_ids) n;
 -- One lock/read per distinct note, deterministic order, no note body projected.
 -- SHARE is required here because the evidence must not change or be removed
 -- before the transaction that resolves the ticket reaches COMMIT.
 FOR v_note IN
  SELECT n.id,n.workspace_id,n.account_id,n.ticket_id,n.actor_id,n.created_at
  FROM helpdesk_core.internal_notes n
  WHERE n.workspace_id=(v_record->'context'->>'workspaceId')::uuid
   AND n.account_id=(v_record->'context'->>'accountId')::uuid
   AND n.ticket_id=target AND n.id=ANY(v_note_ids)
  ORDER BY n.id FOR SHARE OF n
 LOOP
  v_reference:='note:'||v_note.id::text;
  FOR v_request IN SELECT value FROM jsonb_array_elements(v_requests) q WHERE q.value->>'reference'=v_reference LOOP
   IF (v_request->>'actorId')::uuid IS DISTINCT FROM v_note.actor_id
    OR v_note.created_at>(v_request->>'at')::timestamptz
    OR v_note.created_at>(v_record->>'readAt')::timestamptz THEN
    RAISE EXCEPTION 'Evidence denied' USING ERRCODE='HD004';
   END IF;
  END LOOP;
  v_evidence:=v_evidence||jsonb_build_array(jsonb_build_object('reference',v_reference,
   'workspaceId',v_note.workspace_id,'accountId',v_note.account_id,'ticketId',v_note.ticket_id,
   'actorId',v_note.actor_id,'at',to_char(v_note.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')));
 END LOOP;
 IF jsonb_array_length(v_evidence)<>v_unique THEN
  RAISE EXCEPTION 'Evidence denied' USING ERRCODE='HD004';
 END IF;
 -- No old authorization is a fallback after a blocked/read operation.
 PERFORM helpdesk_auth.hdn_checklist_ticket(target,false);
 v_record:=jsonb_set(v_record,'{readAt}',to_jsonb(to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')));
 RETURN jsonb_build_object('record',v_record,'evidence',v_evidence);
EXCEPTION WHEN data_exception THEN
 RAISE EXCEPTION 'Evidence denied' USING ERRCODE='HD004';
END$$;

CREATE FUNCTION helpdesk_auth.hdn_mark_execution_checklist(target uuid,cmd jsonb,intent_hash text,intent_key text,request_id uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE t helpdesk_core.tickets%rowtype;view jsonb;prior jsonb;old_doc jsonb;next_doc jsonb;
 tv integer;cv bigint;current_rev bigint;item jsonb;entry jsonb;entries jsonb;selectors text[];ev jsonb;
 item_id text;state text;reason text;ack boolean;now_text text;stamp timestamptz;audit_id uuid:=gen_random_uuid();receipt jsonb;result jsonb;
BEGIN
 -- Validate JSON *types* as well as text, before any casting/reading. No actor/time fields.
 IF cmd IS NULL OR jsonb_typeof(cmd)<>'object' THEN RAISE EXCEPTION 'Invalid command' USING ERRCODE='HD006';END IF;
 IF (SELECT count(*) FROM jsonb_object_keys(cmd))<>8
  OR NOT cmd ?& ARRAY['action','itemId','status','expectedTicketVersion','expectedChecklistRevision','evidenceRefs','reason','acknowledgeRisk']
  OR cmd->>'action' IS DISTINCT FROM 'mark' OR jsonb_typeof(cmd->'itemId')<>'string' OR jsonb_typeof(cmd->'status')<>'string'
  OR (cmd->>'status') NOT IN ('pending','done','not_applicable')
  OR jsonb_typeof(cmd->'expectedTicketVersion')<>'number' OR (cmd->>'expectedTicketVersion')!~'^[1-9][0-9]{0,8}$'
  OR jsonb_typeof(cmd->'expectedChecklistRevision')<>'number' OR (cmd->>'expectedChecklistRevision')!~'^(0|[1-9][0-9]{0,15})$'
  OR jsonb_typeof(cmd->'acknowledgeRisk')<>'boolean'
  OR jsonb_typeof(cmd->'evidenceRefs')<>'array'
  OR jsonb_array_length(cmd->'evidenceRefs')>20
  OR jsonb_typeof(cmd->'reason') NOT IN ('string','null')
  OR request_id IS NULL OR intent_key IS NULL OR intent_key!~'^[A-Za-z0-9._:-]{16,128}$'
  OR intent_hash IS NULL OR intent_hash!~'^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid command' USING ERRCODE='HD006';END IF;
 item_id:=cmd->>'itemId';state:=cmd->>'status';reason:=cmd->>'reason';ack:=(cmd->>'acknowledgeRisk')::boolean;
 tv:=(cmd->>'expectedTicketVersion')::integer;cv:=(cmd->>'expectedChecklistRevision')::bigint;
 IF cv>=9007199254740991 OR item_id!~'^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$'
  OR reason IS NOT NULL AND (length(btrim(reason))=0 OR length(reason)>2000 OR reason~'[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]') THEN RAISE EXCEPTION 'Invalid command' USING ERRCODE='HD006';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(cmd->'evidenceRefs') x WHERE jsonb_typeof(x)<>'string') THEN RAISE EXCEPTION 'Invalid evidence' USING ERRCODE='HD006';END IF;
 SELECT coalesce(array_agg(x),'{}'::text[]) INTO selectors FROM jsonb_array_elements_text(cmd->'evidenceRefs') x;
 IF state<>'done' AND (reason IS NULL OR cardinality(selectors)>0 OR ack) THEN RAISE EXCEPTION 'Invalid reset or waiver' USING ERRCODE='HD006';END IF;
 -- Own receipt is read under CURRENT read authorization. Historical replay does
 -- not need the old ticket state/assignee to be restored and cannot publish again.
 t:=helpdesk_auth.hdn_checklist_ticket(target,false);
 prior:=helpdesk_auth.hdn_checklist_receipt(target,intent_key);
 IF prior IS NOT NULL THEN
  IF prior->>'hash' IS DISTINCT FROM intent_hash OR prior->'command' IS DISTINCT FROM cmd THEN RAISE EXCEPTION 'Intent conflict' USING ERRCODE='HD005';END IF;
  RETURN jsonb_build_object('receipt',prior->'result','record',NULL);
 END IF;
 t:=helpdesk_auth.hdn_checklist_ticket(target,true);
 IF t.status NOT IN ('triage','open','waiting_internal','waiting_third_party') THEN RAISE EXCEPTION 'State conflict' USING ERRCODE='HD003';END IF;
 view:=helpdesk_auth.hdn_lock_execution_checklist(target);old_doc:=nullif(view->'snapshot','null'::jsonb);
 current_rev:=coalesce((old_doc->>'revision')::bigint,0);
 IF t.version<>tv OR current_rev<>cv THEN RAISE EXCEPTION 'Version conflict' USING ERRCODE='HD002';END IF;
 SELECT x INTO item FROM jsonb_array_elements(view->'template'->'items') x WHERE x->>'id'=item_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown item' USING ERRCODE='HD006';END IF;
 IF state='not_applicable' AND (item->>'allowNotApplicable' IS DISTINCT FROM 'true' OR item->>'risk'='sensitive')
  OR ack AND item->>'risk' IS DISTINCT FROM 'sensitive' THEN RAISE EXCEPTION 'Invalid mark' USING ERRCODE='HD006';END IF;
 IF state='done' AND (item->>'evidenceRequired'='true' AND cardinality(selectors)=0
  OR item->>'risk'='sensitive' AND (NOT ack OR cardinality(selectors)=0)) THEN RAISE EXCEPTION 'Evidence and acknowledgement required' USING ERRCODE='HD004';END IF;
 ev:=helpdesk_auth.hdn_checklist_evidence(target,selectors);
 stamp:=clock_timestamp();now_text:=to_char(stamp AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
 entry:=jsonb_build_object('itemId',item_id,'status',state,'actorId',CASE WHEN state='pending' THEN NULL ELSE helpdesk_auth.actor_id() END,
  'at',CASE WHEN state='pending' THEN NULL ELSE now_text END,'evidenceRefs',cmd->'evidenceRefs',
  'reason',CASE WHEN state='pending' THEN NULL ELSE reason END,
  'riskAcknowledgement',CASE WHEN ack THEN jsonb_build_object('actorId',helpdesk_auth.actor_id(),'at',now_text,'statement','Reconheço o risco descrito e registrei a conferência da execução. Esta marcação não autoriza ação no sistema de origem.') ELSE NULL END);
 SELECT coalesce(jsonb_agg(CASE WHEN it.value->>'id'=item_id THEN entry ELSE prior_entry.value END ORDER BY it.ordinality),'[]'::jsonb) INTO entries
  FROM jsonb_array_elements(view->'template'->'items') WITH ORDINALITY it(value,ordinality)
  LEFT JOIN LATERAL (SELECT x.value FROM jsonb_array_elements(coalesce(old_doc->'entries','[]'::jsonb)) x(value) WHERE x.value->>'itemId'=it.value->>'id') prior_entry ON true
  WHERE it.value->>'id'=item_id OR prior_entry.value IS NOT NULL;
 next_doc:=(view->'context')||jsonb_build_object('revision',cv+1,'entries',entries);
 INSERT INTO helpdesk_core.hdn_execution_snapshots(workspace_id,account_id,ticket_id,ticket_version,revision,document)
  VALUES(t.workspace_id,t.account_id,t.id,t.version,cv+1,next_doc)
  ON CONFLICT(workspace_id,account_id,ticket_id,ticket_version) DO UPDATE SET revision=EXCLUDED.revision,document=EXCLUDED.document
  WHERE helpdesk_core.hdn_execution_snapshots.revision=cv;
 IF NOT FOUND THEN RAISE EXCEPTION 'Version conflict' USING ERRCODE='HD002';END IF;
 INSERT INTO helpdesk_core.hdn_execution_audit(id,workspace_id,account_id,ticket_id,ticket_version,checklist_revision,actor_id,request_id,at,reason,before_document,after_document)
  VALUES(audit_id,t.workspace_id,t.account_id,t.id,t.version,cv+1,helpdesk_auth.actor_id(),request_id,stamp,reason,old_doc,next_doc);
 receipt:=jsonb_build_object('ticketId',t.id,'workspaceId',t.workspace_id,'accountId',t.account_id,'actorId',helpdesk_auth.actor_id(),
  'itemId',item_id,'status',state,'ticketVersion',t.version,'checklistRevision',cv+1,'auditId',audit_id,'at',now_text,'replayed',false);
 INSERT INTO helpdesk_core.hdn_execution_receipts(workspace_id,account_id,ticket_id,actor_id,key,intent_hash,command,audit_id,result)
  VALUES(t.workspace_id,t.account_id,t.id,helpdesk_auth.actor_id(),intent_key,intent_hash,cmd,audit_id,receipt);
 result:=helpdesk_auth.hdn_lock_execution_checklist(target);
 RETURN jsonb_build_object('receipt',receipt,'record',result);
END$$;

-- HDN-01g: rejection boundary used by the ORIGINAL PostgresStore.
-- This is not a resolver or a token authorizing the structured workflow. It
-- refuses a status-changing completion on a ticket with a required checklist.
-- Legacy tickets and same-state message version bumps keep their old behavior.
CREATE FUNCTION helpdesk_auth.hdn_legacy_terminal_update(w uuid,a uuid,target uuid,next_status text,expected_version integer)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE t helpdesk_core.tickets%rowtype;
BEGIN
 IF session_user<>'helpdesk_app' OR w IS DISTINCT FROM helpdesk_auth.workspace_id()
  OR a IS NULL OR target IS NULL OR next_status IS NULL OR next_status NOT IN ('resolved','closed')
  OR expected_version IS NULL OR expected_version<1
  OR NOT coalesce(helpdesk_auth.has_scope(w,'tickets:read'),false)
  OR NOT coalesce(helpdesk_auth.has_scope(w,'tickets:write'),false) THEN
  RAISE EXCEPTION 'Denied' USING ERRCODE='HD001';
 END IF;
 -- Same parent-first lock order as the marking/reading helpers. No private note
 -- permission is requested for an unbound legacy ticket or same-state message.
 SELECT * INTO t FROM helpdesk_core.tickets
  WHERE workspace_id=w AND account_id=a AND id=target FOR UPDATE;
 IF NOT FOUND OR NOT coalesce(helpdesk_auth.has_scope(w,'tickets:read'),false)
  OR NOT coalesce(helpdesk_auth.has_scope(w,'tickets:write'),false)
  OR NOT coalesce(helpdesk_auth.can_read_ticket(w,a,t.product_instance_id,t.created_by),false)
  OR NOT coalesce(helpdesk_auth.cg_ticket_resource_allowed(w,a,target,'tickets.write'),false) THEN
  RAISE EXCEPTION 'Denied' USING ERRCODE='HD001';
 END IF;
 IF t.version<>expected_version THEN
  RAISE EXCEPTION 'Version conflict' USING ERRCODE='HD002';
 END IF;
 IF t.status=next_status THEN RETURN 'legacy_allowed'; END IF;
 PERFORM 1 FROM helpdesk_core.hdn_execution_bindings
  WHERE workspace_id=w AND account_id=a AND ticket_id=target FOR SHARE;
 IF FOUND THEN
  -- A database error also marks the transaction failed if an internal caller
  -- accidentally catches it. Never return a permissive default after refusal.
  RAISE EXCEPTION 'Structured workflow required' USING ERRCODE='HD008';
 END IF;
 RETURN 'legacy_allowed';
END$$;

DO $privileges$
DECLARE obj text;role_name text;
BEGIN
 FOREACH obj IN ARRAY ARRAY['helpdesk_core.hdn_execution_templates','helpdesk_core.hdn_execution_bindings','helpdesk_core.hdn_execution_snapshots','helpdesk_core.hdn_execution_audit','helpdesk_core.hdn_execution_receipts'] LOOP
  EXECUTE 'ALTER TABLE '||obj||' ENABLE ROW LEVEL SECURITY';EXECUTE 'ALTER TABLE '||obj||' FORCE ROW LEVEL SECURITY';
  EXECUTE 'REVOKE ALL ON TABLE '||obj||' FROM PUBLIC,helpdesk_app';
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role','helpdesk_maintenance'] LOOP
   IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN EXECUTE format('REVOKE ALL ON TABLE %s FROM %I',obj,role_name);END IF;
  END LOOP;
 END LOOP;
 FOREACH obj IN ARRAY ARRAY['helpdesk_auth.hdn_legacy_terminal_update(uuid,uuid,uuid,text,integer)','helpdesk_auth.hdn_valid_execution_template(jsonb)','helpdesk_auth.hdn_execution_immutable()','helpdesk_auth.hdn_checklist_contract()','helpdesk_auth.hdn_lock_execution_checklist_resolution(uuid)','helpdesk_auth.hdn_checklist_ticket(uuid,boolean)','helpdesk_auth.hdn_lock_execution_checklist(uuid)','helpdesk_auth.hdn_checklist_receipt(uuid,text)','helpdesk_auth.hdn_checklist_evidence(uuid,text[])','helpdesk_auth.hdn_mark_execution_checklist(uuid,jsonb,text,text,uuid)'] LOOP
  EXECUTE 'REVOKE ALL ON FUNCTION '||obj||' FROM PUBLIC,helpdesk_app';
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role','helpdesk_maintenance'] LOOP
   IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I',obj,role_name);END IF;
  END LOOP;
 END LOOP;
END $privileges$;
GRANT EXECUTE ON FUNCTION helpdesk_auth.hdn_legacy_terminal_update(uuid,uuid,uuid,text,integer),helpdesk_auth.hdn_checklist_contract(),helpdesk_auth.hdn_lock_execution_checklist_resolution(uuid),helpdesk_auth.hdn_lock_execution_checklist(uuid),helpdesk_auth.hdn_checklist_receipt(uuid,text),helpdesk_auth.hdn_checklist_evidence(uuid,text[]),helpdesk_auth.hdn_mark_execution_checklist(uuid,jsonb,text,text,uuid) TO helpdesk_app;

-- SOURCE hdn_support_workflow.sql SHA256 35b92d19ece3b94653f442d3396e735ec1fe391d97be4661992043ed29684979
CREATE TABLE helpdesk_core.hdn_workflow_profiles(
 workspace_id uuid NOT NULL REFERENCES helpdesk_core.workspaces(id),
 version_id text COLLATE "C" NOT NULL CHECK(version_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$'),
 document jsonb NOT NULL,
 PRIMARY KEY(workspace_id,version_id),
 CHECK(coalesce(jsonb_typeof(document)='object' AND document ?& ARRAY['versionId','status','reopenWindowMicros']
  AND (document-ARRAY['versionId','status','reopenWindowMicros','executionChecklist'])='{}'::jsonb
  AND jsonb_typeof(document->'versionId')='string' AND document->>'versionId'=version_id
  AND jsonb_typeof(document->'status')='string' AND document->>'status'='published'
  AND jsonb_typeof(document->'reopenWindowMicros')='string'
  AND document->>'reopenWindowMicros' ~ '^(0|[1-9][0-9]{0,17})$',false))
);
CREATE TABLE helpdesk_core.hdn_workflow_state(
 workspace_id uuid NOT NULL,account_id uuid NOT NULL,ticket_id uuid NOT NULL,
 profile_version_id text NOT NULL,approval text NOT NULL CHECK(approval IN ('not_required','pending','approved')),
 last_event_at timestamptz NOT NULL,closed_at timestamptz,resolution text,
 PRIMARY KEY(workspace_id,account_id,ticket_id),
 FOREIGN KEY(workspace_id,account_id,ticket_id) REFERENCES helpdesk_core.tickets(workspace_id,account_id,id),
 FOREIGN KEY(workspace_id,profile_version_id) REFERENCES helpdesk_core.hdn_workflow_profiles(workspace_id,version_id),
 CHECK(resolution IS NULL OR (length(btrim(resolution))>0 AND length(resolution)<=12000))
);
-- One private ledger is both immutable audit and receipt; core functional events
-- and outbox stay in their EXISTING tables and formats. No second sender is added.
CREATE TABLE helpdesk_audit.hdn_workflow_commits(
 workspace_id uuid NOT NULL,account_id uuid NOT NULL,ticket_id uuid NOT NULL,event_id uuid NOT NULL,
 actor_id uuid NOT NULL REFERENCES helpdesk_auth.principals(id),profile_version_id text NOT NULL,
 from_version integer NOT NULL CHECK(from_version>0),to_version integer NOT NULL CHECK(to_version=from_version+1),
 from_status text NOT NULL,to_status text NOT NULL,core_type text NOT NULL CHECK(core_type IN ('ticket.status_changed','message.created','ticket.assignment_changed')),
 transaction_id xid8 NOT NULL DEFAULT pg_current_xact_id(),
 intent_key text NOT NULL CHECK(intent_key ~ '^[A-Za-z0-9._:-]{16,128}$'),intent_hash text NOT NULL CHECK(intent_hash ~ '^[a-f0-9]{64}$'),
 command jsonb NOT NULL,public_event jsonb NOT NULL,audit jsonb NOT NULL,result jsonb NOT NULL,at timestamptz NOT NULL,
 PRIMARY KEY(workspace_id,event_id),
 UNIQUE(workspace_id,account_id,ticket_id,actor_id,intent_key),
 UNIQUE(workspace_id,account_id,ticket_id,to_version),
 FOREIGN KEY(workspace_id,account_id,ticket_id) REFERENCES helpdesk_core.tickets(workspace_id,account_id,id),
 FOREIGN KEY(workspace_id,profile_version_id) REFERENCES helpdesk_core.hdn_workflow_profiles(workspace_id,version_id)
);
CREATE TRIGGER hdn_workflow_profile_immutable BEFORE UPDATE OR DELETE ON helpdesk_core.hdn_workflow_profiles
 FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdn_execution_immutable();
CREATE TRIGGER hdn_workflow_commit_immutable BEFORE UPDATE OR DELETE ON helpdesk_audit.hdn_workflow_commits
 FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdn_execution_immutable();

-- Profile binding and audience cannot be silently reassigned by a later publisher.
CREATE FUNCTION helpdesk_auth.hdn_guard_workflow_state() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Workflow history is retained' USING ERRCODE='23514';END IF;
 IF (NEW.workspace_id,NEW.account_id,NEW.ticket_id,NEW.profile_version_id) IS DISTINCT FROM
    (OLD.workspace_id,OLD.account_id,OLD.ticket_id,OLD.profile_version_id)
  OR NEW.last_event_at<OLD.last_event_at THEN
  RAISE EXCEPTION 'Pinned workflow identity/history cannot change' USING ERRCODE='23514';END IF;
 RETURN NEW;
END$$;
CREATE TRIGGER hdn_workflow_state_identity BEFORE UPDATE OR DELETE ON helpdesk_core.hdn_workflow_state
 FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdn_guard_workflow_state();

-- Canonical subset used by the fixed workflow/checklist documents: ASCII keys,
-- JSON strings/bools/null, arrays, SAFE INTEGERS. Not advertised as RFC8785.
CREATE FUNCTION helpdesk_auth.hdn_workflow_canonical(d jsonb) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE answer text;n numeric;
BEGIN
 CASE jsonb_typeof(d)
 WHEN 'object' THEN
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(d) k WHERE k !~ '^[A-Za-z0-9_]+$') THEN RAISE EXCEPTION 'Unsupported key' USING ERRCODE='HDW06';END IF;
  SELECT '{'||coalesce(string_agg(to_jsonb(key)::text||':'||helpdesk_auth.hdn_workflow_canonical(value),',' ORDER BY key COLLATE "C"),'')||'}' INTO answer FROM jsonb_each(d);
 WHEN 'array' THEN
  SELECT '['||coalesce(string_agg(helpdesk_auth.hdn_workflow_canonical(value),',' ORDER BY ordinality),'')||']' INTO answer FROM jsonb_array_elements(d) WITH ORDINALITY;
 WHEN 'number' THEN
  n:=(d#>>'{}')::numeric;IF n<>trunc(n) OR abs(n)>9007199254740991 THEN RAISE EXCEPTION 'Unsafe number' USING ERRCODE='HDW06';END IF;
  answer:=n::bigint::text;
 WHEN 'string' THEN answer:=d::text;
 WHEN 'boolean' THEN answer:=d::text;
 WHEN 'null' THEN answer:=d::text;
 ELSE RAISE EXCEPTION 'Invalid JSON' USING ERRCODE='HDW06';
 END CASE;
 RETURN answer;
END$$;
CREATE FUNCTION helpdesk_auth.hdn_workflow_digest(d jsonb) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT encode(sha256(convert_to(helpdesk_auth.hdn_workflow_canonical(d),'UTF8')),'hex')
$$;
CREATE FUNCTION helpdesk_auth.hdn_workflow_iso(t timestamptz) RETURNS text LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT to_char(t AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
$$;

CREATE FUNCTION helpdesk_auth.hdn_read_support_workflow(target uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE t helpdesk_core.tickets%rowtype;s helpdesk_core.hdn_workflow_state%rowtype;profile jsonb;scope jsonb;who uuid:=helpdesk_auth.actor_id();
BEGIN
 IF session_user<>'helpdesk_app' OR NOT coalesce(helpdesk_auth.is_human(),false)
  OR NOT coalesce(helpdesk_auth.has_scope(helpdesk_auth.workspace_id(),'tickets:read'),false)
  OR NOT coalesce(helpdesk_auth.has_scope(helpdesk_auth.workspace_id(),'tickets:write'),false) THEN
  RAISE EXCEPTION 'Denied' USING ERRCODE='HDW01';
 END IF;
 -- Same source/ACL helper and same locks as the existing resource transaction.
 scope:=helpdesk_auth.cg_lock_ticket_scope(target,'tickets.write');
 IF scope IS NULL THEN RAISE EXCEPTION 'Denied' USING ERRCODE='HDW01';END IF;
 SELECT * INTO t FROM helpdesk_core.tickets WHERE workspace_id=helpdesk_auth.workspace_id() AND id=target FOR UPDATE;
 IF NOT FOUND OR NOT coalesce(helpdesk_auth.can_read_ticket(t.workspace_id,t.account_id,t.product_instance_id,t.created_by),false) THEN
  RAISE EXCEPTION 'Denied' USING ERRCODE='HDW01';
 END IF;
 SELECT * INTO s FROM helpdesk_core.hdn_workflow_state WHERE workspace_id=t.workspace_id AND account_id=t.account_id AND ticket_id=t.id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pinned workflow required' USING ERRCODE='HDW07';END IF;
 SELECT document INTO profile FROM helpdesk_core.hdn_workflow_profiles WHERE workspace_id=t.workspace_id AND version_id=s.profile_version_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pinned profile required' USING ERRCODE='HDW07';END IF;
 RETURN jsonb_build_object('principalId',who,'profile',profile,'ticket',jsonb_build_object(
  'id',t.id,'workspaceId',t.workspace_id,'accountId',t.account_id,'productInstanceId',t.product_instance_id,'serviceCode',t.service_code,
  'createdBy',t.created_by,'assignedTo',t.assigned_to,'subject',t.subject,'description',t.description,'status',t.status,'priority',t.priority,
  'version',t.version,'coverageId',t.coverage_id,'contractVersionId',t.contract_version_id,'contractSnapshot',t.contract_snapshot,
  'createdAt',helpdesk_auth.hdn_workflow_iso(t.created_at),'updatedAt',helpdesk_auth.hdn_workflow_iso(t.updated_at),
  'profileVersionId',s.profile_version_id,'lastEventAt',helpdesk_auth.hdn_workflow_iso(greatest(t.updated_at,s.last_event_at)),
  'closedAt',CASE WHEN s.closed_at IS NULL THEN NULL ELSE helpdesk_auth.hdn_workflow_iso(s.closed_at) END,'resolution',s.resolution,'approval',s.approval));
END$$;
CREATE FUNCTION helpdesk_auth.hdn_support_workflow_receipt(target uuid,k text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE v jsonb;r helpdesk_audit.hdn_workflow_commits%rowtype;
BEGIN
 v:=helpdesk_auth.hdn_read_support_workflow(target);
 SELECT * INTO r FROM helpdesk_audit.hdn_workflow_commits WHERE workspace_id=helpdesk_auth.workspace_id()
  AND account_id=(v->'ticket'->>'accountId')::uuid AND ticket_id=target AND actor_id=helpdesk_auth.actor_id() AND intent_key=k;
 IF NOT FOUND THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('key',r.intent_key,'hash',r.intent_hash,'result',r.result);
END$$;

CREATE FUNCTION helpdesk_auth.hdn_workflow_completion(target uuid,profile_id text,reference jsonb,decision_at timestamptz) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE r jsonb;d jsonb;s jsonb;i jsonb;e jsonb;done_count integer:=0;waived_count integer:=0;pending_count integer:=0;
BEGIN
 -- Existing helper locks and validates every referenced note, its author/time and
 -- the entire resource set. This function additionally checks REQUIRED items.
 IF decision_at IS NULL OR NOT isfinite(decision_at) OR decision_at>clock_timestamp() THEN RAISE EXCEPTION 'Decision time required' USING ERRCODE='HDW08';END IF;
 r:=helpdesk_auth.hdn_lock_execution_checklist_resolution(target);d:=r->'record'->'template';s:=r->'record'->'snapshot';
 IF s IS NULL OR s='null'::jsonb OR r->'record'->'context'->>'profileVersionId' IS DISTINCT FROM profile_id
  OR r->'record'->'context'->'reference' IS DISTINCT FROM reference OR d->>'status' IS DISTINCT FROM 'published'
  OR helpdesk_auth.hdn_workflow_digest(d) IS DISTINCT FROM reference->>'sha256' THEN
  RAISE EXCEPTION 'Checklist required' USING ERRCODE='HDW04';
 END IF;
 FOR i IN SELECT value FROM jsonb_array_elements(d->'items') LOOP
  SELECT value INTO e FROM jsonb_array_elements(s->'entries') q WHERE q.value->>'itemId'=i->>'id';
  IF FOUND AND e->>'status'<>'pending' AND (e->>'at' IS NULL OR (e->>'at')::timestamptz>decision_at
   OR e->>'actorId' IS NULL OR jsonb_typeof(e->'evidenceRefs') IS DISTINCT FROM 'array') THEN
   RAISE EXCEPTION 'Mark time incompatible' USING ERRCODE='HDW04';END IF;
  IF e IS NULL OR e->>'status'='pending' THEN
   IF i->'required'='true'::jsonb THEN RAISE EXCEPTION 'Checklist incomplete' USING ERRCODE='HDW04';END IF;
   pending_count:=pending_count+1;
  ELSIF e->>'status'='not_applicable' THEN
   IF i->'allowNotApplicable' IS DISTINCT FROM 'true'::jsonb OR i->>'risk'='sensitive' OR length(btrim(coalesce(e->>'reason','')))=0
    OR e->'riskAcknowledgement' IS DISTINCT FROM 'null'::jsonb OR e->'evidenceRefs' IS DISTINCT FROM '[]'::jsonb THEN
    RAISE EXCEPTION 'Checklist waiver denied' USING ERRCODE='HDW04';END IF;
   waived_count:=waived_count+1;
  ELSIF e->>'status'='done' THEN
   IF i->'evidenceRequired'='true'::jsonb AND jsonb_array_length(e->'evidenceRefs')=0 THEN RAISE EXCEPTION 'Evidence required' USING ERRCODE='HDW04';END IF;
   IF i->>'risk'='sensitive' AND (e->'riskAcknowledgement'->>'actorId' IS DISTINCT FROM e->>'actorId'
    OR (e->'riskAcknowledgement'->>'at')::timestamptz IS NULL
    OR (e->'riskAcknowledgement'->>'at')::timestamptz<(e->>'at')::timestamptz
    OR length(btrim(coalesce(e->'riskAcknowledgement'->>'statement','')))=0
    OR (e->'riskAcknowledgement'->>'at')::timestamptz>decision_at) THEN RAISE EXCEPTION 'Acknowledgement required' USING ERRCODE='HDW04';END IF;
   IF i->>'risk'='ordinary' AND e->'riskAcknowledgement' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'Unexpected acknowledgement' USING ERRCODE='HDW04';END IF;
   done_count:=done_count+1;
  ELSE RAISE EXCEPTION 'Invalid checklist' USING ERRCODE='HDW04';END IF;
 END LOOP;
 RETURN jsonb_build_object('templateId',reference->>'id','templateVersion',reference->'version','templateSha256',reference->>'sha256',
  'snapshotRevision',s->'revision','snapshotSha256',helpdesk_auth.hdn_workflow_digest(s),'doneCount',done_count,'waivedCount',waived_count,'optionalPendingCount',pending_count);
END$$;

-- A private, transaction-bound ledger row must precede a structured status change.
-- It cannot be manufactured by SET_CONFIG, raw UPDATE or a public "approved" flag.
CREATE FUNCTION helpdesk_auth.hdn_guard_workflow_transition() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 -- Every version/assignment/status update of a bound ticket needs its private command, including same-state replies.
 IF EXISTS(SELECT 1 FROM helpdesk_core.hdn_workflow_state WHERE (workspace_id,account_id,ticket_id)=(OLD.workspace_id,OLD.account_id,OLD.id)) THEN
  IF NOT EXISTS(SELECT 1 FROM helpdesk_audit.hdn_workflow_commits c WHERE
   (c.workspace_id,c.account_id,c.ticket_id,c.actor_id,c.from_version,c.to_version,c.from_status,c.to_status)=
   (OLD.workspace_id,OLD.account_id,OLD.id,helpdesk_auth.actor_id(),OLD.version,NEW.version,OLD.status,NEW.status)
   AND c.transaction_id=pg_current_xact_id()
   AND (NEW.assigned_to IS NOT DISTINCT FROM OLD.assigned_to OR (c.command->>'action'='transfer' AND c.command->>'targetPrincipalId'=NEW.assigned_to::text))) THEN RAISE EXCEPTION 'Structured writer required' USING ERRCODE='HDW03';END IF;
 ELSIF NEW.status IN ('resolved','closed') AND EXISTS(SELECT 1 FROM helpdesk_core.hdn_execution_bindings WHERE
  (workspace_id,account_id,ticket_id)=(OLD.workspace_id,OLD.account_id,OLD.id)) THEN
  RAISE EXCEPTION 'Workflow binding required' USING ERRCODE='HDW07';
 END IF;
 RETURN NEW;
END$$;
CREATE TRIGGER hdn_guard_workflow_transition BEFORE UPDATE ON helpdesk_core.tickets
 FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdn_guard_workflow_transition();
CREATE FUNCTION helpdesk_auth.hdn_require_workflow_commit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM helpdesk_core.ticket_events e LEFT JOIN helpdesk_integration.outbox_events o
  ON (o.workspace_id,o.account_id,o.ticket_id,o.id,o.type)=(e.workspace_id,e.account_id,e.ticket_id,e.id,e.type)
  JOIN helpdesk_audit.write_effects f ON (f.workspace_id,f.event_id)=(e.workspace_id,e.id)
  WHERE (e.workspace_id,e.account_id,e.ticket_id,e.id,e.actor_id,e.type)=
   (NEW.workspace_id,NEW.account_id,NEW.ticket_id,NEW.event_id,NEW.actor_id,NEW.core_type)
   AND f.transaction_id=NEW.transaction_id AND f.ticket_version=NEW.to_version AND f.applied
   AND ((NEW.core_type='ticket.assignment_changed' AND o.id IS NULL) OR (NEW.core_type<>'ticket.assignment_changed' AND o.id IS NOT NULL)))
  OR NOT EXISTS(SELECT 1 FROM helpdesk_core.hdn_workflow_state s JOIN helpdesk_core.tickets t
    ON (t.workspace_id,t.account_id,t.id)=(s.workspace_id,s.account_id,s.ticket_id)
    WHERE (s.workspace_id,s.account_id,s.ticket_id,s.profile_version_id)=(NEW.workspace_id,NEW.account_id,NEW.ticket_id,NEW.profile_version_id)
     AND t.version>=NEW.to_version AND s.last_event_at>=NEW.at) THEN
  RAISE EXCEPTION 'Incomplete structured commit' USING ERRCODE='23514';
 END IF;
 IF NEW.command->>'action'='transfer' THEN PERFORM helpdesk_auth.hdn_verify_workflow_assignee(NEW.ticket_id,(NEW.command->>'targetPrincipalId')::uuid,NULL);END IF;
 RETURN NULL;
END$$;
CREATE CONSTRAINT TRIGGER hdn_complete_workflow_commit AFTER INSERT ON helpdesk_audit.hdn_workflow_commits
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdn_require_workflow_commit();

CREATE FUNCTION helpdesk_auth.hdn_commit_support_workflow(target uuid,payload jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE v jsonb;t jsonb;profile jsonb;cmd jsonb;result jsonb;ev jsonb;aud jsonb;proof jsonb;
 old_receipt helpdesk_audit.hdn_workflow_commits%rowtype;
 who uuid:=helpdesk_auth.actor_id();w uuid:=helpdesk_auth.workspace_id();a uuid;event_id uuid;request_id uuid;
 expected integer;next_version integer;action text;prior_status text;next_status text;kind text;core_type text;
 body text;reason text;at_text text;stamp timestamptz;operator boolean;message_id uuid;count_rows integer;
BEGIN
 IF payload IS NULL OR jsonb_typeof(payload)<>'object' OR octet_length(payload::text)>98304
  OR (SELECT count(*) FROM jsonb_object_keys(payload))<>10
  OR NOT payload ?& ARRAY['schema','profileVersionId','command','at','requestId','eventId','key','hash','audit','receipt']
  OR payload->'schema' IS DISTINCT FROM '1'::jsonb THEN RAISE EXCEPTION 'Invalid submission' USING ERRCODE='HDW06';END IF;
 v:=helpdesk_auth.hdn_read_support_workflow(target);t:=v->'ticket';profile:=v->'profile';a:=(t->>'accountId')::uuid;
 cmd:=payload->'command';
 IF jsonb_typeof(cmd) IS DISTINCT FROM 'object' OR jsonb_typeof(cmd->'action') IS DISTINCT FROM 'string'
  OR jsonb_typeof(cmd->'expectedVersion') IS DISTINCT FROM 'number' OR cmd->>'expectedVersion' !~ '^[1-9][0-9]{0,8}$'
  OR jsonb_typeof(payload->'key') IS DISTINCT FROM 'string' OR payload->>'key' !~ '^[A-Za-z0-9._:-]{16,128}$'
  OR jsonb_typeof(payload->'hash') IS DISTINCT FROM 'string' OR payload->>'hash' !~ '^[a-f0-9]{64}$'
  OR payload->>'profileVersionId' IS DISTINCT FROM profile->>'versionId' THEN RAISE EXCEPTION 'Invalid command' USING ERRCODE='HDW06';END IF;
 action:=cmd->>'action';
 IF action IN ('reply','customer_reply','request_customer','resolve') THEN
  IF (SELECT count(*) FROM jsonb_object_keys(cmd))<>3 OR NOT cmd ?& ARRAY['action','expectedVersion','body']
   OR jsonb_typeof(cmd->'body') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Body required' USING ERRCODE='HDW06';END IF;
  body:=cmd->>'body';IF body !~ '[^[:space:]]' OR length(btrim(body))=0 OR length(body)>12000 OR body~'[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]' THEN RAISE EXCEPTION 'Invalid body' USING ERRCODE='HDW06';END IF;
 ELSIF action IN ('reopen','cancel','handoff','transfer') THEN
  IF (SELECT count(*) FROM jsonb_object_keys(cmd))<>(CASE WHEN action IN ('handoff','transfer') THEN 4 ELSE 3 END)
   OR NOT cmd ?& ARRAY['action','expectedVersion','reason'] OR jsonb_typeof(cmd->'reason') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Reason required' USING ERRCODE='HDW06';END IF;
  IF action='transfer' AND (NOT cmd ? 'targetPrincipalId' OR jsonb_typeof(cmd->'targetPrincipalId') IS DISTINCT FROM 'string' OR NOT pg_input_is_valid(cmd->>'targetPrincipalId','uuid')) THEN RAISE EXCEPTION 'Target required' USING ERRCODE='HDW06';END IF;
  reason:=cmd->>'reason';IF reason !~ '[^[:space:]]' OR length(btrim(reason))=0 OR length(reason)>12000 OR reason~'[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]' THEN RAISE EXCEPTION 'Invalid reason' USING ERRCODE='HDW06';END IF;
 ELSIF action NOT IN ('start','triage','close') OR (SELECT count(*) FROM jsonb_object_keys(cmd))<>2 OR NOT cmd ?& ARRAY['action','expectedVersion'] THEN
  RAISE EXCEPTION 'Unsupported command' USING ERRCODE='HDW03';
 END IF;
 IF payload->>'hash' IS DISTINCT FROM helpdesk_auth.hdn_workflow_digest(jsonb_build_object('workspaceId',w,'actorId',who,'ticketId',target,'command',cmd)) THEN
  RAISE EXCEPTION 'Intent differs' USING ERRCODE='HDW05';END IF;
 SELECT * INTO old_receipt FROM helpdesk_audit.hdn_workflow_commits WHERE workspace_id=w AND account_id=a AND ticket_id=target AND actor_id=who AND intent_key=payload->>'key';
 IF FOUND THEN
  IF old_receipt.command IS DISTINCT FROM cmd OR old_receipt.intent_hash IS DISTINCT FROM payload->>'hash' THEN RAISE EXCEPTION 'Intent conflict' USING ERRCODE='HDW05';END IF;
  RETURN old_receipt.result;
 END IF;
 expected:=(cmd->>'expectedVersion')::integer;next_version:=expected+1;
 IF expected<>(t->>'version')::integer THEN RAISE EXCEPTION 'Version conflict' USING ERRCODE='HDW02';END IF;
 action:=cmd->>'action';prior_status:=t->>'status';next_status:=prior_status;kind:=action;
 operator:=coalesce(helpdesk_auth.is_operator(w,a),false);
 IF NOT operator AND action NOT IN ('customer_reply','close','reopen') THEN RAISE EXCEPTION 'Denied' USING ERRCODE='HDW01';END IF;
 IF t->>'approval'='pending' AND action<>'cancel' THEN RAISE EXCEPTION 'Approval pending' USING ERRCODE='HDW03';END IF;
 at_text:=payload->>'at';
 IF jsonb_typeof(payload->'at') IS DISTINCT FROM 'string' OR at_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}([0-9]{3})?Z$'
  OR NOT pg_input_is_valid(at_text,'timestamptz') THEN RAISE EXCEPTION 'Invalid time' USING ERRCODE='HDW08';END IF;
 stamp:=at_text::timestamptz;
 IF stamp<(t->>'lastEventAt')::timestamptz OR stamp>clock_timestamp() THEN RAISE EXCEPTION 'Time conflict' USING ERRCODE='HDW08';END IF;
 event_id:=(payload->>'eventId')::uuid;request_id:=(payload->>'requestId')::uuid;
 IF event_id IS NULL OR request_id IS NULL THEN RAISE EXCEPTION 'Identifiers required' USING ERRCODE='HDW06';END IF;

 CASE action
 WHEN 'start' THEN IF prior_status NOT IN ('new','triage') THEN RAISE EXCEPTION 'State conflict' USING ERRCODE='HDW03';END IF;next_status:='open';kind:='transition';
 WHEN 'triage' THEN IF prior_status<>'new' THEN RAISE EXCEPTION 'State conflict' USING ERRCODE='HDW03';END IF;next_status:='triage';kind:='transition';
 WHEN 'reply' THEN IF prior_status NOT IN ('triage','open','waiting_customer','waiting_internal','waiting_third_party') THEN RAISE EXCEPTION 'State conflict' USING ERRCODE='HDW03';END IF;
 WHEN 'customer_reply' THEN
  IF prior_status NOT IN ('open','waiting_customer','waiting_internal','waiting_third_party') THEN RAISE EXCEPTION 'State conflict' USING ERRCODE='HDW03';END IF;
  IF prior_status='waiting_customer' THEN
   next_status:='open';
  END IF;
 WHEN 'request_customer' THEN IF prior_status NOT IN ('triage','open') THEN RAISE EXCEPTION 'State conflict' USING ERRCODE='HDW03';END IF;next_status:='waiting_customer';kind:='devolutiva';
 WHEN 'handoff' THEN IF prior_status<>'open' OR cmd->>'target' NOT IN ('internal','third_party') OR jsonb_typeof(cmd->'target') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'State conflict' USING ERRCODE='HDW03';END IF;next_status:=CASE WHEN cmd->>'target'='internal' THEN 'waiting_internal' ELSE 'waiting_third_party' END;
 WHEN 'resolve' THEN
  IF prior_status NOT IN ('open','waiting_customer','waiting_internal','waiting_third_party') THEN RAISE EXCEPTION 'State conflict' USING ERRCODE='HDW03';END IF;
  next_status:='resolved';kind:='resolved';
  IF profile ? 'executionChecklist' THEN proof:=helpdesk_auth.hdn_workflow_completion(target,profile->>'versionId',profile->'executionChecklist',stamp);END IF;
 WHEN 'close' THEN IF prior_status<>'resolved' OR length(btrim(coalesce(t->>'resolution','')))=0 THEN RAISE EXCEPTION 'Resolution required' USING ERRCODE='HDW03';END IF;next_status:='closed';kind:='closed';
 WHEN 'reopen' THEN
  IF prior_status NOT IN ('resolved','closed') THEN RAISE EXCEPTION 'State conflict' USING ERRCODE='HDW03';END IF;
  IF extract(epoch FROM clock_timestamp()-coalesce((t->>'closedAt')::timestamptz,(t->>'lastEventAt')::timestamptz))*1000000 > (profile->>'reopenWindowMicros')::numeric THEN RAISE EXCEPTION 'Reopening window expired' USING ERRCODE='HDW10';END IF;
  next_status:='open';kind:='reopened';
 WHEN 'transfer' THEN
  IF prior_status NOT IN ('triage','open','waiting_customer','waiting_internal','waiting_third_party') OR length(reason)>2000 OR reason~'[[:cntrl:]]' OR cmd->>'targetPrincipalId' IS NOT DISTINCT FROM t->>'assignedTo' THEN RAISE EXCEPTION 'Transfer conflict' USING ERRCODE='HDW03';END IF;
  PERFORM helpdesk_auth.hdn_verify_workflow_assignee(target,(cmd->>'targetPrincipalId')::uuid,NULL);kind:='assigned';
 WHEN 'cancel' THEN IF prior_status NOT IN ('new','triage','open','waiting_customer','waiting_internal','waiting_third_party') THEN RAISE EXCEPTION 'State conflict' USING ERRCODE='HDW03';END IF;next_status:='cancelled';kind:='cancelled';
 ELSE RAISE EXCEPTION 'Unsupported command' USING ERRCODE='HDW03';
 END CASE;
 result:=jsonb_build_object('ticketId',target,'workspaceId',w,'accountId',a,'actorId',who,'profileVersionId',profile->>'versionId','version',next_version,'status',next_status,'eventId',event_id,'replayed',false);
 aud:=jsonb_build_object('id',event_id,'workspaceId',w,'ticketId',target,'actorId',who,'requestId',request_id,'at',at_text,'action',action,'reason',reason,'from',prior_status,'to',next_status,'version',next_version);
 IF proof IS NOT NULL THEN aud:=aud||jsonb_build_object('executionChecklist',proof);END IF;
 IF payload->'audit' IS DISTINCT FROM aud OR payload->'receipt' IS DISTINCT FROM result THEN RAISE EXCEPTION 'Decision mismatch' USING ERRCODE='HDW06';END IF;
 ev:=jsonb_build_object('ticketId',target,'workspaceId',w,'profileVersionId',profile->>'versionId','sequence',next_version,'at',at_text,'type',kind,'actorId',who,'actorKind',CASE WHEN operator THEN 'human_agent' ELSE 'customer' END,'from',prior_status,'to',next_status);
 IF body IS NOT NULL THEN ev:=ev||jsonb_build_object('body',body);END IF;
 core_type:=CASE WHEN action='transfer' THEN 'ticket.assignment_changed' WHEN next_status<>prior_status THEN 'ticket.status_changed' ELSE 'message.created' END;
 INSERT INTO helpdesk_audit.hdn_workflow_commits(workspace_id,account_id,ticket_id,event_id,actor_id,profile_version_id,from_version,to_version,from_status,to_status,core_type,intent_key,intent_hash,command,public_event,audit,result,at)
 VALUES(w,a,target,event_id,who,profile->>'versionId',expected,next_version,prior_status,next_status,core_type,payload->>'key',payload->>'hash',cmd,ev,aud,result,stamp);
 GET DIAGNOSTICS count_rows=ROW_COUNT;IF count_rows<>1 THEN RAISE EXCEPTION 'Commit record missing' USING ERRCODE='23514';END IF;
 IF core_type='message.created' THEN
  message_id:=event_id;IF body IS NULL THEN RAISE EXCEPTION 'Message required' USING ERRCODE='HDW06';END IF;
  INSERT INTO helpdesk_core.ticket_messages(id,workspace_id,account_id,ticket_id,actor_id,actor_type,body,created_at)
   VALUES(message_id,w,a,target,who,CASE WHEN operator THEN 'human_agent' ELSE 'customer' END,body,stamp);
  GET DIAGNOSTICS count_rows=ROW_COUNT;IF count_rows<>1 THEN RAISE EXCEPTION 'Message missing' USING ERRCODE='23514';END IF;
 END IF;
 UPDATE helpdesk_core.tickets SET status=next_status,assigned_to=CASE WHEN action='transfer' THEN (cmd->>'targetPrincipalId')::uuid ELSE assigned_to END,version=next_version,updated_at=stamp WHERE workspace_id=w AND account_id=a AND id=target AND version=expected;
 GET DIAGNOSTICS count_rows=ROW_COUNT;IF count_rows<>1 THEN RAISE EXCEPTION 'CAS conflict' USING ERRCODE='HDW02';END IF;
 UPDATE helpdesk_core.hdn_workflow_state SET last_event_at=stamp,
  resolution=CASE WHEN action='resolve' THEN body ELSE resolution END,
  closed_at=CASE WHEN action='close' THEN stamp WHEN action='reopen' THEN NULL ELSE closed_at END
  WHERE workspace_id=w AND account_id=a AND ticket_id=target;
 GET DIAGNOSTICS count_rows=ROW_COUNT;IF count_rows<>1 THEN RAISE EXCEPTION 'Metadata missing' USING ERRCODE='HDW07';END IF;
 -- Never put private handoff/cancel reasons in the public core event. The body
 -- and semantic event live in the selectively readable workflow ledger.
 INSERT INTO helpdesk_core.ticket_events(id,workspace_id,account_id,ticket_id,actor_id,type,customer_visible,data,created_at)
 VALUES(event_id,w,a,target,who,core_type,core_type<>'ticket.assignment_changed',
  CASE WHEN core_type='ticket.assignment_changed' THEN jsonb_build_object('action','transfer','from',t->'assignedTo','to',cmd->'targetPrincipalId','reason',reason,'version',next_version)
  WHEN core_type='message.created' THEN jsonb_build_object('messageId',message_id,'actorType',CASE WHEN operator THEN 'human_agent' ELSE 'customer' END)
  ELSE jsonb_build_object('from',prior_status,'to',next_status,'reason','Atendimento atualizado pelo fluxo estruturado.') END,stamp);
 GET DIAGNOSTICS count_rows=ROW_COUNT;IF count_rows<>1 THEN RAISE EXCEPTION 'Event missing' USING ERRCODE='23514';END IF;
 IF core_type<>'ticket.assignment_changed' THEN
 INSERT INTO helpdesk_integration.outbox_events(id,workspace_id,account_id,ticket_id,type,payload,request_id,created_at)
 VALUES(event_id,w,a,target,core_type,jsonb_build_object('specversion','1.0','id',event_id,'source','helpdesk/workspaces/'||w::text,
  'type','com.helpdesk.'||core_type||'.v1','subject','tickets/'||target::text,'datacontenttype','application/json','time',at_text,
  'data',jsonb_build_object('ticket_id',target,'version',next_version)),request_id,stamp);
 GET DIAGNOSTICS count_rows=ROW_COUNT;IF count_rows<>1 THEN RAISE EXCEPTION 'Outbox missing' USING ERRCODE='23514';END IF;
 END IF;
 RETURN result;
EXCEPTION WHEN data_exception THEN RAISE EXCEPTION 'Invalid workflow data' USING ERRCODE='HDW06';
END$$;

-- Qualified compatibility: a private same-transaction decision is the authority;
-- raw caller/GUC values cannot manufacture the Boolean used by original guards.
CREATE FUNCTION helpdesk_auth.hdn_scoped_workflow_commit(w uuid,a uuid,target uuid,before_version integer,after_version integer,prior text,next_status text,destination uuid) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF session_user<>'helpdesk_app' OR w IS DISTINCT FROM helpdesk_auth.workspace_id() OR NOT coalesce(helpdesk_auth.is_human(),false)
 OR NOT coalesce(helpdesk_auth.has_scope(w,'tickets:read') AND helpdesk_auth.has_scope(w,'tickets:write'),false)
 OR NOT coalesce(helpdesk_auth.cg_ticket_resource_allowed(w,a,target,'tickets.write'),false) THEN RETURN false;END IF;
 RETURN EXISTS(SELECT 1 FROM helpdesk_audit.hdn_workflow_commits c WHERE
 (c.workspace_id,c.account_id,c.ticket_id,c.actor_id,c.from_version,c.to_version,c.from_status,c.to_status)=
 (w,a,target,helpdesk_auth.actor_id(),before_version,after_version,prior,next_status)
 AND c.transaction_id=pg_current_xact_id() AND
 ((c.command->>'action'='customer_reply' AND prior='waiting_customer' AND next_status='open')
 OR (c.command->>'action'='reopen' AND prior='closed' AND next_status='open')
 OR (c.command->>'action'='transfer' AND prior=next_status AND c.command->>'targetPrincipalId'=destination::text)));
END$$;

CREATE FUNCTION helpdesk_auth.hdn_verify_workflow_assignee(target uuid,candidate uuid,expected_scope text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE v jsonb;s jsonb;key text;w uuid:=helpdesk_auth.workspace_id();a uuid;op text;r record;role_ok boolean;
BEGIN
 v:=helpdesk_auth.hdn_read_support_workflow(target);a:=(v->'ticket'->>'accountId')::uuid;
 IF NOT coalesce(helpdesk_auth.is_operator(w,a),false) OR candidate IS NULL THEN RAISE EXCEPTION 'Assignee denied' USING ERRCODE='HDW09';END IF;
 s:=helpdesk_auth.cg_lock_ticket_scope(target,'tickets.write');
 key:=helpdesk_auth.hdn_workflow_digest(jsonb_build_object('workspaceId',s->'workspaceId','accountId',s->'accountId','bindingId',s->'bindingId','bindingRevision',s->'bindingRevision','accessRevision',s->'accessRevision','refs',s->'refs'));
 IF s IS NULL OR (expected_scope IS NOT NULL AND expected_scope IS DISTINCT FROM key) THEN RAISE EXCEPTION 'Scope differs' USING ERRCODE='HDW09';END IF;
 PERFORM 1 FROM helpdesk_auth.principals WHERE id=candidate AND active AND kind='human' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Inactive assignee' USING ERRCODE='HDW09';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('helpdesk-human-scopes:'||w::text||':'||candidate::text,0));
 IF NOT ARRAY['tickets:read','tickets:write']::text[] <@ helpdesk_auth.human_scopes(w,candidate) THEN RAISE EXCEPTION 'Assignee scopes denied' USING ERRCODE='HDW09';END IF;
 PERFORM 1 FROM helpdesk_auth.account_grants WHERE workspace_id=w AND account_id=a AND principal_id=candidate AND active AND role='agent' FOR SHARE;
 role_ok:=FOUND;
 IF NOT role_ok THEN PERFORM 1 FROM helpdesk_auth.workspace_memberships WHERE workspace_id=w AND principal_id=candidate AND active AND role='admin' FOR SHARE;role_ok:=FOUND;END IF;
 IF NOT role_ok THEN RAISE EXCEPTION 'Assignee role denied' USING ERRCODE='HDW09';END IF;
 FOREACH op IN ARRAY ARRAY['tickets.read','tickets.write'] LOOP
  SELECT g.expected_count,g.as_of,g.expires_at INTO r FROM helpdesk_auth.cg_resource_grant_sets g
  JOIN helpdesk_auth.cg_resource_observations o ON (o.workspace_id,o.account_id,o.binding_id,o.principal_id,o.operation,o.grant_revision)=
   (g.workspace_id,g.account_id,g.binding_id,g.principal_id,g.operation,g.revision)
  AND o.access_revision=g.source_revision AND o.as_of=g.as_of AND o.expires_at=g.expires_at AND o.expected_count=g.expected_count
  AND o.binding_revision=s->>'bindingRevision' AND o.manifest_fingerprint=s->>'manifestFingerprint'
  WHERE g.workspace_id=w AND g.account_id=a AND g.binding_id=(s->>'bindingId')::uuid AND g.principal_id=candidate AND g.operation=op AND g.active
  FOR SHARE OF g,o;
  IF NOT FOUND OR r.as_of>clock_timestamp() OR r.expires_at<=clock_timestamp()
   OR (SELECT count(*) FROM helpdesk_auth.cg_resource_grant_refs g WHERE g.workspace_id=w AND g.account_id=a AND g.binding_id=(s->>'bindingId')::uuid AND g.principal_id=candidate AND g.operation=op)<>r.expected_count
   OR EXISTS(SELECT 1 FROM helpdesk_core.cg_ticket_resource_refs x WHERE x.workspace_id=w AND x.account_id=a AND x.ticket_id=target AND NOT EXISTS(
    SELECT 1 FROM helpdesk_auth.cg_resource_grant_refs g WHERE g.workspace_id=w AND g.account_id=a AND g.binding_id=(s->>'bindingId')::uuid AND g.principal_id=candidate AND g.operation=op AND g.resource_type=x.resource_type AND g.resource_id=x.resource_id))
  THEN RAISE EXCEPTION 'Assignee resource coverage denied' USING ERRCODE='HDW09';END IF;
 END LOOP;
 RETURN jsonb_build_object('principalId',candidate,'workspaceId',w,'accountId',a,'scopeKey',key,'active',true,'operator',true);
END$$;

CREATE FUNCTION helpdesk_auth.hdn_guard_workflow_message() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM helpdesk_core.hdn_workflow_state s WHERE (s.workspace_id,s.account_id,s.ticket_id)=(NEW.workspace_id,NEW.account_id,NEW.ticket_id))
 AND NOT EXISTS(SELECT 1 FROM helpdesk_audit.hdn_workflow_commits c WHERE
 (c.workspace_id,c.account_id,c.ticket_id,c.actor_id,c.event_id)=(NEW.workspace_id,NEW.account_id,NEW.ticket_id,NEW.actor_id,NEW.id)
 AND c.transaction_id=pg_current_xact_id() AND c.core_type='message.created' AND c.command->>'body'=NEW.body)
 THEN RAISE EXCEPTION 'Structured conversation required' USING ERRCODE='HDW03';END IF;
 RETURN NEW;
END$$;
CREATE TRIGGER hdn_guard_structured_message BEFORE INSERT ON helpdesk_core.ticket_messages FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdn_guard_workflow_message();

create or replace function helpdesk_core.guard_ticket_transition() returns trigger
language plpgsql set search_path='' as $$
declare allowed text[];
begin
 if new.status=old.status then return new; end if;
 if ((old.status='waiting_customer' and new.status='open') or (old.status='closed' and new.status='open')) and helpdesk_auth.hdn_scoped_workflow_commit(old.workspace_id,old.account_id,old.id,old.version,new.version,old.status,new.status,new.assigned_to) then return new;end if;
 if not helpdesk_auth.is_operator(old.workspace_id,old.account_id) then
  if old.status<>'resolved' or new.status not in ('open','closed') then
   raise exception 'Transition not authorized' using errcode='42501';
  end if;
 else
  allowed:=case old.status
   when 'new' then array['triage','open','cancelled']
   when 'triage' then array['open','waiting_customer','cancelled']
   when 'open' then array['waiting_customer','waiting_internal','waiting_third_party','resolved','cancelled']
   when 'waiting_customer' then array['open','resolved','cancelled']
   when 'waiting_internal' then array['open','resolved','cancelled']
   when 'waiting_third_party' then array['open','resolved','cancelled']
   when 'resolved' then array['open','closed'] else array[]::text[] end;
  if not(new.status=any(allowed)) then raise exception 'Invalid transition' using errcode='23514'; end if;
 end if;
 return new;
end$$;
create or replace function helpdesk_core.guard_ticket_assignment() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  if new.assigned_to is not null then raise exception 'Initial assignment not allowed' using errcode='23514'; end if;
  return new;
 end if;
 if new.assigned_to is not distinct from old.assigned_to then return new; end if;
 if helpdesk_auth.hdn_scoped_workflow_commit(old.workspace_id,old.account_id,old.id,old.version,new.version,old.status,new.status,new.assigned_to) then return new;end if;
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
create or replace function helpdesk_audit.record_ticket_effect() returns trigger
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
   k:='ticket.assignment_changed';d:=jsonb_build_object('action',case when exists(select 1 from helpdesk_audit.hdn_workflow_commits c where c.workspace_id=new.workspace_id and c.account_id=new.account_id and c.ticket_id=new.id and c.actor_id=helpdesk_auth.actor_id() and c.transaction_id=pg_current_xact_id() and c.to_version=new.version and c.command->>'action'='transfer') then 'transfer' when new.assigned_to is null then 'release' else 'claim' end,
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
create or replace function helpdesk_core.require_assignment_event() returns trigger
language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from helpdesk_core.ticket_events e
  where (e.workspace_id,e.account_id,e.ticket_id)=(new.workspace_id,new.account_id,new.id)
   and e.type='ticket.assignment_changed' and not e.customer_visible
   and e.actor_id=helpdesk_auth.actor_id() and e.data->>'version'=new.version::text
   and (e.data->>'from') is not distinct from old.assigned_to::text
   and (e.data->>'to') is not distinct from new.assigned_to::text
   and e.data->>'action'=case when helpdesk_auth.hdn_scoped_workflow_commit(old.workspace_id,old.account_id,old.id,old.version,new.version,old.status,new.status,new.assigned_to) then 'transfer' when new.assigned_to is null then 'release' else 'claim' end
 ) then raise exception 'Assignment update requires matching private event' using errcode='23514'; end if;
 return null;
end$$;
alter table helpdesk_core.ticket_events drop constraint assignment_event_shape;
alter table helpdesk_core.ticket_events add constraint assignment_event_shape check(
 type<>'ticket.assignment_changed' or coalesce(
  jsonb_typeof(data)='object' and (data-array['action','from','to','reason','version'])='{}'::jsonb
  and data ?& array['action','from','to','reason','version']
  and jsonb_typeof(data->'reason')='string' and length(btrim(data->>'reason')) between 1 and 2000
  and length(data->>'reason')<=2000 and (data->>'reason') !~ '[[:cntrl:]]'
  and ((data->>'action'='claim' and data->'from'='null'::jsonb and jsonb_typeof(data->'to')='string'
      and data->>'to'=actor_id::text)
   or (data->>'action'='release' and data->'to'='null'::jsonb and jsonb_typeof(data->'from')='string'
      and (data->>'from') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
   or (data->>'action'='transfer' and (data->'from'='null'::jsonb or (data->>'from') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') and (data->>'to') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and data->'from' is distinct from data->'to'))
  and case when jsonb_typeof(data->'version')='number' then
   (data->>'version')::numeric between 2 and 9007199254740991
    and (data->>'version')::numeric=trunc((data->>'version')::numeric) else false end,false));


DO $privileges$
DECLARE obj text;r text;
BEGIN
 FOREACH obj IN ARRAY ARRAY['helpdesk_core.hdn_workflow_profiles','helpdesk_core.hdn_workflow_state','helpdesk_audit.hdn_workflow_commits'] LOOP
  EXECUTE 'ALTER TABLE '||obj||' ENABLE ROW LEVEL SECURITY';EXECUTE 'ALTER TABLE '||obj||' FORCE ROW LEVEL SECURITY';
  EXECUTE 'REVOKE ALL ON TABLE '||obj||' FROM PUBLIC,helpdesk_app';
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role','helpdesk_maintenance'] LOOP
   IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN EXECUTE format('REVOKE ALL ON TABLE %s FROM %I',obj,r);END IF;
  END LOOP;
 END LOOP;
 FOREACH obj IN ARRAY ARRAY['hdn_workflow_canonical(jsonb)','hdn_workflow_digest(jsonb)','hdn_workflow_iso(timestamptz)',
  'hdn_read_support_workflow(uuid)','hdn_support_workflow_receipt(uuid,text)','hdn_workflow_completion(uuid,text,jsonb,timestamptz)',
  'hdn_guard_workflow_state()','hdn_guard_workflow_transition()','hdn_require_workflow_commit()','hdn_commit_support_workflow(uuid,jsonb)',
  'hdn_verify_workflow_assignee(uuid,uuid,text)','hdn_scoped_workflow_commit(uuid,uuid,uuid,integer,integer,text,text,uuid)','hdn_guard_workflow_message()'] LOOP
  EXECUTE 'REVOKE ALL ON FUNCTION helpdesk_auth.'||obj||' FROM PUBLIC,helpdesk_app';
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role','helpdesk_maintenance'] LOOP
   IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN EXECUTE format('REVOKE ALL ON FUNCTION helpdesk_auth.%s FROM %I',obj,r);END IF;
  END LOOP;
 END LOOP;
END $privileges$;
GRANT EXECUTE ON FUNCTION helpdesk_auth.hdn_read_support_workflow(uuid),helpdesk_auth.hdn_support_workflow_receipt(uuid,text),helpdesk_auth.hdn_commit_support_workflow(uuid,jsonb) TO helpdesk_app;

GRANT EXECUTE ON FUNCTION helpdesk_auth.hdn_verify_workflow_assignee(uuid,uuid,text),helpdesk_auth.hdn_scoped_workflow_commit(uuid,uuid,uuid,integer,integer,text,text,uuid) TO helpdesk_app;

-- SOURCE hdn_consultegeo_configuration.sql SHA256 b6080ff019fb80b795a81f9b4e303856a290f0117a6f38d253b12784e72a5dcd
CREATE FUNCTION helpdesk_auth.hdn_cfg_object(d jsonb,keys text[],optional text[] DEFAULT '{}') RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$SELECT coalesce(jsonb_typeof(d)='object' AND d ?& keys AND d-(keys||optional)='{}'::jsonb,false)$$;
-- Match ECMAScript trim, UTF-16 length and shared form text controls explicitly;
-- PostgreSQL char_length and locale-dependent POSIX classes differ from JS.
CREATE FUNCTION helpdesk_auth.hdn_cfg_text(d jsonb,maxlen int) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE s text;cp int;units int:=0;visible boolean:=false;
BEGIN
 IF jsonb_typeof(d) IS DISTINCT FROM 'string' OR maxlen IS NULL OR maxlen<1 THEN RETURN false;END IF;s:=d#>>'{}';
 FOR i IN 1..length(s) LOOP cp:=ascii(substr(s,i,1));units:=units+CASE WHEN cp>65535 THEN 2 ELSE 1 END;
  IF units>maxlen OR cp BETWEEN 0 AND 8 OR cp IN (11,12,127) OR cp BETWEEN 14 AND 31 THEN RETURN false;END IF;
  IF NOT (cp BETWEEN 9 AND 13 OR cp IN (32,160,5760,8232,8233,8239,8287,12288,65279) OR cp BETWEEN 8192 AND 8202) THEN visible:=true;END IF;
 END LOOP;RETURN visible;
END$$;
CREATE FUNCTION helpdesk_auth.hdn_cfg_singleline(d jsonb,maxlen int) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$DECLARE s text;cp int;BEGIN
 IF NOT helpdesk_auth.hdn_cfg_text(d,maxlen) THEN RETURN false;END IF;s:=d#>>'{}';FOR i IN 1..length(s) LOOP cp:=ascii(substr(s,i,1));IF cp BETWEEN 0 AND 31 OR cp BETWEEN 127 AND 159 THEN RETURN false;END IF;END LOOP;RETURN true;END$$;
CREATE FUNCTION helpdesk_auth.hdn_cfg_checklist_text(d jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$DECLARE s text;cp int;BEGIN
 IF NOT helpdesk_auth.hdn_cfg_text(d,300) THEN RETURN false;END IF;s:=d#>>'{}';FOR i IN 1..length(s) LOOP cp:=ascii(substr(s,i,1));IF cp BETWEEN 127 AND 159 THEN RETURN false;END IF;END LOOP;RETURN true;END$$;
CREATE FUNCTION helpdesk_auth.hdn_cfg_string(d jsonb,maxlen int) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$DECLARE s text;units int:=0;BEGIN
 IF jsonb_typeof(d) IS DISTINCT FROM 'string' THEN RETURN false;END IF;s:=d#>>'{}';FOR i IN 1..length(s) LOOP units:=units+CASE WHEN ascii(substr(s,i,1))>65535 THEN 2 ELSE 1 END;IF units>maxlen THEN RETURN false;END IF;END LOOP;RETURN true;END$$;
CREATE FUNCTION helpdesk_auth.hdn_cfg_int(d jsonb,lo bigint,hi bigint) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$BEGIN RETURN coalesce(jsonb_typeof(d)='number' AND d::text ~ '^(0|[1-9][0-9]*)$' AND d::text::numeric BETWEEN lo AND hi,false);EXCEPTION WHEN OTHERS THEN RETURN false;END$$;
CREATE FUNCTION helpdesk_auth.hdn_cfg_date(d jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$BEGIN RETURN coalesce(jsonb_typeof(d)='string' AND d#>>'{}' ~ '^(?!0000)[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND (d#>>'{}')::date::text=d#>>'{}',false);EXCEPTION WHEN OTHERS THEN RETURN false;END$$;
CREATE FUNCTION helpdesk_auth.hdn_cfg_form_id(id uuid,action text,priority text) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$DECLARE h text:=encode(sha256(convert_to(id::text||':'||action||':'||priority,'UTF8')),'hex');BEGIN RETURN substr(h,1,8)||'-'||substr(h,9,4)||'-4'||substr(h,14,3)||'-8'||substr(h,18,3)||'-'||substr(h,21,12);END$$;
CREATE FUNCTION helpdesk_auth.hdn_cfg_valid_form(d jsonb,registry jsonb DEFAULT NULL) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE f jsonb;c jsonb;opt jsonb;w jsonb;prior jsonb;seen jsonb:='{}';code text;opts text[];kind text;
BEGIN
 IF NOT helpdesk_auth.hdn_cfg_object(d,ARRAY['id','version','status','title','fields']) OR NOT helpdesk_auth.hdn_cfg_text(d->'title',200)
 OR d->>'status' IS DISTINCT FROM 'draft' OR jsonb_typeof(d->'fields')<>'array' OR jsonb_array_length(d->'fields') NOT BETWEEN 1 AND 100 THEN RETURN false;END IF;
 FOR f IN SELECT value FROM jsonb_array_elements(d->'fields') LOOP
  IF NOT helpdesk_auth.hdn_cfg_object(f,ARRAY['key','type','label','required','public','config'],ARRAY['when']) OR NOT helpdesk_auth.hdn_cfg_text(f->'label',160)
  OR jsonb_typeof(f->'key')<>'string' OR f->>'key' !~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$' OR f->>'key'=ANY(ARRAY['__proto__','constructor','prototype']) OR seen ? (f->>'key')
  OR jsonb_typeof(f->'required')<>'boolean' OR jsonb_typeof(f->'public')<>'boolean' OR jsonb_typeof(f->'type')<>'string' THEN RETURN false;END IF;
  c:=f->'config';kind:=f->>'type';
  IF kind IN ('text','textarea') THEN
   IF NOT helpdesk_auth.hdn_cfg_object(c,ARRAY['maxLength'],ARRAY['minLength']) OR NOT helpdesk_auth.hdn_cfg_int(c->'maxLength',1,12000) OR c ? 'minLength' AND NOT helpdesk_auth.hdn_cfg_int(c->'minLength',0,(c->>'maxLength')::int) THEN RETURN false;END IF;
  ELSIF kind='boolean' THEN IF c<>'{}'::jsonb THEN RETURN false;END IF;
  ELSIF kind='select' THEN
   IF NOT helpdesk_auth.hdn_cfg_object(c,ARRAY['options']) OR jsonb_typeof(c->'options')<>'array' OR jsonb_array_length(c->'options') NOT BETWEEN 1 AND 100 THEN RETURN false;END IF;opts:='{}';
   FOR opt IN SELECT value FROM jsonb_array_elements(c->'options') LOOP code:=opt->>'value';IF NOT helpdesk_auth.hdn_cfg_object(opt,ARRAY['value','label']) OR jsonb_typeof(opt->'value')<>'string' OR code !~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$' OR code=ANY(ARRAY['__proto__','constructor','prototype']) OR code=ANY(opts) OR NOT helpdesk_auth.hdn_cfg_text(opt->'label',160) THEN RETURN false;END IF;opts:=array_append(opts,code);END LOOP;
  ELSIF kind IN ('lookup','download') THEN
   code:=CASE WHEN kind='lookup' THEN 'resolver' ELSE 'resource' END;
   IF NOT helpdesk_auth.hdn_cfg_object(c,ARRAY[code]) OR jsonb_typeof(c->code)<>'string' OR c->>code !~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$' OR c->>code=ANY(ARRAY['__proto__','constructor','prototype']) OR kind='download' AND f->'required'<>'false'::jsonb THEN RETURN false;END IF;
  ELSIF kind='file' THEN IF NOT helpdesk_auth.hdn_cfg_object(c,ARRAY['maxItems']) OR NOT helpdesk_auth.hdn_cfg_int(c->'maxItems',1,10) THEN RETURN false;END IF;
  ELSIF kind='info' THEN IF NOT helpdesk_auth.hdn_cfg_object(c,ARRAY['text']) OR NOT helpdesk_auth.hdn_cfg_text(c->'text',4000) OR f->'required'<>'false'::jsonb THEN RETURN false;END IF;
  ELSE RETURN false;END IF;
  IF f ? 'when' THEN w:=f->'when';prior:=seen->(w->>'field');IF NOT helpdesk_auth.hdn_cfg_object(w,ARRAY['field','equals']) OR prior IS NULL OR prior ? 'when' OR prior->>'type' NOT IN ('text','select','boolean') OR f->'public'='true'::jsonb AND prior->'public'<>'true'::jsonb THEN RETURN false;END IF;
   IF prior->>'type'='boolean' THEN IF jsonb_typeof(w->'equals')<>'boolean' THEN RETURN false;END IF;ELSE IF NOT helpdesk_auth.hdn_cfg_string(w->'equals',32768) THEN RETURN false;END IF;END IF;
   IF prior->>'type'='select' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(prior->'config'->'options') o WHERE o->'value'=w->'equals') THEN RETURN false;END IF;
  END IF;
  IF registry IS NOT NULL THEN
   IF NOT registry->'types' ? kind OR kind='lookup' AND NOT registry->'lookups' ? (c->>'resolver') OR kind='download' AND NOT registry->'downloads' ? (c->>'resource') OR kind='file' AND registry->'files'<>'true'::jsonb THEN RETURN false;END IF;
  END IF;
  seen:=seen||jsonb_build_object(f->>'key',f);
 END LOOP;RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;END$$;
CREATE FUNCTION helpdesk_auth.hdn_cfg_valid_definition(d jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE c jsonb;e jsonb;f jsonb;ch jsonb;actions text[];priorities text[];i int:=0;id text;h jsonb;holiday date;
BEGIN
 IF octet_length(helpdesk_auth.hdn_workflow_canonical(d))>65536 THEN RETURN false;END IF;
 IF NOT helpdesk_auth.hdn_cfg_object(d,ARRAY['schema','product','id','version','service','title','calendar','entries']) OR d->'schema' IS DISTINCT FROM '1'::jsonb OR d->>'product' IS DISTINCT FROM 'CONSULTE_GEO' OR jsonb_typeof(d->'id') IS DISTINCT FROM 'string' OR d->>'id' IS DISTINCT FROM (d->>'id')::uuid::text OR NOT helpdesk_auth.hdn_cfg_int(d->'version',1,2147483647) OR NOT helpdesk_auth.hdn_cfg_singleline(d->'title',200) THEN RETURN false;END IF;
 CASE d->>'service' WHEN 'user_access' THEN actions:=ARRAY['include','change','disable','resend_access','grant_work_access'];priorities:=ARRAY['normal','normal','normal','normal','normal'];
 WHEN 'problem' THEN actions:=ARRAY['request','request','request','request'];priorities:=ARRAY['urgent','high','normal','low'];
 WHEN 'questions','backup','new_work','structure_adjustment' THEN actions:=ARRAY['request'];priorities:=ARRAY['normal'];ELSE RETURN false;END CASE;
 c:=d->'calendar';IF NOT helpdesk_auth.hdn_cfg_object(c,ARRAY['startDate','endDate','holidays']) OR NOT helpdesk_auth.hdn_cfg_date(c->'startDate') OR NOT helpdesk_auth.hdn_cfg_date(c->'endDate') OR (c->>'endDate')::date-(c->>'startDate')::date NOT BETWEEN 1 AND 366 OR jsonb_typeof(c->'holidays')<>'array' OR jsonb_array_length(c->'holidays')>366 THEN RETURN false;END IF;
 IF (SELECT count(*) FROM jsonb_array_elements(c->'holidays'))<>(SELECT count(DISTINCT value) FROM jsonb_array_elements(c->'holidays')) THEN RETURN false;END IF;
 FOR h IN SELECT value FROM jsonb_array_elements(c->'holidays') LOOP IF NOT helpdesk_auth.hdn_cfg_date(h) THEN RETURN false;END IF;holiday:=(h#>>'{}')::date;IF holiday<(c->>'startDate')::date OR holiday>=(c->>'endDate')::date THEN RETURN false;END IF;END LOOP;
 IF jsonb_typeof(d->'entries')<>'array' OR jsonb_array_length(d->'entries')<>cardinality(actions) THEN RETURN false;END IF;
 FOR e IN SELECT value FROM jsonb_array_elements(d->'entries') LOOP i:=i+1;
  IF NOT helpdesk_auth.hdn_cfg_object(e,ARRAY['action','priority','form','checklist','reopenDays','firstResponseHours','resolutionHours']) OR e->>'action' IS DISTINCT FROM actions[i] OR e->>'priority' IS DISTINCT FROM priorities[i] OR NOT helpdesk_auth.hdn_cfg_int(e->'reopenDays',0,30) OR NOT helpdesk_auth.hdn_cfg_int(e->'firstResponseHours',1,2000) OR NOT helpdesk_auth.hdn_cfg_int(e->'resolutionHours',1,2000) OR (e->>'firstResponseHours')::int>(e->>'resolutionHours')::int THEN RETURN false;END IF;
  f:=e->'form';ch:=e->'checklist';id:=helpdesk_auth.hdn_cfg_form_id((d->>'id')::uuid,actions[i],priorities[i]);
  IF NOT helpdesk_auth.hdn_cfg_valid_form(f) OR f->>'id' IS DISTINCT FROM id OR f->'version' IS DISTINCT FROM d->'version' OR ch->>'id' IS DISTINCT FROM 'cg-exec-'||id OR ch->'version' IS DISTINCT FROM d->'version' OR ch->>'status' IS DISTINCT FROM 'draft' OR NOT helpdesk_auth.hdn_valid_execution_template(ch||'{"status":"published"}'::jsonb) OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(ch->'items') x WHERE x->'required'='true'::jsonb AND x->'evidenceRequired'='true'::jsonb) THEN RETURN false;END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(ch->'items') x WHERE NOT helpdesk_auth.hdn_cfg_checklist_text(x->'label')) THEN RETURN false;END IF;
  IF d->>'service' IN ('new_work','structure_adjustment') AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(f->'fields') x WHERE x->>'type'='file' AND x->'required'='true'::jsonb AND x->'public'='true'::jsonb AND NOT x ? 'when') THEN RETURN false;END IF;
 END LOOP;RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;END$$;
CREATE FUNCTION helpdesk_auth.hdn_cfg_compile(d jsonb,registry jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE e jsonb;ch jsonb;entries jsonb:='[]';calendar jsonb;intervals jsonb;v text:='cg_'||replace(d->>'id','-','_')||'_'||(d->>'version');ref jsonb;start date:=(d->'calendar'->>'startDate')::date;finish date:=(d->'calendar'->>'endDate')::date;
BEGIN
 IF NOT helpdesk_auth.hdn_cfg_valid_definition(d) OR NOT helpdesk_auth.hdn_cfg_object(registry,ARRAY['types','lookups','files','downloads']) OR jsonb_typeof(registry->'types')<>'array' OR jsonb_typeof(registry->'lookups')<>'array' OR jsonb_typeof(registry->'downloads')<>'array' OR jsonb_typeof(registry->'files')<>'boolean' THEN RAISE EXCEPTION 'Configuration not publishable' USING ERRCODE='HDC05';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_array(helpdesk_auth.hdn_workflow_iso((day+time '08:00') AT TIME ZONE 'America/Sao_Paulo'),helpdesk_auth.hdn_workflow_iso((day+time '18:00') AT TIME ZONE 'America/Sao_Paulo')) ORDER BY day),'[]') INTO intervals FROM (SELECT start+n AS day FROM generate_series(0,finish-start-1) n) days WHERE extract(isodow FROM day) BETWEEN 1 AND 5 AND NOT d->'calendar'->'holidays' ? day::text;
 calendar:=jsonb_build_object('versionId',v,'timeZone','America/Sao_Paulo','from',helpdesk_auth.hdn_workflow_iso(start::timestamp AT TIME ZONE 'America/Sao_Paulo'),'until',helpdesk_auth.hdn_workflow_iso(finish::timestamp AT TIME ZONE 'America/Sao_Paulo'),'intervals',intervals);
 FOR e IN SELECT value FROM jsonb_array_elements(d->'entries') LOOP
  IF NOT helpdesk_auth.hdn_cfg_valid_form(e->'form',registry) THEN RAISE EXCEPTION 'Handler not qualified' USING ERRCODE='HDC05';END IF;
  ch:=e->'checklist'||'{"status":"published"}'::jsonb;ref:=jsonb_build_object('id',ch->'id','version',ch->'version','sha256',helpdesk_auth.hdn_workflow_digest(ch));
  entries:=entries||jsonb_build_array(jsonb_build_object('action',e->'action','priority',e->'priority','form',e->'form'||'{"status":"published"}'::jsonb,'checklist',ch,'workflow',jsonb_build_object('versionId','cg-wf-'||(e->'form'->>'id')||'-v'||(d->>'version'),'status','published','reopenWindowMicros',((e->>'reopenDays')::bigint*86400000000)::text,'executionChecklist',ref),'sla',jsonb_build_object('firstResponseMicros',((e->>'firstResponseHours')::bigint*3600000000)::text,'resolutionMicros',((e->>'resolutionHours')::bigint*3600000000)::text,'calendarVersionId',v,'pauseSolutionStates',jsonb_build_array('waiting_customer'))));
 END LOOP;
 RETURN jsonb_build_object('calendar',calendar,'entries',entries,'attachmentsPolicy',CASE WHEN d->>'service' IN ('new_work','structure_adjustment') THEN '{"extensions":[".xlsx",".csv"],"mimeTypes":["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","text/csv"],"maxBytes":15728640}'::jsonb ELSE 'null'::jsonb END);
END$$;
CREATE TABLE helpdesk_auth.hdn_cfg_capabilities(id uuid PRIMARY KEY,workspace_id uuid NOT NULL REFERENCES helpdesk_core.workspaces(id),principal_id uuid NOT NULL REFERENCES helpdesk_auth.principals(id),capability text NOT NULL CHECK(capability IN ('forms.read','forms.write','forms.publish')),revision int NOT NULL CHECK(revision>0),reason text NOT NULL CHECK(helpdesk_auth.hdn_cfg_singleline(to_jsonb(reason),2000)),policy_ref text NOT NULL CHECK(helpdesk_auth.hdn_cfg_singleline(to_jsonb(policy_ref),160)),approved_by uuid NOT NULL REFERENCES helpdesk_auth.principals(id),expires_at timestamptz,active boolean NOT NULL,UNIQUE(workspace_id,principal_id,capability),CHECK(approved_by<>principal_id));
CREATE TABLE helpdesk_auth.hdn_cfg_registries(workspace_id uuid PRIMARY KEY REFERENCES helpdesk_core.workspaces(id),revision int NOT NULL CHECK(revision>0),document jsonb NOT NULL);
CREATE TABLE helpdesk_core.hdn_cfg_catalog(workspace_id uuid PRIMARY KEY REFERENCES helpdesk_core.workspaces(id),revision int NOT NULL DEFAULT 1 CHECK(revision>0));
CREATE TABLE helpdesk_core.hdn_cfg_versions(workspace_id uuid NOT NULL REFERENCES helpdesk_core.workspaces(id),id uuid NOT NULL,version int NOT NULL CHECK(version>0),revision int NOT NULL CHECK(revision>0),status text NOT NULL CHECK(status IN ('draft','published')),definition jsonb NOT NULL CHECK(helpdesk_auth.hdn_cfg_valid_definition(definition)),content_hash text NOT NULL CHECK(content_hash ~ '^[a-f0-9]{64}$'),artifacts jsonb,created_by uuid NOT NULL REFERENCES helpdesk_auth.principals(id),created_at timestamptz NOT NULL,published_by uuid REFERENCES helpdesk_auth.principals(id),published_at timestamptz,PRIMARY KEY(workspace_id,id,version),CHECK(definition->>'id'=id::text AND definition->'version'=to_jsonb(version)),CHECK((status='draft' AND artifacts IS NULL AND published_by IS NULL AND published_at IS NULL) OR (status='published' AND artifacts IS NOT NULL AND published_by IS NOT NULL AND published_at>=created_at)),CHECK(content_hash=helpdesk_auth.hdn_workflow_digest(jsonb_build_object('definition',definition,'artifacts',artifacts))));
CREATE TABLE helpdesk_audit.hdn_cfg_commits(workspace_id uuid NOT NULL REFERENCES helpdesk_core.workspaces(id),id uuid NOT NULL,actor_id uuid NOT NULL REFERENCES helpdesk_auth.principals(id),intent_key text NOT NULL,intent_hash text NOT NULL,command jsonb NOT NULL,result jsonb NOT NULL,at timestamptz NOT NULL,transaction_id xid8 NOT NULL DEFAULT pg_current_xact_id(),PRIMARY KEY(workspace_id,id),UNIQUE(workspace_id,actor_id,intent_key));
CREATE FUNCTION helpdesk_auth.hdn_cfg_authorize(cap text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE w uuid:=helpdesk_auth.workspace_id();who uuid:=helpdesk_auth.actor_id();
BEGIN
 PERFORM 1 FROM helpdesk_auth.principals WHERE id=who AND active AND kind='human' FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Publisher not authorized' USING ERRCODE='HDC01';END IF;
 PERFORM 1 FROM helpdesk_auth.workspace_memberships WHERE workspace_id=w AND principal_id=who AND active AND role='admin' FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Publisher not authorized' USING ERRCODE='HDC01';END IF;
 PERFORM 1 FROM helpdesk_auth.hdn_cfg_capabilities WHERE workspace_id=w AND principal_id=who AND active AND (expires_at IS NULL OR expires_at>clock_timestamp()) AND (cap IS NULL OR capability=cap) ORDER BY capability FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Capability unavailable' USING ERRCODE='HDC01';END IF;
END$$;
CREATE FUNCTION helpdesk_auth.hdn_cfg_workspace() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE w uuid:=helpdesk_auth.workspace_id();who uuid:=helpdesk_auth.actor_id();grants jsonb;
BEGIN PERFORM helpdesk_auth.hdn_cfg_authorize();
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'workspaceId',workspace_id,'principalId',principal_id,'capability',capability,'revision',revision,'reason',reason,'policyRef',policy_ref,'approvedBy',approved_by,'expiresAt',CASE WHEN expires_at IS NULL THEN NULL ELSE helpdesk_auth.hdn_workflow_iso(expires_at) END,'active',active) ORDER BY capability),'[]') INTO grants FROM helpdesk_auth.hdn_cfg_capabilities WHERE workspace_id=w AND principal_id=who;
 RETURN jsonb_build_object('workspaceId',w,'revision',1,'members',jsonb_build_array(jsonb_build_object('principalId',who,'principalKind','human','role','admin','status','active','revision',1,'expiresAt',NULL)),'capabilityGrants',grants);END$$;
CREATE FUNCTION helpdesk_auth.hdn_cfg_record(v helpdesk_core.hdn_cfg_versions) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$SELECT jsonb_build_object('workspaceId',($1).workspace_id,'id',($1).id,'version',($1).version,'revision',($1).revision,'status',($1).status,'definition',($1).definition,'contentHash',($1).content_hash,'artifacts',($1).artifacts,'createdBy',($1).created_by,'createdAt',helpdesk_auth.hdn_workflow_iso(($1).created_at),'publishedBy',($1).published_by,'publishedAt',CASE WHEN ($1).published_at IS NULL THEN NULL ELSE helpdesk_auth.hdn_workflow_iso(($1).published_at) END)$$;
CREATE FUNCTION helpdesk_auth.hdn_cfg_state() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE w uuid:=helpdesk_auth.workspace_id();r int;records jsonb;BEGIN PERFORM helpdesk_auth.hdn_cfg_authorize();SELECT revision INTO r FROM helpdesk_core.hdn_cfg_catalog WHERE workspace_id=w FOR UPDATE;IF NOT FOUND OR (SELECT count(*) FROM helpdesk_core.hdn_cfg_versions WHERE workspace_id=w)>500 OR (SELECT coalesce(sum(octet_length(definition::text)+coalesce(octet_length(artifacts::text),0)),0) FROM helpdesk_core.hdn_cfg_versions WHERE workspace_id=w)>2097152 THEN RAISE EXCEPTION 'Catalog unavailable' USING ERRCODE='HDC08';END IF;SELECT coalesce(jsonb_agg(helpdesk_auth.hdn_cfg_record(v) ORDER BY id,version),'[]') INTO records FROM helpdesk_core.hdn_cfg_versions v WHERE workspace_id=w;RETURN jsonb_build_object('workspaceId',w,'revision',r,'records',records);END$$;
CREATE FUNCTION helpdesk_auth.hdn_cfg_registry() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE d jsonb;BEGIN PERFORM helpdesk_auth.hdn_cfg_authorize('forms.publish');SELECT document INTO d FROM helpdesk_auth.hdn_cfg_registries WHERE workspace_id=helpdesk_auth.workspace_id() FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Registry unavailable' USING ERRCODE='HDC05';END IF;RETURN d;END$$;
CREATE FUNCTION helpdesk_auth.hdn_cfg_receipt(key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE r helpdesk_audit.hdn_cfg_commits;BEGIN PERFORM helpdesk_auth.hdn_cfg_authorize();SELECT * INTO r FROM helpdesk_audit.hdn_cfg_commits WHERE workspace_id=helpdesk_auth.workspace_id() AND actor_id=helpdesk_auth.actor_id() AND intent_key=key;IF NOT FOUND THEN RETURN NULL;END IF;PERFORM helpdesk_auth.hdn_cfg_authorize(CASE WHEN r.command->>'action'='publish' THEN 'forms.publish' ELSE 'forms.write' END);RETURN jsonb_build_object('key',key,'hash',r.intent_hash,'result',r.result);END$$;
CREATE FUNCTION helpdesk_auth.hdn_cfg_version_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$BEGIN IF TG_OP='DELETE' OR OLD.status='published' OR (NEW.workspace_id,NEW.id,NEW.version,NEW.created_by,NEW.created_at) IS DISTINCT FROM (OLD.workspace_id,OLD.id,OLD.version,OLD.created_by,OLD.created_at) OR NEW.revision<>OLD.revision+1 THEN RAISE EXCEPTION 'Configuration immutable' USING ERRCODE='23514';END IF;RETURN NEW;END$$;
CREATE TRIGGER hdn_cfg_version_guard BEFORE UPDATE OR DELETE ON helpdesk_core.hdn_cfg_versions FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdn_cfg_version_guard();
CREATE TRIGGER hdn_cfg_commit_immutable BEFORE UPDATE OR DELETE ON helpdesk_audit.hdn_cfg_commits FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdn_execution_immutable();
CREATE FUNCTION helpdesk_auth.hdn_cfg_commit(cmd jsonb,key text,hash text,supplied_artifacts jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE w uuid:=helpdesk_auth.workspace_id();who uuid:=helpdesk_auth.actor_id();catalog_revision int;old helpdesk_core.hdn_cfg_versions;row helpdesk_core.hdn_cfg_versions;latest int;d jsonb;a jsonb:=NULL;r jsonb;saved helpdesk_audit.hdn_cfg_commits;event uuid:=gen_random_uuid();stamp timestamptz:=clock_timestamp();entry jsonb;action text:=cmd->>'action';target uuid;affected int;
BEGIN
 PERFORM helpdesk_auth.hdn_cfg_authorize(CASE WHEN action='publish' THEN 'forms.publish' ELSE 'forms.write' END);
 IF action NOT IN ('save','publish','restore') OR action IS NULL OR NOT helpdesk_auth.hdn_cfg_object(cmd,ARRAY['action','expectedRevision','expectedEntityRevision','reason','id','version']||CASE WHEN action='save' THEN ARRAY['definition'] ELSE ARRAY[]::text[] END) OR NOT helpdesk_auth.hdn_cfg_singleline(cmd->'reason',2000) OR NOT helpdesk_auth.hdn_cfg_int(cmd->'expectedRevision',1,2147483647) OR NOT helpdesk_auth.hdn_cfg_int(cmd->'expectedEntityRevision',CASE WHEN action='save' THEN 0 ELSE 1 END,2147483647) OR NOT helpdesk_auth.hdn_cfg_int(cmd->'version',1,2147483647) OR key !~ '^[A-Za-z0-9._:-]{16,128}$' OR key IS NULL OR hash IS DISTINCT FROM helpdesk_auth.hdn_workflow_digest(jsonb_build_object('workspaceId',w,'actorId',who,'command',cmd)) THEN RAISE EXCEPTION 'Invalid command' USING ERRCODE='HDC04';END IF;target:=(cmd->>'id')::uuid;
 SELECT revision INTO catalog_revision FROM helpdesk_core.hdn_cfg_catalog WHERE workspace_id=w FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Catalog unavailable' USING ERRCODE='HDC08';END IF;
 SELECT * INTO saved FROM helpdesk_audit.hdn_cfg_commits WHERE workspace_id=w AND actor_id=who AND intent_key=key;
 IF FOUND THEN IF saved.intent_hash<>hash THEN RAISE EXCEPTION 'Idempotency conflict' USING ERRCODE='HDC06';END IF;RETURN saved.result||'{"replayed":true}'::jsonb;END IF;
 IF catalog_revision<>(cmd->>'expectedRevision')::int THEN RAISE EXCEPTION 'Catalog version conflict' USING ERRCODE='HDC02';END IF;
 SELECT * INTO old FROM helpdesk_core.hdn_cfg_versions WHERE workspace_id=w AND id=target AND version=(cmd->>'version')::int FOR UPDATE;
 SELECT coalesce(max(version),0) INTO latest FROM helpdesk_core.hdn_cfg_versions WHERE workspace_id=w AND id=target;
 IF coalesce(old.revision,0)<>(cmd->>'expectedEntityRevision')::int THEN RAISE EXCEPTION 'Entity version conflict' USING ERRCODE='HDC02';END IF;
 stamp:=clock_timestamp();
 IF action='save' THEN
  d:=cmd->'definition';IF NOT helpdesk_auth.hdn_cfg_valid_definition(d) OR d->>'id'<>target::text OR d->'version'<>cmd->'version' OR supplied_artifacts IS NOT NULL THEN RAISE EXCEPTION 'Invalid definition' USING ERRCODE='HDC04';END IF;
  IF old.status='published' THEN RAISE EXCEPTION 'Published configuration immutable' USING ERRCODE='HDC03';END IF;
  IF old.id IS NULL AND (cmd->>'version')::int<>latest+1 THEN RAISE EXCEPTION 'Successor required' USING ERRCODE='HDC02';END IF;
  IF EXISTS(SELECT 1 FROM helpdesk_core.hdn_cfg_versions WHERE workspace_id=w AND id=target AND definition->>'service'<>d->>'service') THEN RAISE EXCEPTION 'Service identity immutable' USING ERRCODE='HDC09';END IF;
 ELSE
  IF old.id IS NULL THEN RAISE EXCEPTION 'Configuration not found' USING ERRCODE='HDC07';END IF;
  IF old.status='published' AND action='publish' THEN RAISE EXCEPTION 'Published configuration immutable' USING ERRCODE='HDC03';END IF;
  d:=old.definition;
  IF action='restore' THEN
   IF old.status<>'published' OR supplied_artifacts IS NOT NULL THEN RAISE EXCEPTION 'Published source required' USING ERRCODE='HDC05';END IF;
   d:=jsonb_set(d,'{version}',to_jsonb(latest+1));SELECT jsonb_agg(jsonb_set(jsonb_set(value,'{form,version}',to_jsonb(latest+1)),'{checklist,version}',to_jsonb(latest+1)) ORDER BY ordinal) INTO entry FROM jsonb_array_elements(d->'entries') WITH ORDINALITY x(value,ordinal);d:=jsonb_set(d,'{entries}',entry);
  ELSE
   a:=helpdesk_auth.hdn_cfg_compile(d,helpdesk_auth.hdn_cfg_registry());IF a IS DISTINCT FROM supplied_artifacts OR (a->'calendar'->>'until')::timestamptz<=clock_timestamp() THEN RAISE EXCEPTION 'Artifacts unqualified or stale' USING ERRCODE='HDC05';END IF;
   FOR entry IN SELECT value FROM jsonb_array_elements(a->'entries') LOOP
    INSERT INTO helpdesk_core.hdn_execution_templates(workspace_id,template_id,version,sha256,document) VALUES(w,entry->'checklist'->>'id',(d->>'version')::int,entry->'workflow'->'executionChecklist'->>'sha256',entry->'checklist');
    GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Checklist not persisted' USING ERRCODE='HDC08';END IF;
    INSERT INTO helpdesk_core.hdn_workflow_profiles(workspace_id,version_id,document) VALUES(w,entry->'workflow'->>'versionId',entry->'workflow');
    GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Workflow not persisted' USING ERRCODE='HDC08';END IF;
   END LOOP;
  END IF;
 END IF;
 IF old.id IS NULL OR action='restore' THEN
  IF (SELECT count(*) FROM helpdesk_core.hdn_cfg_versions WHERE workspace_id=w)>=500 THEN RAISE EXCEPTION 'Catalog bound exceeded' USING ERRCODE='HDC08';END IF;
  INSERT INTO helpdesk_core.hdn_cfg_versions VALUES(w,target,(d->>'version')::int,1,'draft',d,helpdesk_auth.hdn_workflow_digest(jsonb_build_object('definition',d,'artifacts',NULL)),NULL,who,stamp,NULL,NULL) RETURNING * INTO row;
 ELSE UPDATE helpdesk_core.hdn_cfg_versions SET revision=revision+1,status=CASE WHEN action='publish' THEN 'published' ELSE 'draft' END,definition=d,artifacts=a,content_hash=helpdesk_auth.hdn_workflow_digest(jsonb_build_object('definition',d,'artifacts',a)),published_by=CASE WHEN action='publish' THEN who ELSE NULL END,published_at=CASE WHEN action='publish' THEN stamp ELSE NULL END WHERE workspace_id=w AND id=target AND version=old.version RETURNING * INTO row;END IF;
 GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Version not persisted' USING ERRCODE='HDC08';END IF;
 IF (SELECT coalesce(sum(octet_length(definition::text)+coalesce(octet_length(artifacts::text),0)),0) FROM helpdesk_core.hdn_cfg_versions WHERE workspace_id=w)>2097152 THEN RAISE EXCEPTION 'Catalog size exceeded' USING ERRCODE='HDC08';END IF;
 UPDATE helpdesk_core.hdn_cfg_catalog SET revision=revision+1 WHERE workspace_id=w RETURNING revision INTO catalog_revision;GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Catalog revision not persisted' USING ERRCODE='HDC08';END IF;
 r:=jsonb_build_object('workspaceId',w,'actorId',who,'revision',catalog_revision,'record',helpdesk_auth.hdn_cfg_record(row),'auditId',event,'replayed',false);
 INSERT INTO helpdesk_audit.hdn_cfg_commits(workspace_id,id,actor_id,intent_key,intent_hash,command,result,at) VALUES(w,event,who,key,hash,cmd,r,stamp);
 GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Receipt not persisted' USING ERRCODE='HDC08';END IF;
 RETURN r;
END$$;
CREATE FUNCTION helpdesk_auth.hdn_cfg_final_admission() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE v helpdesk_core.hdn_cfg_versions;e jsonb;BEGIN
 IF NEW.workspace_id IS DISTINCT FROM helpdesk_auth.workspace_id() OR NEW.actor_id IS DISTINCT FROM helpdesk_auth.actor_id() OR NEW.transaction_id<>pg_current_xact_id() THEN RAISE EXCEPTION 'Publication context changed' USING ERRCODE='HDC01';END IF;
 PERFORM helpdesk_auth.hdn_cfg_authorize(CASE WHEN NEW.command->>'action'='publish' THEN 'forms.publish' ELSE 'forms.write' END);
 SELECT * INTO v FROM helpdesk_core.hdn_cfg_versions WHERE workspace_id=NEW.workspace_id AND id=(NEW.result->'record'->>'id')::uuid AND version=(NEW.result->'record'->>'version')::int;
 IF NOT FOUND OR v.revision<(NEW.result->'record'->>'revision')::int THEN RAISE EXCEPTION 'Version missing at confirmation' USING ERRCODE='HDC08';END IF;
 IF NEW.command->>'action'='publish' THEN
  IF NEW.result->'record' IS DISTINCT FROM helpdesk_auth.hdn_cfg_record(v) THEN RAISE EXCEPTION 'Publication receipt mismatch' USING ERRCODE='HDC08';END IF;
  FOR e IN SELECT value FROM jsonb_array_elements(v.artifacts->'entries') LOOP
   IF NOT EXISTS(SELECT 1 FROM helpdesk_core.hdn_workflow_profiles WHERE workspace_id=v.workspace_id AND version_id=e->'workflow'->>'versionId' AND document=e->'workflow')
   OR NOT EXISTS(SELECT 1 FROM helpdesk_core.hdn_execution_templates WHERE workspace_id=v.workspace_id AND template_id=e->'checklist'->>'id' AND version=v.version AND sha256=e->'workflow'->'executionChecklist'->>'sha256' AND document=e->'checklist') THEN RAISE EXCEPTION 'Publication artifact missing or mismatched' USING ERRCODE='HDC08';END IF;
  END LOOP;
 END IF;RETURN NULL;END$$;
CREATE CONSTRAINT TRIGGER hdn_cfg_final_admission AFTER INSERT ON helpdesk_audit.hdn_cfg_commits DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdn_cfg_final_admission();
DO $security$ DECLARE obj text;r text;BEGIN
 FOREACH obj IN ARRAY ARRAY['helpdesk_auth.hdn_cfg_capabilities','helpdesk_auth.hdn_cfg_registries','helpdesk_core.hdn_cfg_catalog','helpdesk_core.hdn_cfg_versions','helpdesk_audit.hdn_cfg_commits'] LOOP
  EXECUTE 'ALTER TABLE '||obj||' ENABLE ROW LEVEL SECURITY';EXECUTE 'ALTER TABLE '||obj||' FORCE ROW LEVEL SECURITY';EXECUTE 'REVOKE ALL ON TABLE '||obj||' FROM PUBLIC,helpdesk_app';
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role','authenticator'] LOOP IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN EXECUTE format('REVOKE ALL ON TABLE %s FROM %I',obj,r);END IF;END LOOP;
 END LOOP;
 FOR obj IN SELECT p.oid::regprocedure::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='helpdesk_auth' AND p.proname LIKE 'hdn_cfg_%' LOOP
  EXECUTE 'REVOKE ALL ON FUNCTION '||obj||' FROM PUBLIC,helpdesk_app';FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role','authenticator'] LOOP IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I',obj,r);END IF;END LOOP;
 END LOOP;
END $security$;
GRANT EXECUTE ON FUNCTION helpdesk_auth.hdn_cfg_workspace(),helpdesk_auth.hdn_cfg_state(),helpdesk_auth.hdn_cfg_registry(),helpdesk_auth.hdn_cfg_receipt(text),helpdesk_auth.hdn_cfg_commit(jsonb,text,text,jsonb) TO helpdesk_app;

-- Reserved delivery worker: no request, maintenance or publisher permissions.
DO $m05_worker$ DECLARE ns text;BEGIN
 FOREACH ns IN ARRAY ARRAY['helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit'] LOOP
  EXECUTE format('REVOKE ALL ON SCHEMA %I FROM helpdesk_notification_worker',ns);
  EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM helpdesk_notification_worker',ns);
  EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA %I FROM helpdesk_notification_worker',ns);
  EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA %I FROM helpdesk_notification_worker',ns);
 END LOOP;
END $m05_worker$;
-- Validate EFFECTIVE service boundaries before publishing the schema marker.
DO $m05_final$
DECLARE role_name text;role_oid oid;role_row record;ns record;obj record;allowed boolean;
BEGIN
 FOREACH role_name IN ARRAY ARRAY['helpdesk_resource_publisher','helpdesk_notification_worker'] LOOP
  SELECT * INTO role_row FROM pg_roles WHERE rolname=role_name;IF NOT FOUND THEN RAISE EXCEPTION 'Service boundary unavailable' USING ERRCODE='HDU06';END IF;role_oid:=role_row.oid;
  IF role_row.rolsuper OR role_row.rolbypassrls OR role_row.rolcreaterole OR role_row.rolcreatedb OR role_row.rolreplication OR role_row.rolinherit OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=role_oid OR roleid=role_oid) THEN RAISE EXCEPTION 'Service boundary unsafe' USING ERRCODE='HDU06';END IF;
  FOR ns IN SELECT * FROM pg_namespace WHERE nspname IN ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit') LOOP
   allowed:=role_name='helpdesk_resource_publisher' AND ns.nspname='helpdesk_auth';
   IF ns.nspowner=role_oid OR has_schema_privilege(role_oid,ns.oid,'USAGE') IS DISTINCT FROM allowed OR has_schema_privilege(role_oid,ns.oid,'CREATE,USAGE WITH GRANT OPTION') THEN RAISE EXCEPTION 'Service schema boundary unsafe' USING ERRCODE='HDU06';END IF;
  END LOOP;
  FOR obj IN SELECT c.* FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit') AND c.relkind='r' LOOP
   IF obj.relowner=role_oid OR has_table_privilege(role_oid,obj.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') OR has_any_column_privilege(role_oid,obj.oid,'SELECT,INSERT,UPDATE,REFERENCES') THEN RAISE EXCEPTION 'Service table boundary unsafe' USING ERRCODE='HDU06';END IF;
  END LOOP;
  FOR obj IN SELECT p.*,n.nspname||'.'||p.proname||'('||oidvectortypes(p.proargtypes)||')' AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit') LOOP
   allowed:=role_name='helpdesk_resource_publisher' AND obj.signature IN ('helpdesk_auth.cg_publication_open(text, text)','helpdesk_auth.cg_publication_replace(text, text, text, text, text)','helpdesk_auth.cg_publication_append(text, text, text)');
   IF obj.proowner=role_oid OR has_function_privilege(role_oid,obj.oid,'EXECUTE') IS DISTINCT FROM allowed OR has_function_privilege(role_oid,obj.oid,'EXECUTE WITH GRANT OPTION') THEN RAISE EXCEPTION 'Service function boundary unsafe' USING ERRCODE='HDU06';END IF;
  END LOOP;
 END LOOP;
END $m05_final$;
CREATE OR REPLACE FUNCTION helpdesk_auth.schema_version() RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$SELECT '0.20.0'::text$$;
COMMIT;
