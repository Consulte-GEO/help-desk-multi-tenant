-- Candidate M1 migration. Apply first to a fresh PostgreSQL 17 test database.
-- The backend authenticates the actor; app.* settings are selectors, NOT credentials.
begin;

create function helpdesk_auth.has_scope(w uuid,requested text)
returns boolean language sql stable security definer set search_path='' as $$
 select w=helpdesk_auth.workspace_id() and exists(
  select 1 from helpdesk_auth.principals p where p.id=helpdesk_auth.actor_id() and p.active and (
   (p.kind='human' and requested=any(array['contexts:resolve','tickets:read','tickets:write','notes:read','notes:write'])
    and (exists(select 1 from helpdesk_auth.workspace_memberships m where m.workspace_id=w and m.principal_id=p.id and m.active)
      or exists(select 1 from helpdesk_auth.account_grants g where g.workspace_id=w and g.principal_id=p.id and g.active)))
   or (p.kind='integration' and exists(select 1 from helpdesk_auth.integration_connections c
       where c.workspace_id=w and c.principal_id=p.id and c.active and requested=any(c.scopes)))
  )
 )
$$;
revoke all on function helpdesk_auth.has_scope(uuid,text) from public;
grant execute on function helpdesk_auth.has_scope(uuid,text) to helpdesk_app;

-- Restrictive policies are AND-ed with existing resource/relationship policies.
create policy ticket_scope_read on helpdesk_core.tickets as restrictive for select to helpdesk_app
 using(helpdesk_auth.has_scope(workspace_id,'tickets:read'));
create policy ticket_scope_insert on helpdesk_core.tickets as restrictive for insert to helpdesk_app
 with check(helpdesk_auth.has_scope(workspace_id,'tickets:write') and helpdesk_auth.has_scope(workspace_id,'tickets:read'));
create policy ticket_scope_update on helpdesk_core.tickets as restrictive for update to helpdesk_app
 using(helpdesk_auth.has_scope(workspace_id,'tickets:write')) with check(helpdesk_auth.has_scope(workspace_id,'tickets:write'));
create policy message_scope_insert on helpdesk_core.ticket_messages as restrictive for insert to helpdesk_app
 with check(helpdesk_auth.has_scope(workspace_id,'tickets:write') and actor_type=case
  when helpdesk_auth.is_operator(workspace_id,account_id) then 'human_agent'
  when helpdesk_auth.is_human() then 'customer' else 'integration' end);
create policy note_scope_read on helpdesk_core.internal_notes as restrictive for select to helpdesk_app
 using(helpdesk_auth.has_scope(workspace_id,'notes:read'));
create policy note_scope_insert on helpdesk_core.internal_notes as restrictive for insert to helpdesk_app
 with check(helpdesk_auth.has_scope(workspace_id,'notes:write'));
create policy event_scope_insert on helpdesk_core.ticket_events as restrictive for insert to helpdesk_app
 with check((customer_visible and helpdesk_auth.has_scope(workspace_id,'tickets:write'))
  or (not customer_visible and helpdesk_auth.has_scope(workspace_id,'notes:write') and helpdesk_auth.is_operator(workspace_id,account_id)));
create policy coverage_scope_read on helpdesk_core.coverages as restrictive for select to helpdesk_app
 using(helpdesk_auth.has_scope(workspace_id,'contexts:resolve') or helpdesk_auth.has_scope(workspace_id,'tickets:write'));
create policy idem_scope_read on helpdesk_integration.api_idempotency_keys as restrictive for select to helpdesk_app
 using(helpdesk_auth.has_scope(workspace_id,'tickets:read'));
create policy idem_scope_insert on helpdesk_integration.api_idempotency_keys as restrictive for insert to helpdesk_app
 with check(helpdesk_auth.has_scope(workspace_id,'tickets:write') or helpdesk_auth.has_scope(workspace_id,'notes:write'));

-- The definer helper bypasses policies, so it requires its own scope check.
create or replace function helpdesk_auth.locked_coverages(w uuid,a uuid,i uuid,svc text)
returns setof jsonb language plpgsql security definer set search_path='' as $$
declare r record; seen integer:=0;
begin
 if not helpdesk_auth.has_account(w,a) or not helpdesk_auth.product_allowed(w,i)
    or not (helpdesk_auth.has_scope(w,'contexts:resolve') or helpdesk_auth.has_scope(w,'tickets:write')) then
  raise exception 'Unauthorized context' using errcode='42501';
 end if;
 for r in select c.id,c.workspace_id,c.account_id,c.product_instance_id,c.service_code,c.enabled,
   v.id as contract_version_id,v.version,v.published,v.valid_from,v.valid_until,v.policy,k.id as contract_id,k.status
  from helpdesk_core.coverages c
  join helpdesk_core.contract_versions v on v.workspace_id=c.workspace_id and v.id=c.contract_version_id
  join helpdesk_core.support_contracts k on k.workspace_id=v.workspace_id and k.id=v.contract_id
  where c.workspace_id=w and c.account_id=a and c.product_instance_id=i and c.service_code=svc
  order by c.id limit 101 for share of c,v,k
 loop
  seen:=seen+1;
  if seen>100 then raise exception 'Coverage configuration exceeds supported limit' using errcode='PHD03'; end if;
  return next jsonb_build_object('id',r.id,'workspaceId',r.workspace_id,'accountId',r.account_id,
   'productInstanceId',r.product_instance_id,'serviceCode',r.service_code,'enabled',r.enabled,
   'contractVersionId',r.contract_version_id,'contractVersion',r.version,'published',r.published,
   'validFrom',r.valid_from,'validUntil',r.valid_until,'policy',r.policy,'contractId',r.contract_id,'contractStatus',r.status);
 end loop;
end$$;

-- Guards run in addition to RLS; the base immutable-context/version trigger remains.
create function helpdesk_core.guard_ticket_transition() returns trigger
language plpgsql set search_path='' as $$
declare allowed text[];
begin
 if new.status=old.status then return new; end if;
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
create trigger authorized_ticket_transition before update on helpdesk_core.tickets
 for each row execute function helpdesk_core.guard_ticket_transition();
revoke all on function helpdesk_core.guard_ticket_transition() from public;

alter table helpdesk_core.ticket_events add constraint event_visibility_kind check(
 (type in ('ticket.created','message.created','ticket.status_changed') and customer_visible) or
 (type='note.created' and not customer_visible));

-- Bound potentially large configuration/response snapshots before they reach requests.
alter table helpdesk_core.contract_versions add constraint policy_size_limit check(octet_length(policy::text)<=16384);
alter table helpdesk_core.tickets add constraint contract_snapshot_size_limit check(octet_length(contract_snapshot::text)<=20000);
commit;
