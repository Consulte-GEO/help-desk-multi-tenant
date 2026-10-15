-- HDA E06 read companion CANDIDATE. No hosted migration or worker provisioning.
-- Install only AFTER HDA02 in the owned full-core PostgreSQL acceptance harness.
-- A production integration migration must independently qualify HDA02 first.
begin;
do $admission$
begin
 if current_database()<>'helpdesk_test' or current_user<>'hda_test_owner'
 or current_setting('hda02.disposable',true) is distinct from 'owned-local-cluster'
 or helpdesk_auth.schema_version() not in ('0.24.0','0.25.0')
 or to_regclass('helpdesk_integration.hda02_operations') is null
 or to_regprocedure('helpdesk_auth.hda02_authorize(jsonb)') is null
 or to_regprocedure('helpdesk_auth.hda06_review_target(uuid,boolean)') is not null
 then raise exception 'Qualified full-core HDA installation required' using errcode='HDJ05';end if;
end $admission$;
create function helpdesk_auth.hda06_review_target(requested_ticket uuid,internal_view boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare w uuid:=helpdesk_auth.workspace_id();actor uuid:=helpdesk_auth.actor_id();t helpdesk_core.tickets%rowtype;
 b helpdesk_integration.hda02_bindings%rowtype;op uuid;ids uuid[];s jsonb;
begin
 if session_user<>'helpdesk_app' or internal_view is null or not coalesce(helpdesk_auth.is_human(),false)
 or not coalesce(helpdesk_auth.has_scope(w,'tickets:read'),false)
 then raise exception 'HDA review denied' using errcode='HDJ01';end if;
 select * into t from helpdesk_core.tickets where workspace_id=w and id=requested_ticket for share;
 if not found or not coalesce(helpdesk_auth.can_read_ticket(w,t.account_id,t.product_instance_id,t.created_by),false)
 or not coalesce(helpdesk_auth.cg_ticket_resource_allowed(w,t.account_id,t.id,'tickets.read'),false)
 then raise exception 'HDA review denied' using errcode='HDJ01';end if;
 if internal_view and not coalesce(helpdesk_auth.is_operator(w,t.account_id),false)
 then raise exception 'HDA private review denied' using errcode='HDJ01';end if;
 -- Ambiguous operations are an installation/data error, never select a convenient
 -- first/latest row. A browser supplies neither binding nor operation identifiers.
 select array_agg(id) into ids from (select id from helpdesk_integration.hda02_bindings
 where workspace_id=w and account_id=t.account_id and ticket_id=t.id and enabled order by id limit 2) x;
 if coalesce(cardinality(ids),0)=0 then return null;end if;
 if cardinality(ids)<>1 then raise exception 'Ambiguous HDA binding' using errcode='HDJ05';end if;
 select * into strict b from helpdesk_integration.hda02_bindings where workspace_id=w and id=ids[1] for share;
 s:=helpdesk_auth.hda02_authorize(jsonb_build_object('workspaceId',w,'accountId',t.account_id,'actorId',actor,'bindingId',b.id,'permission','read'));
 -- hda02_authorize holds the current human scope/membership/account/HDA grants.
 if internal_view and not coalesce(helpdesk_auth.is_operator(w,t.account_id),false)
 then raise exception 'HDA private review denied' using errcode='HDJ01';end if;
 select array_agg(id) into ids from (select id from helpdesk_integration.hda02_operations
 where workspace_id=w and account_id=t.account_id and binding_id=b.id and ticket_id=t.id order by id limit 2) x;
 if coalesce(cardinality(ids),0)=0 then return null;end if;
 if cardinality(ids)<>1 then raise exception 'Ambiguous HDA operation' using errcode='HDJ05';end if;op:=ids[1];
 return jsonb_build_object('workspaceId',w,'accountId',t.account_id,'ticketId',t.id,'bindingId',b.id,'operationId',op);
end $$;
revoke all on function helpdesk_auth.hda06_review_target(uuid,boolean) from public;
grant execute on function helpdesk_auth.hda06_review_target(uuid,boolean) to helpdesk_app;
do $acl$
declare p record;
begin
 select proowner,proacl into strict p from pg_proc where oid='helpdesk_auth.hda06_review_target(uuid,boolean)'::regprocedure;
 if exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x
 where x.grantee<>p.proowner and not(x.grantee='helpdesk_app'::regrole and x.privilege_type='EXECUTE' and not x.is_grantable))
 then raise exception 'Unexpected HDA read grant' using errcode='HDJ05';end if;
end $acl$;
commit;
