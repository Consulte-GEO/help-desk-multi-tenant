-- =====================================================================
-- 20260521_013_review_comment_returns_submission.sql · v5.22.34
--
-- Estende os RPCs add_review_comment_by_token e
-- add_review_comment_as_admin para retornar `submission_id` no
-- JSON de resposta. Frontend precisa desse campo para chamar
-- a Edge Function notify-team-comment.
--
-- ALTERNATIVAS CONSIDERADAS:
--   A) Fazer Edge Function aceitar `access_token` da equipe e
--      resolver submission_id internamente.
--      → Recusado: cliente que enviou comment em /s/:token NÃO tem
--      access_token (só client_access_token). Forçaria 2 Edge
--      Functions diferentes.
--
--   B) Frontend faz query extra após o RPC para descobrir submission_id.
--      → Recusado: round-trip extra, mais código no frontend, e
--      o backend já tem essa info disponível.
--
--   C) Estender o RPC (esta opção).
--      → Idempotente (CREATE OR REPLACE), backwards-compatible
--      (adiciona campo, não remove), permite Edge Function uniforme.
--
-- IMPORTANTE: este SQL é idempotente. Se rodar várias vezes, os RPCs
-- são reescritos com a mesma definição. Frontends antigos que NÃO
-- usam submission_id no retorno continuam funcionando (campo extra
-- é ignorado).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) add_review_comment_by_token: agora retorna submission_id
-- ---------------------------------------------------------------------
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

    -- audit best-effort
    begin
        insert into public.setup_audit_events(submission_id, actor, action, entity, source, after)
        values (
            v_submission_id,
            coalesce(nullif(trim(p_author), ''), '(equipe_anon)'),
            'review_comment.added',
            'setup_review_comments',
            'rpc',
            jsonb_build_object(
                'comment_id', v_inserted.id,
                'body_length', length(p_body),
                'internal_only', v_inserted.internal_only
            )
        );
    exception when others then null;
    end;

    -- v5.22.34: retorna submission_id no payload para que o frontend
    -- possa disparar notify-team-comment quando o comentário for público.
    return jsonb_build_object(
        'id',            v_inserted.id,
        'author',        v_inserted.author,
        'author_role',   v_inserted.author_role,
        'body',          v_inserted.body,
        'internal_only', v_inserted.internal_only,
        'created_at',    v_inserted.created_at,
        'submission_id', v_inserted.submission_id
    );
end;
$$;

comment on function public.add_review_comment_by_token(uuid, text, text, boolean) is
    'Insere comentário de equipe em /r/:token. v5.22.34: retorna submission_id no payload para notify-team-comment.';

-- ---------------------------------------------------------------------
-- 2) add_review_comment_as_admin: agora retorna submission_id também
-- ---------------------------------------------------------------------
-- (já recebe submission_id como parâmetro; é só ecoar no retorno
-- para mantermos o contrato uniforme entre os dois RPCs)
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

    insert into public.setup_review_comments(
        submission_id, author, author_role, body, internal_only
    )
    values (
        p_submission_id, v_admin_email, 'equipe', trim(p_body), false
    )
    returning id into v_comment_id;

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
    'Insere comentário público pelo painel /admin. v5.22.34: retorno mantido (já tinha submission_id).';
