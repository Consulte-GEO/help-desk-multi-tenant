-- =====================================================================
-- Implantação Consulte GEO — protótipo Supabase
-- 20260518_008_setup_client_status.sql · v5.22
--
-- Status público read-only para o cliente. Adiciona:
--   - setup_tickets.client_access_token: token separado do access_token
--     da equipe. Vai no email enviado ao responsável (Etapa 1).
--   - setup_review_comments.internal_only: comentários marcados como
--     internal_only ficam invisíveis para o cliente.
--   - setup_review_comments.author_role: 'equipe' | 'cliente' — permite
--     distinguir visualmente quem comentou.
--
-- 3 RPCs novas, gated por client_access_token:
--   - get_status_by_client_token(token)
--   - list_review_comments_by_client_token(token)
--   - add_review_comment_by_client_token(token, author, body)
--
-- Importante: as RPCs do cliente NUNCA retornam o technical_json
-- completo (dado técnico bruto não interessa pro cliente) — apenas
-- contagens. E filtram comentários por internal_only=false.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. setup_tickets: nova coluna client_access_token
-- ---------------------------------------------------------------------
alter table public.setup_tickets
    add column if not exists client_access_token uuid;

-- Backfill: gera tokens para tickets existentes.
-- Cada ticket pré-existente ganha um client_access_token único.
update public.setup_tickets
    set client_access_token = gen_random_uuid()
    where client_access_token is null;

-- Agora torna NOT NULL + UNIQUE
alter table public.setup_tickets
    alter column client_access_token set not null;

alter table public.setup_tickets
    alter column client_access_token set default gen_random_uuid();

create unique index if not exists ix_setup_tickets_client_token
    on public.setup_tickets(client_access_token);

comment on column public.setup_tickets.client_access_token is
  'Token do cliente para a página de status read-only (/s/:token). Separado do access_token da equipe — reencaminhar o email do cliente NÃO concede acesso de equipe.';

-- ---------------------------------------------------------------------
-- 2. setup_review_comments: novas colunas
-- ---------------------------------------------------------------------
alter table public.setup_review_comments
    add column if not exists internal_only boolean not null default false;

alter table public.setup_review_comments
    add column if not exists author_role text not null default 'equipe'
    check (author_role in ('equipe', 'cliente'));

comment on column public.setup_review_comments.internal_only is
  'Quando true, o comentário NÃO aparece na página de status do cliente. Default false (visível ao cliente).';
comment on column public.setup_review_comments.author_role is
  'Quem criou o comentário: "equipe" (default) ou "cliente". Permite distinguir visualmente na thread.';

-- ---------------------------------------------------------------------
-- 3. RPC: get_status_by_client_token(token)
--    Versão "pública" do payload — sem technical_json completo,
--    sem internal_only=true, sem dados sensíveis da equipe.
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

    -- Comentários visíveis ao cliente (filtra internal_only)
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

    -- Contagens do technical_json (sem expor o JSON inteiro)
    v_tj := v_subm.technical_json;
    v_count_estruturas := coalesce(jsonb_array_length(v_tj #> '{technicalMapping,unidadeGrupos}'), 0);
    v_count_pecas      := coalesce(jsonb_array_length(v_tj #> '{technicalMapping,unidades}'), 0);
    v_count_concretos  := coalesce(jsonb_array_length(v_tj #> '{technicalMapping,concretos}'), 0);
    v_obra_endereco    := coalesce(v_tj #>> '{customerInput,dadosBasicos,obraEndereco}', '');
    v_responsavel_nome := coalesce(v_tj #>> '{metadata,createdBy,nome}', '');

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
            'count_estruturas',v_count_estruturas,
            'count_pecas',     v_count_pecas,
            'count_concretos', v_count_concretos
        ),
        'comments', v_comments
    );
end;
$$;

revoke all on function public.get_status_by_client_token(uuid) from public;
grant execute on function public.get_status_by_client_token(uuid) to anon;

comment on function public.get_status_by_client_token(uuid) is
  'Versão pública do payload de status para o cliente. NÃO retorna technical_json bruto, NÃO retorna comentários internal_only, NÃO retorna reviewer/review_note.';

-- ---------------------------------------------------------------------
-- 4. RPC: list_review_comments_by_client_token(token)
--    Mesma lógica de filtro do get_status (apenas comentários visíveis).
-- ---------------------------------------------------------------------
create or replace function public.list_review_comments_by_client_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_submission_id uuid;
    v_result jsonb;
begin
    select submission_id into v_submission_id
        from public.setup_tickets
        where client_access_token = p_token
        limit 1;

    if v_submission_id is null then
        raise exception 'invalid_token';
    end if;

    if exists (
        select 1 from public.setup_tickets
        where client_access_token = p_token
          and expires_at is not null
          and expires_at <= now()
    ) then
        raise exception 'token_expired';
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
        into v_result
        from public.setup_review_comments c
        where c.submission_id = v_submission_id
          and c.internal_only = false;

    return v_result;
end;
$$;

revoke all on function public.list_review_comments_by_client_token(uuid) from public;
grant execute on function public.list_review_comments_by_client_token(uuid) to anon;

comment on function public.list_review_comments_by_client_token(uuid) is
  'Lista comentários visíveis ao cliente (filtra internal_only=true) autenticado por client_access_token.';

-- ---------------------------------------------------------------------
-- 5. RPC: add_review_comment_by_client_token(token, author, body)
--    Cliente também pode comentar — mas SEMPRE com author_role='cliente'
--    e internal_only=false.
-- ---------------------------------------------------------------------
create or replace function public.add_review_comment_by_client_token(
    p_token  uuid,
    p_author text,
    p_body   text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_submission_id uuid;
    v_inserted public.setup_review_comments%rowtype;
begin
    select submission_id into v_submission_id
        from public.setup_tickets
        where client_access_token = p_token
        limit 1;

    if v_submission_id is null then
        raise exception 'invalid_token';
    end if;

    if exists (
        select 1 from public.setup_tickets
        where client_access_token = p_token
          and expires_at is not null
          and expires_at <= now()
    ) then
        raise exception 'token_expired';
    end if;

    if p_body is null or length(trim(p_body)) = 0 then
        raise exception 'empty_body';
    end if;
    if length(p_body) > 2000 then
        raise exception 'body_too_long';
    end if;

    insert into public.setup_review_comments(submission_id, author, author_role, body, internal_only)
    values (
        v_submission_id,
        coalesce(nullif(trim(p_author), ''), '(sem nome)'),
        'cliente',
        p_body,
        false
    )
    returning * into v_inserted;

    -- audit best-effort
    begin
        insert into public.setup_audit_events(submission_id, actor, action, entity, source, after)
        values (
            v_submission_id,
            coalesce(nullif(trim(p_author), ''), 'cliente_anon'),
            'review_comment.added_by_client',
            'setup_review_comments',
            'rpc',
            jsonb_build_object('comment_id', v_inserted.id, 'body_length', length(p_body))
        );
    exception when others then null;
    end;

    return jsonb_build_object(
        'id',          v_inserted.id,
        'author',      v_inserted.author,
        'author_role', v_inserted.author_role,
        'body',        v_inserted.body,
        'created_at',  v_inserted.created_at
    );
end;
$$;

revoke all on function public.add_review_comment_by_client_token(uuid, text, text) from public;
grant execute on function public.add_review_comment_by_client_token(uuid, text, text) to anon;

comment on function public.add_review_comment_by_client_token(uuid, text, text) is
  'Adiciona comentário do CLIENTE ao chamado. Sempre author_role=cliente e internal_only=false. 1-2000 chars.';

-- ---------------------------------------------------------------------
-- 6. Atualiza add_review_comment_by_token (equipe) para aceitar
--    p_internal_only opcional.
--    Mantém backward-compat: sem p_internal_only, default false.
-- ---------------------------------------------------------------------
drop function if exists public.add_review_comment_by_token(uuid, text, text);
create or replace function public.add_review_comment_by_token(
    p_token         uuid,
    p_author        text,
    p_body          text,
    p_internal_only boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_submission_id uuid;
    v_inserted public.setup_review_comments%rowtype;
begin
    select submission_id into v_submission_id
        from public.setup_tickets
        where access_token = p_token
        limit 1;

    if v_submission_id is null then
        raise exception 'invalid_token';
    end if;

    if exists (
        select 1 from public.setup_tickets
        where access_token = p_token
          and expires_at is not null
          and expires_at <= now()
    ) then
        raise exception 'token_expired';
    end if;

    if p_body is null or length(trim(p_body)) = 0 then
        raise exception 'empty_body';
    end if;
    if length(p_body) > 2000 then
        raise exception 'body_too_long';
    end if;

    insert into public.setup_review_comments(submission_id, author, author_role, body, internal_only)
    values (
        v_submission_id,
        coalesce(nullif(trim(p_author), ''), '(sem nome)'),
        'equipe',
        p_body,
        coalesce(p_internal_only, false)
    )
    returning * into v_inserted;

    begin
        insert into public.setup_audit_events(submission_id, actor, action, entity, source, after)
        values (
            v_submission_id,
            coalesce(nullif(trim(p_author), ''), 'review_anon'),
            case when v_inserted.internal_only then 'review_comment.added_internal' else 'review_comment.added' end,
            'setup_review_comments',
            'rpc',
            jsonb_build_object(
                'comment_id',    v_inserted.id,
                'body_length',   length(p_body),
                'internal_only', v_inserted.internal_only
            )
        );
    exception when others then null;
    end;

    return jsonb_build_object(
        'id',            v_inserted.id,
        'author',        v_inserted.author,
        'author_role',   v_inserted.author_role,
        'body',          v_inserted.body,
        'internal_only', v_inserted.internal_only,
        'created_at',    v_inserted.created_at
    );
end;
$$;

revoke all on function public.add_review_comment_by_token(uuid, text, text, boolean) from public;
grant execute on function public.add_review_comment_by_token(uuid, text, text, boolean) to anon;

comment on function public.add_review_comment_by_token(uuid, text, text, boolean) is
  'v5.22: aceita p_internal_only opcional. Default false (visível ao cliente). Sempre author_role=equipe.';

-- ---------------------------------------------------------------------
-- 7. Atualiza get_submission_by_token (equipe) para incluir
--    author_role e internal_only nos comments.
-- ---------------------------------------------------------------------
create or replace function public.get_submission_by_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_ticket   public.setup_tickets%rowtype;
    v_subm     public.setup_submissions%rowtype;
    v_comments jsonb;
    v_result   jsonb;
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

    update public.setup_tickets
        set accessed_at = coalesce(accessed_at, now()),
            accessed_count = accessed_count + 1
        where id = v_ticket.id;

    select * into v_subm
        from public.setup_submissions
        where id = v_ticket.submission_id
        limit 1;

    if v_subm.id is null then
        raise exception 'submission_not_found';
    end if;

    -- Equipe vê TODOS os comentários (inclusive internal_only)
    select coalesce(jsonb_agg(
        jsonb_build_object(
            'id',            c.id,
            'author',        c.author,
            'author_role',   c.author_role,
            'body',          c.body,
            'internal_only', c.internal_only,
            'created_at',    c.created_at
        ) order by c.created_at
    ), '[]'::jsonb)
        into v_comments
        from public.setup_review_comments c
        where c.submission_id = v_subm.id;

    v_result := jsonb_build_object(
        'ticket', jsonb_build_object(
            'ticket_number',   v_ticket.ticket_number,
            'created_at',      v_ticket.created_at,
            'email_sent_at',   v_ticket.email_sent_at,
            'email_recipients',v_ticket.email_recipients,
            'email_cc',        v_ticket.email_cc,
            'accessed_at',     v_ticket.accessed_at,
            'accessed_count',  v_ticket.accessed_count,
            'client_message',  v_ticket.client_message
        ),
        'submission', jsonb_build_object(
            'id',             v_subm.id,
            'draft_id',       v_subm.draft_id,
            'status',         v_subm.status,
            'obra_codigo',    v_subm.obra_codigo,
            'obra_nome',      v_subm.obra_nome,
            'technical_json', v_subm.technical_json,
            'submitted_at',   v_subm.submitted_at,
            'reviewed_at',    v_subm.reviewed_at,
            'reviewer',       v_subm.reviewer,
            'review_note',    v_subm.review_note
        ),
        'comments', v_comments
    );

    return v_result;
end;
$$;

comment on function public.get_submission_by_token(uuid) is
  'v5.22: comments agora incluem author_role + internal_only (equipe vê tudo).';
