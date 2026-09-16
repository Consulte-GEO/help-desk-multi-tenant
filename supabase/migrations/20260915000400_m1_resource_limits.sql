-- Candidate M1 migration; no scheduler, secret or remote environment is changed by this file.
begin;
do $$begin
 if to_regprocedure('helpdesk_auth.has_scope(uuid,text)') is null then
  raise exception 'Apply M1 authorization migration before resource limits';
 end if;
end$$;
create table helpdesk_auth.rate_limit_buckets(
 policy text not null check(policy in ('ingress','token_exchange','principal','workspace')),
 bucket_key text not null check(bucket_key ~ '^[a-f0-9]{64}$'),
 window_start timestamptz not null,
 used integer not null check(used between 0 and 1800),
 primary key(policy,bucket_key)
);
alter table helpdesk_auth.rate_limit_buckets enable row level security;
alter table helpdesk_auth.rate_limit_buckets force row level security;
revoke all on helpdesk_auth.rate_limit_buckets from public,helpdesk_app;
create index rate_limit_expiry on helpdesk_auth.rate_limit_buckets(window_start);

-- Fixed 60-second windows. All budgets are locked in a deterministic order and
-- consumed atomically. Caller supplies HMAC identities but cannot choose thresholds.
create function helpdesk_auth.consume_rate_limits(budgets jsonb) returns jsonb
language plpgsql volatile security definer set search_path='' set lock_timeout='1500ms' as $$
declare r record; window_at timestamptz; current_count integer; maximum integer; retry_seconds integer;
begin
 if budgets is null or jsonb_typeof(budgets)<>'array' then
  raise exception 'Invalid budgets' using errcode='22023';
 end if;
 if jsonb_array_length(budgets)<1 or jsonb_array_length(budgets)>4 then
  raise exception 'Invalid budget count' using errcode='22023';
 end if;
 if exists(select 1 from jsonb_array_elements(budgets) b where jsonb_typeof(b)<>'object') then
  raise exception 'Invalid budget shape' using errcode='22023';
 end if;
 if exists(select 1 from jsonb_array_elements(budgets) b where
     jsonb_typeof(b->'policy') is distinct from 'string' or jsonb_typeof(b->'key') is distinct from 'string'
     or b->>'policy' is null or b->>'policy' not in ('ingress','token_exchange','principal','workspace')
     or b->>'key' is null or b->>'key' !~ '^[a-f0-9]{64}$'
     or (select count(*) from jsonb_object_keys(b))<>2) then
  raise exception 'Invalid budget' using errcode='22023';
 end if;
 if (select count(distinct b->>'policy') from jsonb_array_elements(budgets) b)<>jsonb_array_length(budgets) then
  raise exception 'Duplicate policy' using errcode='22023';
 end if;
 for r in select b->>'policy' as policy,b->>'key' as bucket_key from jsonb_array_elements(budgets) b order by policy,bucket_key loop
  perform pg_advisory_xact_lock(hashtextextended('helpdesk-rate:'||r.policy||':'||r.bucket_key,0));
 end loop;
 window_at:=to_timestamp(floor(extract(epoch from clock_timestamp())/60)*60);
 for r in select b->>'policy' as policy,b->>'key' as bucket_key from jsonb_array_elements(budgets) b order by policy,bucket_key loop
  maximum:=case r.policy when 'ingress' then 120 when 'token_exchange' then 10 when 'principal' then 120 when 'workspace' then 1800 end;
  select coalesce(max(used),0) into current_count from helpdesk_auth.rate_limit_buckets
   where policy=r.policy and bucket_key=r.bucket_key and window_start=window_at;
  if current_count>=maximum then
   retry_seconds:=greatest(1,least(60,ceil(extract(epoch from window_at+interval '1 minute'-clock_timestamp()))::integer));
   return jsonb_build_object('allowed',false,'retry_after',retry_seconds);
  end if;
 end loop;
 for r in select b->>'policy' as policy,b->>'key' as bucket_key from jsonb_array_elements(budgets) b order by policy,bucket_key loop
  insert into helpdesk_auth.rate_limit_buckets(policy,bucket_key,window_start,used)
   values(r.policy,r.bucket_key,window_at,1)
  on conflict(policy,bucket_key) do update set
   used=case when helpdesk_auth.rate_limit_buckets.window_start=excluded.window_start then helpdesk_auth.rate_limit_buckets.used+1 else 1 end,
   window_start=excluded.window_start;
 end loop;
 return jsonb_build_object('allowed',true,'retry_after',0);
end$$;
revoke all on function helpdesk_auth.consume_rate_limits(jsonb) from public;
grant execute on function helpdesk_auth.consume_rate_limits(jsonb) to helpdesk_app;

-- Reuse tokens for their short lifetime instead of minting on every request.
create index integration_sessions_expiry on helpdesk_auth.integration_sessions(expires_at);
create index integration_sessions_credential on helpdesk_auth.integration_sessions(credential_id,expires_at);
create function helpdesk_auth.limit_active_sessions() returns trigger
language plpgsql security definer set search_path='' as $$
declare conn uuid; w uuid; count_active integer;
begin
 select connection_id,workspace_id into conn,w from helpdesk_auth.integration_credentials where id=new.credential_id;
 if not found then raise exception 'Unknown credential' using errcode='23503'; end if;
 perform pg_advisory_xact_lock(hashtextextended('helpdesk-session:'||w::text||':'||conn::text,0));
 select count(*) into count_active from helpdesk_auth.integration_sessions s
 join helpdesk_auth.integration_credentials k on k.id=s.credential_id
 where k.workspace_id=w and k.connection_id=conn and k.revoked_at is null
  and (k.expires_at is null or k.expires_at>clock_timestamp()) and s.expires_at>clock_timestamp();
 if count_active>=50 then raise exception 'Active session quota reached' using errcode='PHD01'; end if;
 return new;
end$$;
create trigger integration_session_quota before insert on helpdesk_auth.integration_sessions
 for each row execute function helpdesk_auth.limit_active_sessions();
revoke all on function helpdesk_auth.limit_active_sessions() from public;
alter table helpdesk_auth.integration_credentials add constraint credential_hash_hex check(key_hash ~ '^[a-f0-9]{64}$');
alter table helpdesk_auth.integration_sessions add constraint session_hash_hex check(token_hash ~ '^[a-f0-9]{64}$');

-- Replay body: 7 days. Tombstone/hash: 90 days. No ticket/message/event is deleted.
alter table helpdesk_integration.api_idempotency_keys
 add column response_expires_at timestamptz not null default (now()+interval '7 days'),
 add column purge_after timestamptz not null default (now()+interval '90 days'),
 alter column result drop not null;
alter table helpdesk_integration.api_idempotency_keys
 add constraint idempotency_lifetime_order check(response_expires_at>created_at and purge_after>response_expires_at),
 add constraint idempotency_result_size check(result is null or octet_length(result::text)<=98304);
create index idempotency_response_expiry on helpdesk_integration.api_idempotency_keys(response_expires_at) where result is not null;
create index idempotency_purge on helpdesk_integration.api_idempotency_keys(purge_after);
create index idempotency_principal_expiry on helpdesk_integration.api_idempotency_keys(workspace_id,principal_id,response_expires_at);
-- Cached responses are protected as strongly as their original resource.
-- Migration stops rather than discarding any malformed historical cache row.
alter table helpdesk_integration.api_idempotency_keys add column resource_ticket_id uuid,add column account_id uuid;
update helpdesk_integration.api_idempotency_keys b
 set resource_ticket_id=case when operation='tickets.create' or operation like 'transitions.create:%'
  then (result->>'id')::uuid else (result->>'ticketId')::uuid end;
update helpdesk_integration.api_idempotency_keys b set account_id=t.account_id
 from helpdesk_core.tickets t where t.workspace_id=b.workspace_id and t.id=b.resource_ticket_id;
alter table helpdesk_integration.api_idempotency_keys
 alter column resource_ticket_id set not null,alter column account_id set not null,
 add constraint idempotency_ticket_ref foreign key(workspace_id,account_id,resource_ticket_id)
  references helpdesk_core.tickets(workspace_id,account_id,id);
revoke select on helpdesk_integration.api_idempotency_keys from helpdesk_app;

create function helpdesk_auth.lookup_idempotency(op text,request_key text) returns jsonb
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

create function helpdesk_auth.limit_idempotency_records() returns trigger
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
 else raise exception 'Unsupported idempotency operation' using errcode='23514';
 end if;
 select * into t from helpdesk_core.tickets where workspace_id=new.workspace_id and id=target;
 if not found then raise exception 'Unknown cache resource' using errcode='23503'; end if;
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
create trigger idempotency_record_quota before insert on helpdesk_integration.api_idempotency_keys
 for each row execute function helpdesk_auth.limit_idempotency_records();
revoke all on function helpdesk_auth.limit_idempotency_records() from public;

-- A separate operational identity, with only this bounded routine. No login/password is provisioned.
do $$begin
 if not exists(select 1 from pg_roles where rolname='helpdesk_maintenance') then
  create role helpdesk_maintenance nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
 end if;
 if exists(select 1 from pg_roles where rolname='helpdesk_maintenance' and (rolsuper or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls)) then
  raise exception 'Unsafe existing maintenance role';
 end if;
end$$;
grant usage on schema helpdesk_auth to helpdesk_maintenance;
create function helpdesk_auth.maintain_ephemeral(dry_run boolean default true,batch_size integer default 500)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='1500ms' as $$
declare n_sessions integer; n_buckets integer; n_responses integer; n_tombstones integer; at_time timestamptz:=clock_timestamp();
begin
 if dry_run is null or batch_size is null or batch_size<1 or batch_size>1000 then
  raise exception 'Invalid maintenance arguments' using errcode='22023';
 end if;
 -- Serialize maintenance only; no locks on business tables or rows awaiting dispatch.
 perform pg_advisory_xact_lock(hashtextextended('helpdesk-ephemeral-maintenance',0));
 if dry_run then
  select count(*) into n_sessions from (select 1 from helpdesk_auth.integration_sessions where expires_at<at_time-interval '1 day' limit batch_size) q;
  select count(*) into n_buckets from (select 1 from helpdesk_auth.rate_limit_buckets where window_start<at_time-interval '1 day' limit batch_size) q;
  select count(*) into n_responses from (select 1 from helpdesk_integration.api_idempotency_keys where response_expires_at<at_time and result is not null limit batch_size) q;
  select count(*) into n_tombstones from (select 1 from helpdesk_integration.api_idempotency_keys where purge_after<at_time limit batch_size) q;
 else
  with chosen as (select token_hash from helpdesk_auth.integration_sessions where expires_at<at_time-interval '1 day' order by expires_at limit batch_size for update skip locked)
   delete from helpdesk_auth.integration_sessions s using chosen c where s.token_hash=c.token_hash;
  get diagnostics n_sessions=row_count;
  with chosen as (select policy,bucket_key from helpdesk_auth.rate_limit_buckets where window_start<at_time-interval '1 day' order by window_start limit batch_size for update skip locked)
   delete from helpdesk_auth.rate_limit_buckets b using chosen c where b.policy=c.policy and b.bucket_key=c.bucket_key;
  get diagnostics n_buckets=row_count;
  with chosen as (select workspace_id,principal_id,operation,key from helpdesk_integration.api_idempotency_keys where response_expires_at<at_time and result is not null order by response_expires_at limit batch_size for update skip locked)
   update helpdesk_integration.api_idempotency_keys b set result=null from chosen c
    where (b.workspace_id,b.principal_id,b.operation,b.key)=(c.workspace_id,c.principal_id,c.operation,c.key);
  get diagnostics n_responses=row_count;
  with chosen as (select workspace_id,principal_id,operation,key from helpdesk_integration.api_idempotency_keys where purge_after<at_time order by purge_after limit batch_size for update skip locked)
   delete from helpdesk_integration.api_idempotency_keys b using chosen c
    where (b.workspace_id,b.principal_id,b.operation,b.key)=(c.workspace_id,c.principal_id,c.operation,c.key);
  get diagnostics n_tombstones=row_count;
 end if;
 return jsonb_build_object('dry_run',dry_run,'batch_limit_per_category',batch_size,'sessions',n_sessions,'rate_buckets',n_buckets,'replay_bodies',n_responses,'tombstones',n_tombstones);
end$$;
revoke all on function helpdesk_auth.maintain_ephemeral(boolean,integer) from public,helpdesk_app;
grant execute on function helpdesk_auth.maintain_ephemeral(boolean,integer) to helpdesk_maintenance;

create function helpdesk_auth.schema_version() returns text language sql stable set search_path='' as $$select '0.2.0'::text$$;
revoke all on function helpdesk_auth.schema_version() from public;
grant execute on function helpdesk_auth.schema_version() to helpdesk_app;
-- Explicitly remove inherited Supabase client grants on new objects.
do $$declare r text;begin
 foreach r in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=r) then
   execute format('revoke all on helpdesk_auth.rate_limit_buckets from %I',r);
   execute format('revoke all on all functions in schema helpdesk_auth,helpdesk_core from %I',r);
  end if;
 end loop;
end$$;
commit;
