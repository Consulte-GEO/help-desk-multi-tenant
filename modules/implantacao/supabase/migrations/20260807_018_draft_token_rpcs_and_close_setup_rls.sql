-- =====================================================================
-- 20260807_018_draft_token_rpcs_and_close_setup_rls.sql · v5.22.45
-- Fase 3/3 do fechamento RLS V8.
--
-- Acesso do navegador passa exclusivamente por RPCs security definer com
-- token opaco de posse do rascunho. O token nunca é devolvido pelas RPCs;
-- o cliente o gera e guarda no localStorage do próprio navegador.
--
-- Rollback da fase 3 (somente em emergência, após reverter o frontend):
--   drop policy if exists setup_drafts_anon_block on public.setup_drafts;
--   drop policy if exists setup_exports_anon_block on public.setup_exports;
--   drop policy if exists setup_audit_events_anon_block on public.setup_audit_events;
--   create policy setup_drafts_anon_rw on public.setup_drafts
--     for all to anon using (true) with check (true);
--   create policy setup_exports_anon_rw on public.setup_exports
--     for all to anon using (true) with check (true);
--   create policy setup_audit_events_anon_rw on public.setup_audit_events
--     for all to anon using (true) with check (true);
--   grant all on table public.setup_drafts, public.setup_exports,
--     public.setup_audit_events to anon, authenticated;
-- O rollback deliberadamente NÃO remove access_token nem as RPCs, evitando
-- perda de dados; elas podem ser removidas em migration posterior.
-- =====================================================================

begin;

create extension if not exists "pgcrypto";

alter table public.setup_drafts
    add column if not exists access_token uuid;

update public.setup_drafts
set access_token = gen_random_uuid()
where access_token is null;

alter table public.setup_drafts
    alter column access_token set default gen_random_uuid(),
    alter column access_token set not null;

create unique index if not exists ux_setup_drafts_access_token
    on public.setup_drafts(access_token);

comment on column public.setup_drafts.access_token is
    'Token opaco de posse do rascunho. Nunca é exposto em SELECT direto ou no payload de retorno das RPCs.';

-- ---------------------------------------------------------------------
-- RPCs de rascunho
-- ---------------------------------------------------------------------

create or replace function public.get_draft_by_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
    v_result jsonb;
begin
    if p_token is null then
        return null;
    end if;

    select to_jsonb(d) - 'access_token'
      into v_result
      from public.setup_drafts d
     where d.access_token = p_token
     limit 1;

    return v_result;
end;
$$;

create or replace function public.list_drafts_by_tokens(p_tokens uuid[])
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
    v_result jsonb;
begin
    if p_tokens is null or cardinality(p_tokens) = 0 then
        return '[]'::jsonb;
    end if;
    if cardinality(p_tokens) > 100 then
        raise exception using errcode = '22023', message = 'too_many_draft_tokens';
    end if;

    select coalesce(
        jsonb_agg((to_jsonb(d) - 'access_token') order by d.updated_at desc),
        '[]'::jsonb
    )
      into v_result
      from public.setup_drafts d
     where d.access_token = any(p_tokens);

    return v_result;
end;
$$;

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
    if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' then
        raise exception using errcode = '22023', message = 'snapshot_object_required';
    end if;
    if octet_length(p_snapshot::text) > 2000000 then
        raise exception using errcode = '22001', message = 'snapshot_too_large';
    end if;
    if p_technical_json is not null and octet_length(p_technical_json::text) > 2000000 then
        raise exception using errcode = '22001', message = 'technical_json_too_large';
    end if;

    if p_draft_id is null then
        insert into public.setup_drafts(
            access_token, status, obra_codigo, obra_nome, snapshot, technical_json
        ) values (
            p_token,
            'rascunho'::public.setup_draft_status,
            left(coalesce(p_obra_codigo, ''), 240),
            left(coalesce(p_obra_nome, ''), 500),
            p_snapshot,
            p_technical_json
        )
        returning * into v_row;
    else
        update public.setup_drafts d
           set status = 'rascunho'::public.setup_draft_status,
               obra_codigo = left(coalesce(p_obra_codigo, ''), 240),
               obra_nome = left(coalesce(p_obra_nome, ''), 500),
               snapshot = p_snapshot,
               technical_json = p_technical_json
         where d.id = p_draft_id
           and d.access_token = p_token
        returning d.* into v_row;

        if not found then
            raise exception using errcode = '42501', message = 'draft_token_invalid';
        end if;
    end if;

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
    update public.setup_drafts d
       set status = 'cancelado'::public.setup_draft_status
     where d.id = p_draft_id
       and d.access_token = p_token
    returning d.* into v_row;

    if not found then
        raise exception using errcode = '42501', message = 'draft_token_invalid';
    end if;

    return to_jsonb(v_row) - 'access_token';
end;
$$;

-- ---------------------------------------------------------------------
-- RPCs de exportação por token do rascunho
-- ---------------------------------------------------------------------

create or replace function public.record_export_by_token(
    p_token uuid,
    p_draft_id uuid,
    p_submission_id uuid,
    p_kind text,
    p_filename text,
    p_size_bytes bigint,
    p_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
    v_row public.setup_exports%rowtype;
    v_kind public.setup_export_kind;
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

    if p_kind is null or p_kind not in ('json', 'excel') then
        raise exception using errcode = '22023', message = 'invalid_export_kind';
    end if;
    if p_size_bytes is not null and (p_size_bytes < 0 or p_size_bytes > 1073741824) then
        raise exception using errcode = '22023', message = 'invalid_export_size';
    end if;
    v_kind := p_kind::public.setup_export_kind;

    insert into public.setup_exports(
        draft_id, submission_id, kind, filename, size_bytes, hash
    ) values (
        p_draft_id,
        p_submission_id,
        v_kind,
        left(coalesce(nullif(trim(p_filename), ''), 'arquivo'), 500),
        p_size_bytes,
        nullif(left(coalesce(p_hash, ''), 256), '')
    )
    returning * into v_row;

    return to_jsonb(v_row);
end;
$$;

create or replace function public.list_exports_by_token(
    p_token uuid,
    p_draft_id uuid,
    p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
    v_result jsonb;
begin
    if not exists (
        select 1
          from public.setup_drafts d
         where d.id = p_draft_id and d.access_token = p_token
    ) then
        raise exception using errcode = '42501', message = 'draft_token_invalid';
    end if;

    select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
      into v_result
      from (
        select e.*
          from public.setup_exports e
         where e.draft_id = p_draft_id
         order by e.created_at desc
         limit greatest(1, least(coalesce(p_limit, 100), 200))
      ) x;

    return v_result;
end;
$$;

-- ---------------------------------------------------------------------
-- RPCs de auditoria por token do rascunho
-- ---------------------------------------------------------------------

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

    if length(trim(coalesce(p_actor, ''))) not between 1 and 254
       or length(trim(coalesce(p_action, ''))) not between 1 and 160
       or length(trim(coalesce(p_entity, ''))) not between 1 and 160 then
        raise exception using errcode = '22023', message = 'invalid_audit_metadata';
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
        -- Integridade temporal: o cliente não escolhe a posição do evento
        -- no histórico. p_timestamp é mantido na assinatura por compatibilidade.
        now(),
        left(trim(p_actor), 254),
        left(trim(p_action), 160),
        left(trim(p_entity), 160),
        p_before,
        p_after,
        left(coalesce(nullif(trim(p_source), ''), 'frontend'), 80)
    )
    returning * into v_row;

    return to_jsonb(v_row);
end;
$$;

create or replace function public.list_audit_by_token(
    p_token uuid,
    p_draft_id uuid,
    p_limit integer default 200
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
    v_result jsonb;
begin
    if not exists (
        select 1
          from public.setup_drafts d
         where d.id = p_draft_id and d.access_token = p_token
    ) then
        raise exception using errcode = '42501', message = 'draft_token_invalid';
    end if;

    select coalesce(jsonb_agg(to_jsonb(x) order by x.timestamp desc), '[]'::jsonb)
      into v_result
      from (
        select a.*
          from public.setup_audit_events a
         where a.draft_id = p_draft_id
         order by a.timestamp desc
         limit greatest(1, least(coalesce(p_limit, 200), 500))
      ) x;

    return v_result;
end;
$$;

-- Funções não herdam EXECUTE público. Somente os papéis da aplicação.
revoke all on function public.get_draft_by_token(uuid) from public;
revoke all on function public.list_drafts_by_tokens(uuid[]) from public;
revoke all on function public.upsert_draft_by_token(uuid, uuid, text, text, jsonb, jsonb) from public;
revoke all on function public.cancel_draft_by_token(uuid, uuid) from public;
revoke all on function public.record_export_by_token(uuid, uuid, uuid, text, text, bigint, text) from public;
revoke all on function public.list_exports_by_token(uuid, uuid, integer) from public;
revoke all on function public.record_audit_by_token(uuid, uuid, uuid, text, text, text, jsonb, jsonb, text, timestamptz) from public;
revoke all on function public.list_audit_by_token(uuid, uuid, integer) from public;

grant execute on function public.get_draft_by_token(uuid) to anon, authenticated;
grant execute on function public.list_drafts_by_tokens(uuid[]) to anon, authenticated;
grant execute on function public.upsert_draft_by_token(uuid, uuid, text, text, jsonb, jsonb) to anon, authenticated;
grant execute on function public.cancel_draft_by_token(uuid, uuid) to anon, authenticated;
grant execute on function public.record_export_by_token(uuid, uuid, uuid, text, text, bigint, text) to anon, authenticated;
grant execute on function public.list_exports_by_token(uuid, uuid, integer) to anon, authenticated;
grant execute on function public.record_audit_by_token(uuid, uuid, uuid, text, text, text, jsonb, jsonb, text, timestamptz) to anon, authenticated;
grant execute on function public.list_audit_by_token(uuid, uuid, integer) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Estado RLS final
-- ---------------------------------------------------------------------

alter table public.setup_drafts enable row level security;
alter table public.setup_exports enable row level security;
alter table public.setup_audit_events enable row level security;

drop policy if exists setup_drafts_anon_rw on public.setup_drafts;
drop policy if exists setup_drafts_anon_block on public.setup_drafts;
create policy setup_drafts_anon_block
    on public.setup_drafts for all to anon using (false) with check (false);

drop policy if exists setup_drafts_admin_select on public.setup_drafts;
create policy setup_drafts_admin_select
    on public.setup_drafts for select to authenticated using (public.is_admin());

drop policy if exists setup_exports_anon_rw on public.setup_exports;
drop policy if exists setup_exports_anon_block on public.setup_exports;
create policy setup_exports_anon_block
    on public.setup_exports for all to anon using (false) with check (false);

drop policy if exists setup_exports_admin_select on public.setup_exports;
create policy setup_exports_admin_select
    on public.setup_exports for select to authenticated using (public.is_admin());

drop policy if exists setup_audit_events_anon_rw on public.setup_audit_events;
drop policy if exists setup_audit_events_anon_insert on public.setup_audit_events;
drop policy if exists setup_audit_events_anon_block on public.setup_audit_events;
create policy setup_audit_events_anon_block
    on public.setup_audit_events for all to anon using (false) with check (false);

revoke all on table public.setup_drafts from public, anon, authenticated;
revoke all on table public.setup_exports from public, anon, authenticated;
revoke all on table public.setup_audit_events from public, anon, authenticated;

grant select on table public.setup_drafts to authenticated;
grant select on table public.setup_exports to authenticated;
grant select, insert on table public.setup_audit_events to authenticated;

comment on table public.setup_drafts is
    'Rascunhos do Cadastro Simplificado. V8: acesso do cliente exclusivamente por RPC security definer + access_token; admin somente leitura por is_admin().';
comment on table public.setup_exports is
    'Log de exportações. V8: cliente registra/lista apenas por RPC vinculada ao token do rascunho; admin somente leitura.';
comment on table public.setup_audit_events is
    'Audit trail imutável. V8: cliente grava/lê somente por RPC vinculada ao token do rascunho; admin SELECT/INSERT; sem UPDATE/DELETE.';

commit;
