-- =====================================================================
-- Implantação Consulte GEO — protótipo Supabase
-- 20260518_005_setup_tickets.sql · v5.20
--
-- Adiciona o fluxo de chamado com número humano-amigável (CG-AAAA-NNNNNN),
-- token de acesso (UUID) usado no email enviado à equipe Consulte GEO,
-- e RPCs SECURITY DEFINER para gate de acesso à submission.
--
-- Diferenças importantes vs setup_submissions:
--   - setup_submissions continua com RLS aberta para anon (compatibilidade
--     com fluxo atual do protótipo).
--   - setup_tickets NÃO permite SELECT para anon — só acessível via RPC
--     `get_submission_by_token` que valida o token antes de retornar.
--   - O access_token NUNCA é exposto ao frontend após o submit. Ele só
--     existe no email enviado à equipe.
--
-- Sequence ticket_number_seq incrementa eternamente; o prefixo do ano em
-- format_ticket_number() é baseado em now(). Não há reset anual (mais
-- simples e elimina risco de duplicação cross-year).
-- =====================================================================

create sequence if not exists public.ticket_number_seq
    start 1
    increment 1
    no cycle;

comment on sequence public.ticket_number_seq is
  'Sequência global de chamados de implantação. Não reseta por ano — o ano em format_ticket_number() é apenas visual.';

-- ---------------------------------------------------------------------
-- RPC: nextval_ticket()
-- Wrapper para a Edge Function consumir a sequence via PostgREST.
-- SECURITY DEFINER porque PostgREST anon não tem USAGE em sequences
-- por default — manter a sequence "trancada" e expor só via essa RPC.
-- ---------------------------------------------------------------------
create or replace function public.nextval_ticket()
returns bigint
language sql
security definer
set search_path = public
as $$
    select nextval('public.ticket_number_seq');
$$;

revoke all on function public.nextval_ticket() from public;
grant execute on function public.nextval_ticket() to anon;

comment on function public.nextval_ticket() is
  'Retorna o próximo valor de ticket_number_seq. Usada pela Edge Function submit-for-validation.';

-- ---------------------------------------------------------------------
-- Helper: formata o número do chamado a partir do nextval da sequência.
-- Ex.: format_ticket_number(123)        -> 'CG-2026-000123'
--      format_ticket_number(123, 2027)  -> 'CG-2027-000123'
-- ---------------------------------------------------------------------
create or replace function public.format_ticket_number(
    seq bigint,
    year_input int default null
)
returns text
language sql
immutable
as $$
    select 'CG-'
        || coalesce(year_input, extract(year from now())::int)::text
        || '-'
        || lpad(seq::text, 6, '0');
$$;

-- ---------------------------------------------------------------------
-- Tabela setup_tickets
-- ---------------------------------------------------------------------
create table if not exists public.setup_tickets (
    id                 uuid primary key default gen_random_uuid(),
    submission_id      uuid not null references public.setup_submissions(id) on delete cascade,
    ticket_number      text not null unique,
    access_token       uuid not null unique default gen_random_uuid(),
    expires_at         timestamptz,
    email_recipients   text[] not null default '{}',
    email_cc           text[] not null default '{}',
    email_sent_at      timestamptz,
    email_error        text,
    accessed_at        timestamptz,
    accessed_count     integer not null default 0,
    client_message     text,
    created_at         timestamptz not null default now()
);

create index if not exists ix_setup_tickets_token    on public.setup_tickets(access_token);
create index if not exists ix_setup_tickets_number   on public.setup_tickets(ticket_number);
create index if not exists ix_setup_tickets_subm     on public.setup_tickets(submission_id);
create index if not exists ix_setup_tickets_created  on public.setup_tickets(created_at desc);

comment on table public.setup_tickets is
  'Chamados de implantação. Cada submission aprovada gera um ticket com número humano-amigável e access_token que vai no email enviado à equipe Consulte GEO.';
comment on column public.setup_tickets.access_token is
  'UUID. NUNCA exposto ao frontend após o submit. Vai apenas no email enviado à equipe.';
comment on column public.setup_tickets.client_message is
  'Mensagem opcional digitada pelo cliente na Etapa 6 (max 1000 chars no frontend).';

-- RLS: bloqueia SELECT direto via anon. Acesso só via RPCs SECURITY DEFINER.
alter table public.setup_tickets enable row level security;

drop policy if exists setup_tickets_anon_block on public.setup_tickets;
create policy setup_tickets_anon_block
on public.setup_tickets
for all
to anon
using (false)
with check (false);

-- ---------------------------------------------------------------------
-- RPC: get_submission_by_token(token)
--
-- Valida o token, registra acesso (idempotente para o accessed_at), e
-- retorna a submission completa + dados do ticket.
--
-- SECURITY DEFINER: bypassa RLS de setup_tickets (e setup_submissions),
-- mas internamente só retorna se o token bater.
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

    -- Registra primeiro acesso e incrementa contador (auditoria)
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
        )
    );

    return v_result;
end;
$$;

revoke all on function public.get_submission_by_token(uuid) from public;
grant execute on function public.get_submission_by_token(uuid) to anon;

comment on function public.get_submission_by_token(uuid) is
  'Retorna submission+ticket dado um access_token válido. Único caminho do frontend para ler tickets/submissions na review page. Registra acesso (auditoria).';

-- ---------------------------------------------------------------------
-- RPC: update_submission_status_by_token(token, status, note?, reviewer?)
--
-- Permite à equipe alterar o status da submission via mesma rota gated
-- pelo token. Aceita os valores do enum setup_submission_status,
-- mapeando opcionalmente nomes amigáveis ('validado' -> 'aprovado',
-- 'em_analise' -> 'em_validacao', 'enviado_validacao' -> 'enviado').
-- ---------------------------------------------------------------------
create or replace function public.update_submission_status_by_token(
    p_token    uuid,
    p_status   text,
    p_note     text default null,
    p_reviewer text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_ticket   public.setup_tickets%rowtype;
    v_mapped   setup_submission_status;
begin
    -- valida token
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

    -- mapping de aliases amigáveis -> enum
    v_mapped := case lower(coalesce(p_status, ''))
        when 'enviado_validacao' then 'enviado'
        when 'enviado'           then 'enviado'
        when 'em_analise'        then 'em_validacao'
        when 'em_validacao'      then 'em_validacao'
        when 'devolvido'         then 'devolvido'
        when 'validado'          then 'aprovado'
        when 'aprovado'          then 'aprovado'
        when 'implantado'        then 'implantado'
        when 'cancelado'         then 'cancelado'
        else null
    end;

    if v_mapped is null then
        raise exception 'invalid_status: %', p_status;
    end if;

    update public.setup_submissions
        set status      = v_mapped,
            reviewed_at = case when v_mapped in ('aprovado','devolvido','implantado','cancelado')
                                then now() else reviewed_at end,
            reviewer    = coalesce(p_reviewer, reviewer),
            review_note = case when p_note is not null then p_note else review_note end
        where id = v_ticket.submission_id;

    return jsonb_build_object(
        'ok', true,
        'status', v_mapped::text,
        'updated_at', now()
    );
end;
$$;

revoke all on function public.update_submission_status_by_token(uuid, text, text, text) from public;
grant execute on function public.update_submission_status_by_token(uuid, text, text, text) to anon;

comment on function public.update_submission_status_by_token(uuid, text, text, text) is
  'Atualiza status de submission via token. Aceita aliases (validado, em_analise, enviado_validacao).';
