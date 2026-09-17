-- v0.18: note-only callers must not require the ticket UPDATE RLS policy.
-- Replace only the existing private trigger function. No policy or privilege expansion.
-- Run as the same approved migration owner as the preceding migrations.
begin;
create or replace function helpdesk_audit.record_conversation_effect() returns trigger
language plpgsql security definer set search_path='' as $$
declare t helpdesk_core.tickets%rowtype;k text;v integer;d jsonb;
begin
 if new.workspace_id is distinct from helpdesk_auth.workspace_id() or new.actor_id is distinct from helpdesk_auth.actor_id() then
  raise exception 'Conversation actor mismatch' using errcode='23514';end if;
 -- Serializes direct writers too, without conflicting with FK KEY SHARE locks.
 -- The private trigger, not the caller, acquires this lock; note writers need no ticket UPDATE.
 select * into t from helpdesk_core.tickets
  where (workspace_id,account_id,id)=(new.workspace_id,new.account_id,new.ticket_id) for no key update;
 if not found then raise exception 'Missing conversation parent' using errcode='23503';end if;
 if tg_table_name='ticket_messages' then
  k:='message.created';v:=t.version+1;d:=jsonb_build_object('messageId',new.id,'actorType',new.actor_type);
 else
  k:='note.created';v:=t.version;d:=jsonb_build_object('noteId',new.id);
 end if;
 insert into helpdesk_audit.write_effects(workspace_id,account_id,ticket_id,actor_id,kind,ticket_version,source_id,expected_data,applied)
  values(new.workspace_id,new.account_id,new.ticket_id,new.actor_id,k,v,new.id,d,k='note.created');
 return null;
end$$;
-- CREATE OR REPLACE keeps the existing owner and ACL. Revoke public/runtime execution
-- defensively as in migration 010; the function is callable only through its triggers.
revoke all on function helpdesk_audit.record_conversation_effect() from public,helpdesk_app;
create or replace function helpdesk_auth.schema_version() returns text
language sql immutable set search_path='' as $$select '0.18.0'::text$$;
commit;
