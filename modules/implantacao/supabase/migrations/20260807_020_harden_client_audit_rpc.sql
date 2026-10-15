-- =====================================================================
-- 20260807_020_harden_client_audit_rpc.sql · v5.22.45
-- Endurece a trilha append-only escrita pelo navegador.
--
-- O cliente continua enviando actor/action/entity para fins de contexto, mas:
--   - action precisa pertencer ao namespace público `setup.*`;
--   - entity fica limitada às entidades realmente emitidas pelo frontend;
--   - source é fixada em `frontend` pelo banco;
--   - timestamp é sempre `now()` do banco (p_timestamp é mantido apenas para
--     compatibilidade de assinatura e deliberadamente ignorado).
--
-- Rollback: reaplicar a definição de `record_audit_by_token` da migration 018.
-- =====================================================================

begin;

create or replace function public.record_audit_by_token(
    p_token uuid,
    p_draft_id uuid,
    p_submission_id uuid,
    p_actor text,
    p_action text,
    p_entity text,
    p_before jsonb,
    p_after jsonb,
    p_source text,
    p_timestamp timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
    v_row public.setup_audit_events%rowtype;
    v_actor text;
begin
    if not exists (
        select 1
          from public.setup_drafts d
         where d.id = p_draft_id and d.access_token = p_token
    ) then
        raise exception using errcode = '42501', message = 'draft_token_invalid';
    end if;

    if p_submission_id is not null and not exists (
        select 1
          from public.setup_submissions s
         where s.id = p_submission_id and s.draft_id = p_draft_id
    ) then
        raise exception using errcode = '42501', message = 'submission_not_owned_by_draft';
    end if;

    v_actor := coalesce(nullif(trim(p_actor), ''), 'cliente');
    if length(v_actor) > 254 then
        raise exception using errcode = '22023', message = 'invalid_audit_actor';
    end if;
    if p_action is null
       or length(p_action) > 160
       or p_action !~ '^setup\.[a-z0-9._-]+$' then
        raise exception using errcode = '22023', message = 'invalid_audit_action';
    end if;
    if p_entity not in (
        'SetupDraft', 'SetupSubmission', 'TechnicalJson', 'GeoControlePayload'
    ) then
        raise exception using errcode = '22023', message = 'invalid_audit_entity';
    end if;
    if octet_length(coalesce(p_before, '{}'::jsonb)::text) > 1048576
       or octet_length(coalesce(p_after, '{}'::jsonb)::text) > 1048576 then
        raise exception using errcode = '22001', message = 'audit_payload_too_large';
    end if;

    insert into public.setup_audit_events(
        draft_id, submission_id, timestamp, actor, action, entity,
        before, after, source
    ) values (
        p_draft_id,
        p_submission_id,
        now(),
        v_actor,
        p_action,
        p_entity,
        p_before,
        p_after,
        'frontend'
    )
    returning * into v_row;

    return to_jsonb(v_row);
end;
$$;

revoke all on function public.record_audit_by_token(
    uuid, uuid, uuid, text, text, text, jsonb, jsonb, text, timestamptz
) from public;
grant execute on function public.record_audit_by_token(
    uuid, uuid, uuid, text, text, text, jsonb, jsonb, text, timestamptz
) to anon, authenticated;

comment on function public.record_audit_by_token(
    uuid, uuid, uuid, text, text, text, jsonb, jsonb, text, timestamptz
) is
    'V8: append-only por token; timestamp/source definidos pelo banco; action/entity limitadas ao frontend público.';

commit;
