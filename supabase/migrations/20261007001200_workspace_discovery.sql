begin;
-- Input is a human identity validated by Auth in the trusted backend. No browser RPC grant.
-- Discovery grants no scopes/accounts and each selected workspace is revalidated by resolve_human.
create function helpdesk_auth.list_human_workspaces(user_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',visible.id,'name',visible.name) order by visible.name,visible.id),'[]'::jsonb)
 from (
  select w.id,w.name from helpdesk_core.workspaces w
  where exists(select 1 from helpdesk_auth.principals p
   where p.supabase_user_id=user_id and p.kind='human' and p.active
    and (exists(select 1 from helpdesk_auth.workspace_memberships m where m.workspace_id=w.id and m.principal_id=p.id and m.active)
     or exists(select 1 from helpdesk_auth.account_grants g where g.workspace_id=w.id and g.principal_id=p.id and g.active)))
  order by w.name,w.id limit 51
 ) visible
$$;
revoke all on function helpdesk_auth.list_human_workspaces(uuid) from public,helpdesk_app;
grant execute on function helpdesk_auth.list_human_workspaces(uuid) to helpdesk_app;
do $$declare r text;begin
 foreach r in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=r) then
   execute format('revoke all on function helpdesk_auth.list_human_workspaces(uuid) from %I',r);
  end if;
 end loop;
end$$;
create or replace function helpdesk_auth.schema_version() returns text
language sql immutable set search_path='' as $$select '0.19.0'::text$$;
commit;
