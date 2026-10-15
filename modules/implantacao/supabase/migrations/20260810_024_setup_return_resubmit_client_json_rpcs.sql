-- =====================================================================
-- ⚠ JÁ APLICADA EM PRODUÇÃO — NÃO REAPLICAR ⚠
-- Aplicada em 10/08/2026 via MCP (apply_migration), registrada no
-- ledger como *_setup_return_resubmit_client_json_rpcs.
--
-- Paridade byte-fiel do que foi aplicado: conteúdo da
-- 20260519_009_setup_return_submission.sql (que nunca tinha sido
-- aplicada — PK gotcha #9/#10, backlog §1.2) + grants no padrão vivo
-- do hardening V8 (anon + authenticated + service_role).
-- Smoke executado na aplicação: fluxo completo devolução → edição →
-- reenvio como role anon, com rollback (SMOKE_OK).
-- =====================================================================

-- =====================================================================
-- Implantação Consulte GEO — protótipo Supabase
-- 20260519_009_setup_return_submission.sql · v5.22.6
--
-- Adiciona suporte para devolução de submissão pela equipe COM dispara
-- de email de notificação ao responsável. A devolução é uma operação
-- atômica que:
--   1. Muda status do submission para 'devolvido'
--   2. Insere comentário visível ao cliente (author_role='equipe',
--      internal_only=false)
--   3. Retorna o client_access_token + email_cc para que a Edge Function
--      `notify-return` dispare email
--
-- A Edge Function correspondente (notify-return) é separada — esta
-- migration só dá a base de banco. O frontend chama a RPC e depois,
-- com o token retornado, chama a Edge Function (que monta email).
-- =====================================================================

-- ---------------------------------------------------------------------
-- RPC: return_submission_with_comment(p_token, p_reviewer, p_body)
--
-- Gated por access_token (equipe). Retorna dados necessários para o
-- frontend disparar o email.
-- ---------------------------------------------------------------------
create or replace function public.return_submission_with_comment(
    p_token    uuid,
    p_reviewer text,
    p_body     text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_ticket   public.setup_tickets%rowtype;
    v_subm     public.setup_submissions%rowtype;
    v_comment  public.setup_review_comments%rowtype;
begin
    -- valida token da equipe
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

    -- valida body
    if p_body is null or length(trim(p_body)) < 20 then
        raise exception 'body_too_short: minimum 20 characters';
    end if;
    if length(p_body) > 2000 then
        raise exception 'body_too_long: maximum 2000 characters';
    end if;

    -- carrega submission
    select * into v_subm
        from public.setup_submissions
        where id = v_ticket.submission_id
        limit 1;

    if v_subm.id is null then
        raise exception 'submission_not_found';
    end if;

    -- não permite devolver algo já finalizado
    if v_subm.status in ('aprovado', 'implantado', 'cancelado') then
        raise exception 'submission_finalized: status=%', v_subm.status;
    end if;

    -- 1. muda status para 'devolvido'
    update public.setup_submissions
        set status      = 'devolvido',
            reviewed_at = now(),
            reviewer    = coalesce(nullif(trim(p_reviewer), ''), 'equipe'),
            review_note = p_body
        where id = v_subm.id;

    -- 2. insere comentário público (visível ao cliente)
    insert into public.setup_review_comments(
        submission_id, author, author_role, body, internal_only
    ) values (
        v_subm.id,
        coalesce(nullif(trim(p_reviewer), ''), 'Equipe Consulte GEO'),
        'equipe',
        p_body,
        false
    )
    returning * into v_comment;

    -- 3. unlock o draft (para que o cliente possa editar e reenviar)
    if v_subm.draft_id is not null then
        update public.setup_drafts
            set locked_at = null,
                locked_by_submission = null
            where id = v_subm.draft_id;
    end if;

    -- 4. audit log (best-effort)
    begin
        insert into public.setup_audit_events(
            submission_id, draft_id, actor, action, entity, source, after
        )
        values (
            v_subm.id,
            v_subm.draft_id,
            coalesce(nullif(trim(p_reviewer), ''), 'equipe'),
            'submission.returned',
            'setup_submissions',
            'rpc',
            jsonb_build_object(
                'comment_id', v_comment.id,
                'reason_length', length(p_body)
            )
        );
    exception when others then null;
    end;

    -- retorna info necessária para a Edge Function de email
    return jsonb_build_object(
        'submission_id',        v_subm.id,
        'ticket_number',        v_ticket.ticket_number,
        'client_access_token',  v_ticket.client_access_token,
        'email_cc',             v_ticket.email_cc,
        'obra_nome',            v_subm.obra_nome,
        'reviewer',             coalesce(nullif(trim(p_reviewer), ''), 'Equipe Consulte GEO'),
        'reason',               p_body,
        'comment_id',           v_comment.id
    );
end;
$$;

revoke all on function public.return_submission_with_comment(uuid, text, text) from public;
grant execute on function public.return_submission_with_comment(uuid, text, text) to anon;

comment on function public.return_submission_with_comment(uuid, text, text) is
  'v5.22.6: Devolve a submissão ao cliente. Muda status para devolvido, insere comentário público, desbloqueia o draft e retorna client_access_token + email_cc para a Edge Function disparar email de notificação ao responsável.';

-- ---------------------------------------------------------------------
-- RPC: resubmit_by_client_token(p_token)
--
-- Chamada pelo CLIENTE quando ele editou após devolução e quer reenviar.
-- Muda status de 'devolvido' para 'em_validacao' e relock o draft.
-- ---------------------------------------------------------------------
create or replace function public.resubmit_by_client_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_ticket   public.setup_tickets%rowtype;
    v_subm     public.setup_submissions%rowtype;
begin
    select * into v_ticket
        from public.setup_tickets
        where client_access_token = p_token
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

    -- só permite reenviar se está em 'devolvido'
    if v_subm.status <> 'devolvido' then
        raise exception 'invalid_status_for_resubmit: %', v_subm.status;
    end if;

    update public.setup_submissions
        set status         = 'em_validacao',
            resubmitted_at = now()
        where id = v_subm.id;

    -- relock do draft
    if v_subm.draft_id is not null then
        update public.setup_drafts
            set locked_at = now(),
                locked_by_submission = v_subm.id
            where id = v_subm.draft_id;
    end if;

    -- audit
    begin
        insert into public.setup_audit_events(
            submission_id, draft_id, actor, action, entity, source, after
        ) values (
            v_subm.id,
            v_subm.draft_id,
            'cliente',
            'submission.resubmitted',
            'setup_submissions',
            'rpc',
            jsonb_build_object('ticket_number', v_ticket.ticket_number)
        );
    exception when others then null;
    end;

    return jsonb_build_object(
        'ok',              true,
        'submission_id',   v_subm.id,
        'ticket_number',   v_ticket.ticket_number,
        'new_status',      'em_validacao'
    );
end;
$$;

revoke all on function public.resubmit_by_client_token(uuid) from public;
grant execute on function public.resubmit_by_client_token(uuid) to anon;

comment on function public.resubmit_by_client_token(uuid) is
  'v5.22.6: Cliente reenvia para validação após devolução. Só funciona se status = devolvido.';

-- ---------------------------------------------------------------------
-- Adiciona coluna resubmitted_at em setup_submissions (idempotente)
-- ---------------------------------------------------------------------
alter table public.setup_submissions
    add column if not exists resubmitted_at timestamptz;

comment on column public.setup_submissions.resubmitted_at is
  'v5.22.6: timestamp do reenvio do cliente após devolução. Null se nunca devolvido.';

-- ---------------------------------------------------------------------
-- update_technical_json_by_client_token(p_token, p_json)
--
-- Permite o cliente atualizar o technical_json da submissão devolvida
-- ANTES de reenviar. Só funciona se status = 'devolvido'.
-- ---------------------------------------------------------------------
create or replace function public.update_technical_json_by_client_token(
    p_token uuid,
    p_json  jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_ticket public.setup_tickets%rowtype;
    v_subm   public.setup_submissions%rowtype;
begin
    select * into v_ticket
        from public.setup_tickets
        where client_access_token = p_token
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
    if v_subm.status <> 'devolvido' then
        raise exception 'invalid_status_for_edit: %', v_subm.status;
    end if;

    update public.setup_submissions
        set technical_json = p_json
        where id = v_subm.id;

    begin
        insert into public.setup_audit_events(
            submission_id, draft_id, actor, action, entity, source
        ) values (
            v_subm.id,
            v_subm.draft_id,
            'cliente',
            'submission.edited_during_return',
            'setup_submissions',
            'rpc'
        );
    exception when others then null;
    end;

    return jsonb_build_object('ok', true, 'submission_id', v_subm.id);
end;
$$;

revoke all on function public.update_technical_json_by_client_token(uuid, jsonb) from public;
grant execute on function public.update_technical_json_by_client_token(uuid, jsonb) to anon;

comment on function public.update_technical_json_by_client_token(uuid, jsonb) is
  'v5.22.6: Cliente atualiza technical_json durante uma devolução. Só funciona se status=devolvido.';

-- ---------------------------------------------------------------------
-- Atualiza get_status_by_client_token para retornar o technical_json
-- COMPLETO quando status = 'devolvido' (para o cliente poder editar
-- via wizard). Nos demais status, mantém comportamento read-only sem
-- expor JSON completo.
-- ---------------------------------------------------------------------
create or replace function public.get_status_by_client_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_ticket   public.setup_tickets%rowtype;
    v_subm     public.setup_submissions%rowtype;
    v_comments jsonb;
    v_tj       jsonb;
    v_count_estruturas int;
    v_count_pecas      int;
    v_count_concretos  int;
    v_obra_endereco    text;
    v_responsavel_nome text;
    v_include_full_json boolean;
begin
    select * into v_ticket
        from public.setup_tickets
        where client_access_token = p_token
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

    select coalesce(jsonb_agg(
        jsonb_build_object(
            'id',          c.id,
            'author',      c.author,
            'author_role', c.author_role,
            'body',        c.body,
            'created_at',  c.created_at
        ) order by c.created_at
    ), '[]'::jsonb)
        into v_comments
        from public.setup_review_comments c
        where c.submission_id = v_subm.id
          and c.internal_only = false;

    v_tj := v_subm.technical_json;
    v_count_estruturas := coalesce(jsonb_array_length(v_tj #> '{technicalMapping,unidadeGrupos}'), 0);
    v_count_pecas      := coalesce(jsonb_array_length(v_tj #> '{technicalMapping,unidades}'), 0);
    v_count_concretos  := coalesce(jsonb_array_length(v_tj #> '{technicalMapping,concretos}'), 0);
    v_obra_endereco    := coalesce(v_tj #>> '{customerInput,dadosBasicos,obraEndereco}', '');
    v_responsavel_nome := coalesce(v_tj #>> '{metadata,createdBy,nome}', '');

    -- v5.22.6: cliente recebe o technical_json COMPLETO apenas durante devolução
    v_include_full_json := (v_subm.status = 'devolvido');

    return jsonb_build_object(
        'ticket', jsonb_build_object(
            'ticket_number',  v_ticket.ticket_number,
            'created_at',     v_ticket.created_at,
            'client_message', v_ticket.client_message
        ),
        'submission', jsonb_build_object(
            'status',          v_subm.status,
            'obra_codigo',     v_subm.obra_codigo,
            'obra_nome',       v_subm.obra_nome,
            'obra_endereco',   v_obra_endereco,
            'responsavel_nome',v_responsavel_nome,
            'submitted_at',    v_subm.submitted_at,
            'reviewed_at',     v_subm.reviewed_at,
            'resubmitted_at',  v_subm.resubmitted_at,
            'count_estruturas',v_count_estruturas,
            'count_pecas',     v_count_pecas,
            'count_concretos', v_count_concretos,
            'technical_json',  case when v_include_full_json then v_tj else null end,
            'editable',        v_include_full_json
        ),
        'comments', v_comments
    );
end;
$$;

comment on function public.get_status_by_client_token(uuid) is
  'v5.22.6: agora retorna technical_json + editable=true APENAS quando submission.status = devolvido. Demais status: read-only, sem JSON completo.';

-- ---------------------------------------------------------------------
-- Paridade de grants com o padrão vivo do hardening V8 (as RPCs por
-- token existentes têm EXECUTE para anon + authenticated + service_role).
-- ---------------------------------------------------------------------
grant execute on function public.return_submission_with_comment(uuid, text, text) to authenticated, service_role;
grant execute on function public.resubmit_by_client_token(uuid) to authenticated, service_role;
grant execute on function public.update_technical_json_by_client_token(uuid, jsonb) to authenticated, service_role;
