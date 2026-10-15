-- =====================================================================
-- 20260521_012_admin_review_comments.sql · v5.22.29 (corrigido em v5.22.33)
--
-- HOTFIX v5.22.33:
-- Mesma defesa da 011: não assumir que migrations anteriores rodaram.
-- A 012 depende de:
--   - is_admin() (vem da 011)
--   - setup_review_comments.author_role + internal_only (vêm da 008)
-- Se a 008 não rodou em produção, garantimos aqui (idempotente).
--
-- HOTFIX v5.22.31 (já incluído):
-- View admin_dashboard_items recriada com colunas reais; RPC popula
-- author_role + internal_only.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Garantir colunas opcionais de setup_review_comments (idempotente)
-- ---------------------------------------------------------------------
-- HOTFIX v5.22.33: caso a migration 008 não tenha rodado, garantimos
-- as colunas aqui. Se já existem, IF NOT EXISTS é no-op.

alter table public.setup_review_comments
    add column if not exists author_role   text   not null default 'equipe',
    add column if not exists internal_only boolean not null default false;

-- ---------------------------------------------------------------------
-- 1) Policy de SELECT para admins em setup_review_comments
-- ---------------------------------------------------------------------

drop policy if exists setup_review_comments_admin_read on public.setup_review_comments;
create policy setup_review_comments_admin_read
    on public.setup_review_comments
    for select
    using (public.is_admin());

-- ---------------------------------------------------------------------
-- 2) RPC: add_review_comment_as_admin
-- ---------------------------------------------------------------------

create or replace function public.add_review_comment_as_admin(
    p_submission_id uuid,
    p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_admin_email text;
    v_comment_id  uuid;
begin
    if not public.is_admin() then
        raise exception 'unauthorized';
    end if;

    if p_body is null or length(trim(p_body)) = 0 then
        raise exception 'body_required';
    end if;

    if length(p_body) > 5000 then
        raise exception 'body_too_long';
    end if;

    if not exists (
        select 1 from public.setup_submissions where id = p_submission_id
    ) then
        raise exception 'submission_not_found';
    end if;

    v_admin_email := lower(coalesce(auth.jwt() ->> 'email', 'admin@consultegeo.com.br'));

    -- HOTFIX v5.22.31:
    -- setup_review_comments tem colunas obrigatórias `author_role` e
    -- `internal_only` (adicionadas pela migration 008). Sem populá-las,
    -- o INSERT falharia com erro de NOT NULL.
    --
    -- author_role='equipe' marca claramente que o comentário veio da
    -- equipe Consulte GEO (não do cliente). internal_only=false porque
    -- comentário do painel admin é PÚBLICO ao cliente em /s/:token —
    -- senão usaríamos setup_admin_notes.
    insert into public.setup_review_comments(
        submission_id,
        author,
        author_role,
        body,
        internal_only
    )
    values (
        p_submission_id,
        v_admin_email,
        'equipe',
        trim(p_body),
        false
    )
    returning id into v_comment_id;

    -- Audit best-effort (não bloqueia retorno se falhar)
    begin
        insert into public.setup_audit_events(
            submission_id, actor, action, entity, source, after
        )
        values (
            p_submission_id,
            v_admin_email,
            'review_comment.added_by_admin',
            'setup_review_comments',
            'admin_panel',
            jsonb_build_object('comment_id', v_comment_id, 'body_length', length(p_body))
        );
    exception when others then null;
    end;

    return jsonb_build_object(
        'ok',            true,
        'id',            v_comment_id,
        'author',        v_admin_email,
        'submission_id', p_submission_id
    );
end;
$$;

revoke all on function public.add_review_comment_as_admin(uuid, text) from public;
grant execute on function public.add_review_comment_as_admin(uuid, text) to authenticated;

comment on function public.add_review_comment_as_admin(uuid, text) is
    'Insere um comentário público em setup_review_comments a partir do painel /admin. Requer is_admin() no JWT. v5.22.31: popula author_role + internal_only.';

-- ---------------------------------------------------------------------
-- 3) View admin_dashboard_items + public_comment_count
-- ---------------------------------------------------------------------
-- HOTFIX v5.22.31: replica view da 011 com colunas reais + adiciona
-- coluna `public_comment_count` (count de comments públicos).
-- ---------------------------------------------------------------------
create or replace view public.admin_dashboard_items as
    select
        s.id                                               as id,
        'submission'::text                                 as kind,
        coalesce(
            (select t2.ticket_number
             from public.setup_tickets t2
             where t2.submission_id = s.id
             limit 1),
            'SUB-' || left(s.id::text, 8)
        )                                                  as identifier,
        s.obra_nome                                        as title,
        s.obra_codigo                                      as subtitle,
        coalesce(
            s.technical_json -> 'metadata' ->> 'cliente',
            ''
        )                                                  as cliente,
        s.status::text                                     as status,
        s.submitted_at                                     as created_at,
        greatest(
            s.submitted_at,
            coalesce(s.reviewed_at,       s.submitted_at),
            coalesce(s.resubmitted_at,    s.submitted_at),
            coalesce(s.last_team_edit_at, s.submitted_at)
        )                                                  as updated_at,
        p.priority                                         as priority,
        l.locked_by_email                                  as locked_by,
        l.expires_at                                       as lock_expires_at,
        (select count(*) from public.setup_admin_notes n
            where n.submission_id = s.id and n.deleted_at is null)
                                                           as note_count,
        -- v5.22.29 — comentários visíveis ao cliente
        (select count(*) from public.setup_review_comments rc
            where rc.submission_id = s.id
              and coalesce(rc.internal_only, false) = false)
                                                           as public_comment_count
    from public.setup_submissions s
    left join public.setup_admin_priorities p on p.submission_id = s.id
    left join public.setup_admin_locks      l on l.submission_id = s.id
                                             and l.expires_at > now()

    union all

    select
        t.id                                               as id,
        'ticket'::text                                     as kind,
        t.ticket_number                                    as identifier,
        coalesce(s.obra_nome, '(sem nome)')                as title,
        coalesce(s.obra_codigo, '')                        as subtitle,
        coalesce(
            s.technical_json -> 'metadata' ->> 'cliente',
            ''
        )                                                  as cliente,
        coalesce(s.status::text, 'enviado')                as status,
        t.created_at                                       as created_at,
        greatest(
            t.created_at,
            coalesce(t.email_sent_at, t.created_at),
            coalesce(t.accessed_at,   t.created_at)
        )                                                  as updated_at,
        p.priority                                         as priority,
        null::text                                         as locked_by,
        null::timestamptz                                  as lock_expires_at,
        (select count(*) from public.setup_admin_notes n
            where n.ticket_id = t.id and n.deleted_at is null)
                                                           as note_count,
        (select count(*) from public.setup_review_comments rc
            where rc.submission_id = t.submission_id
              and coalesce(rc.internal_only, false) = false)
                                                           as public_comment_count
    from public.setup_tickets t
    left join public.setup_submissions      s on s.id = t.submission_id
    left join public.setup_admin_priorities p on p.ticket_id = t.id;

comment on view public.admin_dashboard_items is
    'View consolidada de submissions + tickets para o painel /admin. v5.22.29: inclui public_comment_count. v5.22.31: colunas alinhadas com schema real.';
