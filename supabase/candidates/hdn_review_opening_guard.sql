-- A new triage opening requires a private same-transaction proof produced only
-- after hdni_create independently reconstructs the complete expected bundle.
CREATE TABLE helpdesk_audit.hdnr_openings(
 workspace_id uuid NOT NULL,account_id uuid NOT NULL,ticket_id uuid NOT NULL,actor_id uuid NOT NULL REFERENCES helpdesk_auth.principals(id),
 profile_version_id text NOT NULL,ticket_hash text NOT NULL CHECK(ticket_hash~'^[a-f0-9]{64}$'),profile_hash text NOT NULL CHECK(profile_hash~'^[a-f0-9]{64}$'),snapshot_hash text NOT NULL CHECK(snapshot_hash~'^[a-f0-9]{64}$'),
 transaction_id xid8 NOT NULL DEFAULT pg_current_xact_id(),PRIMARY KEY(workspace_id,account_id,ticket_id),
 FOREIGN KEY(workspace_id,account_id,profile_version_id) REFERENCES helpdesk_core.hdnr_profiles(workspace_id,account_id,profile_version_id),
 FOREIGN KEY(workspace_id,account_id,ticket_id) REFERENCES helpdesk_core.tickets(workspace_id,account_id,id) DEFERRABLE INITIALLY DEFERRED);
ALTER TABLE helpdesk_audit.hdnr_openings ENABLE ROW LEVEL SECURITY;
ALTER TABLE helpdesk_audit.hdnr_openings FORCE ROW LEVEL SECURITY;
CREATE TRIGGER hdnr_opening_immutable BEFORE UPDATE OR DELETE ON helpdesk_audit.hdnr_openings FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdn_notification_immutable();
CREATE FUNCTION helpdesk_auth.hdnr_pending_opening_allowed(w uuid,a uuid,target uuid,person uuid) RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(session_user='helpdesk_app' AND person=helpdesk_auth.actor_id() AND w=helpdesk_auth.workspace_id() AND helpdesk_auth.is_human()
  AND EXISTS(SELECT 1 FROM helpdesk_audit.hdnr_openings o JOIN helpdesk_core.hdnr_profiles p ON(p.workspace_id,p.account_id,p.profile_version_id)=(o.workspace_id,o.account_id,o.profile_version_id)
   WHERE (o.workspace_id,o.account_id,o.ticket_id,o.actor_id,o.transaction_id)=(w,a,target,person,pg_current_xact_id()) AND person=ANY(p.required_for)),false)
$$;
CREATE FUNCTION helpdesk_auth.hdnr_opening_complete() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r helpdesk_audit.hdni_receipts%rowtype;s jsonb;BEGIN
 SELECT * INTO STRICT r FROM helpdesk_audit.hdni_receipts WHERE(workspace_id,account_id,ticket_id,actor_id,transaction_id)=(NEW.workspace_id,NEW.account_id,NEW.ticket_id,NEW.actor_id,NEW.transaction_id);
 SELECT document INTO STRICT s FROM helpdesk_core.hdni_snapshots WHERE(workspace_id,account_id,ticket_id)=(NEW.workspace_id,NEW.account_id,NEW.ticket_id);
 IF r.snapshot_hash<>NEW.snapshot_hash OR helpdesk_auth.hdni_digest(s)<>NEW.snapshot_hash OR helpdesk_auth.hdni_digest(s->'bundle'->'ticket')<>NEW.ticket_hash
  OR helpdesk_auth.hdni_digest(s->'profile')<>NEW.profile_hash OR s->'profile'->'approvalRequired' IS DISTINCT FROM 'true'::jsonb
  OR s->'profile'->>'initialState'<>'triage' OR s->'profile'->>'profileVersionId'<>NEW.profile_version_id OR s->'bundle'->'workflow'->>'approval'<>'pending'
  OR s->'bundle'->'ticket'->>'status'<>'triage' OR s->'receipt' IS DISTINCT FROM r.result OR r.transaction_id<>pg_current_xact_id()
 THEN RAISE EXCEPTION 'Incomplete qualified pending opening' USING ERRCODE='23514';END IF;
 RETURN NULL;
EXCEPTION WHEN no_data_found THEN RAISE EXCEPTION 'Pending opening receipt required' USING ERRCODE='23514';END$$;
CREATE CONSTRAINT TRIGGER hdnr_opening_complete AFTER INSERT ON helpdesk_audit.hdnr_openings DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdnr_opening_complete();
DO $private$ DECLARE role_name text;BEGIN
 REVOKE ALL ON TABLE helpdesk_audit.hdnr_openings FROM PUBLIC;
 REVOKE ALL ON FUNCTION helpdesk_auth.hdnr_pending_opening_allowed(uuid,uuid,uuid,uuid),helpdesk_auth.hdnr_opening_complete() FROM PUBLIC;
 FOREACH role_name IN ARRAY ARRAY['helpdesk_app','helpdesk_notification_worker','helpdesk_resource_publisher','helpdesk_maintenance','anon','authenticated','service_role'] LOOP
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL ON TABLE helpdesk_audit.hdnr_openings FROM %I',role_name);
   EXECUTE format('REVOKE ALL ON FUNCTION helpdesk_auth.hdnr_pending_opening_allowed(uuid,uuid,uuid,uuid),helpdesk_auth.hdnr_opening_complete() FROM %I',role_name);
  END IF;
 END LOOP;
END $private$;

create or replace function helpdesk_audit.record_ticket_effect() returns trigger
language plpgsql security definer set search_path='' as $$
declare k text; d jsonb; matched uuid; changes integer;
begin
 if new.workspace_id is distinct from helpdesk_auth.workspace_id() or helpdesk_auth.actor_id() is null then
  raise exception 'Ticket write requires authenticated transaction context' using errcode='23514';
 end if;
 if tg_op='INSERT' then
  if new.created_by is distinct from helpdesk_auth.actor_id() or new.version<>1 or (new.status<>'new' AND NOT (new.status='triage' AND helpdesk_auth.hdnr_pending_opening_allowed(new.workspace_id,new.account_id,new.id,new.created_by))) or new.assigned_to is not null then
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
