-- Production composition component. Does not create a principal, binding, grant or job.
create function helpdesk_auth.hda02_storage_version() returns text language sql stable security definer set search_path='' as $$
 select case when helpdesk_auth.schema_version()='0.26.0' then '1.0.0'::text else null end
$$;
create function helpdesk_auth.hda02_worker_target() returns jsonb language plpgsql security definer set search_path='' as $$
declare selected jsonb;
begin
 if session_user<>'helpdesk_registration_worker' then raise exception 'HDA worker denied' using errcode='HDJ01';end if;
 -- Scheduling metadata only. Claim/load/settlement independently reauthorize and
 -- lock every permission in the existing HDA transaction. Protected CG products
 -- remain denied for technical integration actors.
 select jsonb_build_object('workspaceId',b.workspace_id,'accountId',b.account_id,'actorId',p.id,'bindingId',b.id) into selected
 from helpdesk_integration.hda02_jobs j
 join helpdesk_integration.hda02_operations o on o.workspace_id=j.workspace_id and o.id=j.operation_id and o.current_job_id=j.id
 join helpdesk_integration.hda02_bindings b on b.workspace_id=o.workspace_id and b.account_id=o.account_id and b.id=o.binding_id and b.enabled and b.valid_until>clock_timestamp()
 join helpdesk_integration.hda02_grants g on g.workspace_id=b.workspace_id and g.binding_id=b.id and g.enabled and g.valid_until>clock_timestamp() and g.permissions @> array['read','claim','complete','fail']::text[]
 join helpdesk_auth.principals p on p.id=g.principal_id and p.active and p.kind='integration'
 join helpdesk_auth.integration_connections c on c.workspace_id=b.workspace_id and c.principal_id=p.id and c.active and c.scopes @> array['tickets:read']::text[]
 join helpdesk_auth.source_scope_bindings s on s.workspace_id=c.workspace_id and s.connection_id=c.id and s.account_id=b.account_id and s.active
 join helpdesk_core.tickets t on t.workspace_id=o.workspace_id and t.account_id=o.account_id and t.id=o.ticket_id and t.product_instance_id=c.product_instance_id
 where (j.status='queued' or (j.status='leased' and j.lease_until<=clock_timestamp()))
 and t.status not in ('cancelled','closed','resolved')
 and helpdesk_auth.cg_unscoped_product(t.workspace_id,t.product_instance_id)
 order by o.created_at,o.workspace_id,o.id,p.id limit 1;
 return selected;
end $$;
revoke all on function helpdesk_auth.hda02_worker_target(),helpdesk_auth.hda02_storage_version() from public;
grant execute on function helpdesk_auth.hda02_worker_target(),helpdesk_auth.hda02_storage_version() to helpdesk_registration_worker;
