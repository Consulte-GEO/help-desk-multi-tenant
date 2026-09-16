-- Candidate migration. Apply ONLY in an approved workflow after fresh PostgreSQL 17 tests.
-- Self-revocation terminates one short bearer, never its credential, connection or peers.
begin;

create function helpdesk_auth.revoke_session(p_session_hash text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_session_hash is null or p_session_hash !~ '^[a-f0-9]{64}$' then
  raise exception 'Invalid session digest' using errcode='22023';
 end if;
 delete from helpdesk_auth.integration_sessions where token_hash=p_session_hash;
 -- Uniform acknowledgement for absent, expired and already revoked bearers.
 -- Possession of a session's digest is the sole selector; no workspace/ID is accepted.
 return true;
end$$;
revoke all on function helpdesk_auth.revoke_session(text) from public;
grant execute on function helpdesk_auth.revoke_session(text) to helpdesk_app;

do $$declare r text;begin
 foreach r in array array['anon','authenticated','service_role','helpdesk_maintenance'] loop
  if exists(select 1 from pg_roles where rolname=r) then
   execute format('revoke all on function helpdesk_auth.revoke_session(text) from %I',r);
  end if;
 end loop;
end$$;

create or replace function helpdesk_auth.schema_version()
returns text language sql stable set search_path='' as $$select '0.4.0'::text$$;
revoke all on function helpdesk_auth.schema_version() from public;
grant execute on function helpdesk_auth.schema_version() to helpdesk_app;
commit;
