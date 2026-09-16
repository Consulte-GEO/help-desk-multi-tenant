-- Candidate v0.5.0. Private read-only discovery; never replaces create-time contract checks.
-- Apply to disposable PostgreSQL 17 first. Prior migrations remain unchanged.
begin;
create index coverage_catalog_cursor on helpdesk_core.coverages
 (workspace_id,account_id,product_instance_id,service_code collate "C")
 include(product_id,contract_version_id) where enabled;

create function helpdesk_auth.support_contexts(
 w uuid,selected_account uuid,after_account uuid,after_instance uuid,after_service text,page_size integer
) returns setof jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if w is null or w is distinct from helpdesk_auth.workspace_id() or not helpdesk_auth.has_scope(w,'contexts:resolve') then
  raise exception 'Unauthorized context discovery' using errcode='42501';
 end if;
 if selected_account is not null and not helpdesk_auth.has_account(w,selected_account) then
  raise exception 'Unauthorized context discovery' using errcode='42501';
 end if;
 if page_size is null or page_size<1 or page_size>101
    or num_nonnulls(after_account,after_instance,after_service) not in (0,3)
    or (after_service is not null and (length(after_service) not between 1 and 80 or btrim(after_service)='' or after_service ~ '[[:cntrl:]]')) then
  raise exception 'Invalid catalogue window' using errcode='22023';
 end if;
 return query
 with eligible as (
  select distinct c.workspace_id,c.account_id,c.product_id,c.product_instance_id,c.service_code collate "C" as service_code
  from helpdesk_core.coverages c
  join helpdesk_core.contract_versions v on v.workspace_id=c.workspace_id and v.id=c.contract_version_id
  join helpdesk_core.support_contracts k on k.workspace_id=v.workspace_id and k.id=v.contract_id
  where c.workspace_id=w and c.enabled and v.published and k.status='active'
   and v.valid_from<=statement_timestamp() and (v.valid_until is null or statement_timestamp()<v.valid_until)
   and helpdesk_auth.has_account(w,c.account_id) and helpdesk_auth.product_allowed(w,c.product_instance_id)
   and (selected_account is null or c.account_id=selected_account)
   and (after_account is null or (c.account_id,c.product_instance_id,c.service_code collate "C")
         >(after_account,after_instance,after_service collate "C"))
  order by c.account_id,c.product_instance_id,c.service_code collate "C"
  limit page_size
 )
 select jsonb_build_object(
  'workspaceId',e.workspace_id,'accountId',e.account_id,'accountName',left(a.name,160),
  'productInstanceId',e.product_instance_id,'productName',left(p.name,160),'environment',i.environment,
  'serviceCode',e.service_code,'serviceName',left(s.name,160))
 from eligible e
 join helpdesk_core.accounts a on a.workspace_id=e.workspace_id and a.id=e.account_id
 join helpdesk_core.products p on p.workspace_id=e.workspace_id and p.id=e.product_id
 join helpdesk_core.product_instances i on i.workspace_id=e.workspace_id and i.id=e.product_instance_id
 join helpdesk_core.services s on s.workspace_id=e.workspace_id and s.product_id=e.product_id and s.code=e.service_code
 order by e.account_id,e.product_instance_id,e.service_code collate "C";
end$$;
revoke all on function helpdesk_auth.support_contexts(uuid,uuid,uuid,uuid,text,integer) from public;
grant execute on function helpdesk_auth.support_contexts(uuid,uuid,uuid,uuid,text,integer) to helpdesk_app;
-- Clear inherited Supabase default EXECUTE grants without exposing the domain schemas.
do $client_grants$ declare r text;begin
 foreach r in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=r) then
   execute format('revoke all on function helpdesk_auth.support_contexts(uuid,uuid,uuid,uuid,text,integer) from %I',r);
  end if;
 end loop;
end $client_grants$;
create or replace function helpdesk_auth.schema_version() returns text language sql immutable set search_path='' as $$select '0.5.0'::text$$;
revoke all on function helpdesk_auth.schema_version() from public;
grant execute on function helpdesk_auth.schema_version() to helpdesk_app;
commit;
