-- =====================================================================
-- 20260807_022_harden_draft_write_rpcs.sql · v5.22.45
-- Fechamento incremental das RPCs de escrita de rascunho do ciclo V8.
--
-- Objetivos:
--   1. tornar o primeiro save idempotente com UUID gerado no navegador;
--   2. impedir edição de rascunho bloqueado ou fora de estado editável;
--   3. tornar o cancelamento soft idempotente e bloqueá-lo após envio.
--
-- A assinatura pública das RPCs é preservada. O frontend mantém fallback
-- transitório para a definição da migration 018 enquanto esta migration não
-- estiver aplicada.
--
-- Rollback: reaplicar as definições de `upsert_draft_by_token` e
-- `cancel_draft_by_token` da migration 018.
-- =====================================================================

begin;

create or replace function public.upsert_draft_by_token(
    p_token uuid,
    p_draft_id uuid,
    p_obra_codigo text,
    p_obra_nome text,
    p_snapshot jsonb,
    p_technical_json jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
    v_row public.setup_drafts%rowtype;
begin
    if p_token is null then
        raise exception using errcode = '22023', message = 'draft_token_required';
    end if;
    if p_draft_id is null then
        raise exception using errcode = '22023', message = 'draft_id_required';
    end if;
    if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' then
        raise exception using errcode = '22023', message = 'snapshot_object_required';
    end if;
    if octet_length(p_snapshot::text) > 2000000 then
        raise exception using errcode = '22001', message = 'snapshot_too_large';
    end if;
    if p_technical_json is not null and octet_length(p_technical_json::text) > 2000000 then
        raise exception using errcode = '22001', message = 'technical_json_too_large';
    end if;

    -- Um token é uma capability de um único rascunho. Evita rebind por
    -- cache corrompido ou request concorrente.
    if exists (
        select 1
          from public.setup_drafts d
         where d.access_token = p_token
           and d.id <> p_draft_id
    ) then
        raise exception using errcode = '42501', message = 'draft_token_invalid';
    end if;

    -- Primeiro save. ON CONFLICT sem alvo cobre tanto o PK quanto o índice
    -- único do token; a leitura abaixo distingue retry válido de conflito.
    insert into public.setup_drafts(
        id, access_token, status, obra_codigo, obra_nome, snapshot, technical_json
    ) values (
        p_draft_id,
        p_token,
        'rascunho'::public.setup_draft_status,
        left(coalesce(p_obra_codigo, ''), 240),
        left(coalesce(p_obra_nome, ''), 500),
        p_snapshot,
        p_technical_json
    )
    on conflict do nothing
    returning * into v_row;

    if found then
        return to_jsonb(v_row) - 'access_token';
    end if;

    -- Retry ou save subsequente: trava a linha e revalida posse/estado.
    select d.*
      into v_row
      from public.setup_drafts d
     where d.id = p_draft_id
     for update;

    if not found or v_row.access_token <> p_token then
        raise exception using errcode = '42501', message = 'draft_token_invalid';
    end if;
    if v_row.locked_at is not null then
        raise exception using errcode = '55000', message = 'draft_locked';
    end if;
    if v_row.status not in (
        'rascunho'::public.setup_draft_status,
        'devolvido'::public.setup_draft_status
    ) then
        raise exception using errcode = '55000', message = 'draft_not_editable';
    end if;

    update public.setup_drafts d
       set status = 'rascunho'::public.setup_draft_status,
           obra_codigo = left(coalesce(p_obra_codigo, ''), 240),
           obra_nome = left(coalesce(p_obra_nome, ''), 500),
           snapshot = p_snapshot,
           technical_json = p_technical_json
     where d.id = p_draft_id
       and d.access_token = p_token
    returning d.* into v_row;

    return to_jsonb(v_row) - 'access_token';
end;
$$;

create or replace function public.cancel_draft_by_token(
    p_token uuid,
    p_draft_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
    v_row public.setup_drafts%rowtype;
begin
    if p_token is null or p_draft_id is null then
        raise exception using errcode = '22023', message = 'draft_token_and_id_required';
    end if;

    select d.*
      into v_row
      from public.setup_drafts d
     where d.id = p_draft_id
       and d.access_token = p_token
     for update;

    if not found then
        raise exception using errcode = '42501', message = 'draft_token_invalid';
    end if;

    -- Retry de cancelamento é seguro e devolve a mesma representação.
    if v_row.status = 'cancelado'::public.setup_draft_status then
        return to_jsonb(v_row) - 'access_token';
    end if;
    if v_row.locked_at is not null
       or v_row.status not in (
           'rascunho'::public.setup_draft_status,
           'devolvido'::public.setup_draft_status
       ) then
        raise exception using errcode = '55000', message = 'draft_not_cancellable';
    end if;

    update public.setup_drafts d
       set status = 'cancelado'::public.setup_draft_status
     where d.id = p_draft_id
       and d.access_token = p_token
    returning d.* into v_row;

    return to_jsonb(v_row) - 'access_token';
end;
$$;

revoke all on function public.upsert_draft_by_token(
    uuid, uuid, text, text, jsonb, jsonb
) from public;
revoke all on function public.cancel_draft_by_token(uuid, uuid) from public;

grant execute on function public.upsert_draft_by_token(
    uuid, uuid, text, text, jsonb, jsonb
) to anon, authenticated;
grant execute on function public.cancel_draft_by_token(uuid, uuid) to anon, authenticated;

comment on function public.upsert_draft_by_token(
    uuid, uuid, text, text, jsonb, jsonb
) is
    'V8: upsert idempotente por id+token; bloqueia draft locked ou fora de rascunho/devolvido.';
comment on function public.cancel_draft_by_token(uuid, uuid) is
    'V8: cancelamento soft idempotente por id+token enquanto o draft estiver editável e não bloqueado.';

commit;
