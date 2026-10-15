-- =====================================================================
-- v5.22.9 — Migration 010: edição do technical_json pela equipe Consulte GEO
--
-- A equipe (acessando via /r/<review_token>) ganha capacidade de editar
-- TODOS os campos das etapas 1-7 do wizard (Dados básicos, Tipo de estrutura,
-- Blocos e torres, Concretos, Pavimentos e peças, Usuários da obra, Fornecedores).
--
-- Mudanças nesta migration:
--   1. Coluna `customer_input_original` em setup_submissions — snapshot
--      do que o cliente enviou ANTES da primeira edição da equipe.
--      Preserva o "customerInput original" (constituição do projeto).
--   2. Coluna `team_edits_count` para mostrar "Este chamado teve N edições".
--   3. RPC `update_technical_json_by_review_token` — análoga à RPC do
--      cliente mas usando o `access_token` do `setup_tickets` (revisão da equipe).
--   4. Audit log automático: cada save da equipe registra um evento.
--
-- Não-bloqueante para uso atual: clientes legacy (status=enviado/em_validacao)
-- continuam funcionando sem a coluna nova; ela só é preenchida na primeira
-- edição da equipe.
-- =====================================================================

-- 1. Colunas novas
alter table public.setup_submissions
    add column if not exists customer_input_original jsonb,
    add column if not exists team_edits_count        integer not null default 0,
    add column if not exists last_team_edit_at       timestamptz;

comment on column public.setup_submissions.customer_input_original is
  'Snapshot do customerInput original do cliente, capturado antes da primeira edição da equipe. Preserva o estado original mesmo após edições da equipe Consulte GEO.';
comment on column public.setup_submissions.team_edits_count is
  'Quantas vezes a equipe Consulte GEO editou o technical_json desta submission.';
comment on column public.setup_submissions.last_team_edit_at is
  'Timestamp da última edição feita pela equipe (UTC).';

-- 2. RPC: atualizar technical_json via review_token
create or replace function public.update_technical_json_by_review_token(
    p_token uuid,
    p_json  jsonb,
    p_actor text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_ticket public.setup_tickets%rowtype;
    v_subm   public.setup_submissions%rowtype;
    v_first_edit boolean;
begin
    -- Token check
    select * into v_ticket
        from public.setup_tickets
        where access_token = p_token
        limit 1;

    if v_ticket.id is null then
        raise exception 'invalid_token';
    end if;
    if v_ticket.expires_at is not null and v_ticket.expires_at <= now() then
        raise exception 'token_expired';
    end if;

    select * into v_subm
        from public.setup_submissions
        where id = v_ticket.submission_id
        limit 1;
    if v_subm.id is null then
        raise exception 'submission_not_found';
    end if;

    -- Status check: equipe só pode editar enquanto em_validacao
    if v_subm.status not in ('enviado', 'em_validacao', 'devolvido') then
        raise exception 'status_not_editable_by_team';
    end if;

    -- Primeira edição? Salva snapshot do customerInput original.
    v_first_edit := v_subm.customer_input_original is null;

    if v_first_edit then
        update public.setup_submissions
            set customer_input_original = v_subm.technical_json -> 'customerInput',
                team_edits_count        = 1,
                last_team_edit_at       = now(),
                technical_json          = p_json,
                updated_at              = now()
            where id = v_subm.id;
    else
        update public.setup_submissions
            set team_edits_count  = team_edits_count + 1,
                last_team_edit_at = now(),
                technical_json    = p_json,
                updated_at        = now()
            where id = v_subm.id;
    end if;

    -- Audit
    insert into public.setup_audit_events
        (submission_id, actor, actor_role, action, details_json)
    values
        (v_subm.id,
         coalesce(p_actor, 'team_review'),
         'equipe',
         case when v_first_edit then 'team_edit_first' else 'team_edit' end,
         jsonb_build_object('edits_count', case when v_first_edit then 1 else v_subm.team_edits_count + 1 end));

    return jsonb_build_object(
        'submission_id',       v_subm.id,
        'team_edits_count',    case when v_first_edit then 1 else v_subm.team_edits_count + 1 end,
        'first_edit',          v_first_edit
    );
end;
$$;

revoke all on function public.update_technical_json_by_review_token(uuid, jsonb, text) from public;
grant execute on function public.update_technical_json_by_review_token(uuid, jsonb, text) to anon, authenticated;

comment on function public.update_technical_json_by_review_token is
  'v5.22.9: equipe Consulte GEO (autenticada pelo review_token de setup_tickets) atualiza o technical_json da submission. Preserva customer_input_original na primeira edição. Audit log automático.';

-- 3. Ampliar get_review_payload_by_token para incluir team_edits_count + customer_input_original
-- (para o frontend mostrar "Este chamado teve N edições da equipe" e oferecer "ver original")

create or replace function public.get_review_payload_by_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_ticket public.setup_tickets%rowtype;
    v_subm   public.setup_submissions%rowtype;
    v_comments jsonb;
    v_audit jsonb;
begin
    select * into v_ticket
        from public.setup_tickets
        where access_token = p_token
        limit 1;
    if v_ticket.id is null then
        raise exception 'invalid_token';
    end if;
    if v_ticket.expires_at is not null and v_ticket.expires_at <= now() then
        raise exception 'token_expired';
    end if;

    select * into v_subm
        from public.setup_submissions
        where id = v_ticket.submission_id
        limit 1;
    if v_subm.id is null then
        raise exception 'submission_not_found';
    end if;

    -- Comments — equipe vê todos (inclusive internal_only)
    select coalesce(jsonb_agg(jsonb_build_object(
        'id',            c.id,
        'author',        c.author,
        'author_role',   c.author_role,
        'body',          c.body,
        'internal_only', c.internal_only,
        'created_at',    c.created_at
    ) order by c.created_at), '[]'::jsonb)
    into v_comments
    from public.setup_review_comments c
    where c.submission_id = v_subm.id;

    -- Audit
    select coalesce(jsonb_agg(jsonb_build_object(
        'id',         a.id,
        'actor',      a.actor,
        'actor_role', a.actor_role,
        'action',     a.action,
        'details',    a.details_json,
        'created_at', a.created_at
    ) order by a.created_at desc), '[]'::jsonb)
    into v_audit
    from public.setup_audit_events a
    where a.submission_id = v_subm.id
    limit 50;

    return jsonb_build_object(
        'ticket', jsonb_build_object(
            'id',                v_ticket.id,
            'ticket_number',     v_ticket.ticket_number,
            'created_at',        v_ticket.created_at,
            'client_message',    v_ticket.client_message,
            'expires_at',        v_ticket.expires_at
        ),
        'submission', jsonb_build_object(
            'id',                       v_subm.id,
            'status',                   v_subm.status,
            'obra_codigo',              v_subm.obra_codigo,
            'obra_nome',                v_subm.obra_nome,
            'obra_endereco',            v_subm.obra_endereco,
            'responsavel_nome',         v_subm.responsavel_nome,
            'responsavel_email',        v_subm.responsavel_email,
            'submitted_at',             v_subm.submitted_at,
            'reviewed_at',              v_subm.reviewed_at,
            'resubmitted_at',           v_subm.resubmitted_at,
            'count_estruturas',         v_subm.count_estruturas,
            'count_pecas',              v_subm.count_pecas,
            'count_concretos',          v_subm.count_concretos,
            'technical_json',           v_subm.technical_json,
            -- v5.22.9: edição pela equipe
            'team_edits_count',         coalesce(v_subm.team_edits_count, 0),
            'last_team_edit_at',        v_subm.last_team_edit_at,
            'customer_input_original',  v_subm.customer_input_original
        ),
        'comments', v_comments,
        'audit',    v_audit
    );
end;
$$;

revoke all on function public.get_review_payload_by_token(uuid) from public;
grant execute on function public.get_review_payload_by_token(uuid) to anon, authenticated;
