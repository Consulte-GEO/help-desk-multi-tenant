-- =====================================================================
-- Implantação Consulte GEO — protótipo Supabase
-- 20260518_007_setup_review_comments.sql · v5.21
--
-- Tabela de histórico de comentários na tela de review (a equipe pode
-- adicionar várias notas durante a análise de um chamado, em vez da
-- "uma nota só" da v5.20).
--
-- RLS: anon não tem SELECT/INSERT/UPDATE direto. Acesso via 2 RPCs:
--   - list_review_comments_by_token(p_token)
--   - add_review_comment_by_token(p_token, p_author, p_body)
--
-- Comentários NÃO são editáveis nesta versão — append-only. Se um
-- comentário foi enviado com erro de digitação, a equipe adiciona outro
-- corrigindo (audit-friendly).
-- =====================================================================

create table if not exists public.setup_review_comments (
    id              uuid primary key default gen_random_uuid(),
    submission_id   uuid not null references public.setup_submissions(id) on delete cascade,
    author          text not null default '',
    body            text not null,
    created_at      timestamptz not null default now()
);

create index if not exists ix_setup_review_comments_subm
    on public.setup_review_comments(submission_id, created_at);

comment on table public.setup_review_comments is
  'Histórico de comentários da equipe Consulte GEO na tela de review de um chamado. Append-only; cada comentário é uma nota independente com autor e timestamp.';

alter table public.setup_review_comments enable row level security;

drop policy if exists setup_review_comments_anon_block on public.setup_review_comments;
create policy setup_review_comments_anon_block
on public.setup_review_comments
for all
to anon
using (false)
with check (false);

-- ---------------------------------------------------------------------
-- RPC: list_review_comments_by_token(token)
-- Lista comentários do chamado autenticado pelo token.
-- ---------------------------------------------------------------------
create or replace function public.list_review_comments_by_token(p_token uuid)
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
        where access_token = p_token
        limit 1;

    if v_submission_id is null then
        raise exception 'invalid_token';
    end if;

    -- Verifica expiração (mesmo guard de get_submission_by_token)
    if exists (
        select 1 from public.setup_tickets
        where access_token = p_token
          and expires_at is not null
          and expires_at <= now()
    ) then
        raise exception 'token_expired';
    end if;

    select coalesce(jsonb_agg(
        jsonb_build_object(
            'id',         c.id,
            'author',     c.author,
            'body',       c.body,
            'created_at', c.created_at
        ) order by c.created_at
    ), '[]'::jsonb)
        into v_result
        from public.setup_review_comments c
        where c.submission_id = v_submission_id;

    return v_result;
end;
$$;

revoke all on function public.list_review_comments_by_token(uuid) from public;
grant execute on function public.list_review_comments_by_token(uuid) to anon;

comment on function public.list_review_comments_by_token(uuid) is
  'Lista comentários de um chamado autenticado por access_token. Ordenados por created_at ASC.';

-- ---------------------------------------------------------------------
-- RPC: add_review_comment_by_token(token, author, body)
-- Insere um comentário no histórico.
-- ---------------------------------------------------------------------
create or replace function public.add_review_comment_by_token(
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
    -- valida token
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

    -- valida body
    if p_body is null or length(trim(p_body)) = 0 then
        raise exception 'empty_body';
    end if;
    if length(p_body) > 2000 then
        raise exception 'body_too_long';
    end if;

    insert into public.setup_review_comments(submission_id, author, body)
    values (
        v_submission_id,
        coalesce(nullif(trim(p_author), ''), '(sem nome)'),
        p_body
    )
    returning * into v_inserted;

    -- audit event (best-effort; não bloqueia)
    begin
        insert into public.setup_audit_events(submission_id, actor, action, entity, source, after)
        values (
            v_submission_id,
            coalesce(nullif(trim(p_author), ''), 'review_anon'),
            'review_comment.added',
            'setup_review_comments',
            'rpc',
            jsonb_build_object('comment_id', v_inserted.id, 'body_length', length(p_body))
        );
    exception when others then null;
    end;

    return jsonb_build_object(
        'id',         v_inserted.id,
        'author',     v_inserted.author,
        'body',       v_inserted.body,
        'created_at', v_inserted.created_at
    );
end;
$$;

revoke all on function public.add_review_comment_by_token(uuid, text, text) from public;
grant execute on function public.add_review_comment_by_token(uuid, text, text) to anon;

comment on function public.add_review_comment_by_token(uuid, text, text) is
  'Adiciona comentário ao histórico de um chamado autenticado por access_token. Body 1-2000 chars. Append-only.';

-- ---------------------------------------------------------------------
-- Substitui get_submission_by_token para retornar comments junto.
-- Backward-compatible: assinatura idêntica, response ganha campo 'comments'.
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

    select coalesce(jsonb_agg(
        jsonb_build_object(
            'id',         c.id,
            'author',     c.author,
            'body',       c.body,
            'created_at', c.created_at
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
  'v5.21: agora retorna também o array de comments (histórico da review). Backward-compatible — clients antigos ignoram o campo novo.';
