-- CG03e extension of the guarded SQL candidate. NOT a production migration.
-- Executed after cg_resource_scope.sql only in the existing owned PG17 test runner.
do $candidate$
begin
 if current_setting('app.cg03e_candidate',true) is distinct from 'disposable-pg17'
  or current_database()<>'helpdesk_test'
  or current_setting('server_version_num')::integer not between 170000 and 179999
  or to_regclass('helpdesk_auth.cg_resource_grant_sets') is null
  or not exists(select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls)) then
  raise exception 'CG03e requires its owned disposable PostgreSQL17 fixture' using errcode='42501';
 end if;
end $candidate$;

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
