-- =====================================================================
-- 20260521_011_admin_panel.sql · v5.22.28 (corrigido em v5.22.33)
--
-- HOTFIX v5.22.33:
-- A v5.22.31 corrigiu colunas inventadas. Mas em produção descobrimos
-- que algumas colunas que ASSUMIMOS existir (criadas pelas migrations
-- 009 e 010) não foram aplicadas. Erro real:
--   ERROR: column s.resubmitted_at does not exist
--
-- Causa: as migrations 009 (resubmitted_at) e 010 (last_team_edit_at,
-- customer_input_original, team_edits_count) nunca foram aplicadas em
-- produção, ou foram removidas. Não posso assumir que existem.
--
-- Solução: a própria migration 011 garante (idempotente via
-- `add column if not exists`) que essas colunas existam antes de
-- referenciá-las na view. Assim a migration funciona em qualquer
-- estado do banco: schema da 008, 009, 010 ou completo.
--
-- HOTFIX v5.22.31 (já incluído):
-- View referenciava colunas inventadas (protocolo, cliente, created_at,
-- updated_at, responsavel_nome em submissions; status, updated_at,
-- payload em tickets). Tudo corrigido.
--
-- Schema MÍNIMO confirmado existir (migration 002 base):
--   setup_submissions: id, draft_id, status, obra_codigo, obra_nome,
--                      technical_json, submitted_at, reviewed_at,
--                      reviewer, review_note
--   setup_tickets:     id, submission_id, ticket_number, access_token,
--                      client_access_token, expires_at,
--                      email_recipients, email_cc, email_sent_at,
--                      email_error, accessed_at, accessed_count,
--                      client_message, created_at
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Garantir colunas opcionais necessárias (idempotente).
-- ---------------------------------------------------------------------
-- HOTFIX v5.22.33: blindar contra estado intermediário de migrations.
-- Se a 009/010 já foram aplicadas, IF NOT EXISTS é no-op. Se não,
-- aplica aqui. A view abaixo depende dessas colunas.

alter table public.setup_submissions
    add column if not exists resubmitted_at         timestamptz,
    add column if not exists last_team_edit_at      timestamptz,
    add column if not exists customer_input_original jsonb,
    add column if not exists team_edits_count       integer not null default 0;

comment on column public.setup_submissions.resubmitted_at is
    'Timestamp da última resubmissão pelo cliente após devolução. Garantida pela migration 011 (caso 009 não tenha rodado).';

-- ---------------------------------------------------------------------
-- 1. setup_admin_notes
-- ---------------------------------------------------------------------
create table if not exists public.setup_admin_notes (
    id              uuid primary key default gen_random_uuid(),
    submission_id   uuid references public.setup_submissions(id) on delete cascade,
    ticket_id       uuid references public.setup_tickets(id)     on delete cascade,
    body            text not null check (length(trim(body)) > 0 and length(body) <= 5000),
    created_by_email   text not null,
    created_at         timestamptz not null default now(),
    deleted_at         timestamptz,
    constraint setup_admin_notes_target_xor check (
        (submission_id is not null and ticket_id is null) or
        (submission_id is null and ticket_id is not null)
    )
);

create index if not exists setup_admin_notes_submission_idx
    on public.setup_admin_notes (submission_id)
    where submission_id is not null and deleted_at is null;

create index if not exists setup_admin_notes_ticket_idx
    on public.setup_admin_notes (ticket_id)
    where ticket_id is not null and deleted_at is null;

comment on table public.setup_admin_notes is
    'Notas internas dos admins sobre chamados/submissions. Não vai para o cliente.';

-- ---------------------------------------------------------------------
-- 2. setup_admin_locks
-- ---------------------------------------------------------------------
create table if not exists public.setup_admin_locks (
    submission_id   uuid primary key references public.setup_submissions(id) on delete cascade,
    locked_by_email text not null,
    locked_at       timestamptz not null default now(),
    expires_at      timestamptz not null default (now() + interval '4 hours')
);

create index if not exists setup_admin_locks_expires_idx
    on public.setup_admin_locks (expires_at);

comment on table public.setup_admin_locks is
    'Lock soft de submissions para um admin específico. TTL de 4h.';

-- ---------------------------------------------------------------------
-- 3. setup_admin_priorities
-- ---------------------------------------------------------------------
create table if not exists public.setup_admin_priorities (
    id              uuid primary key default gen_random_uuid(),
    submission_id   uuid references public.setup_submissions(id) on delete cascade,
    ticket_id       uuid references public.setup_tickets(id)     on delete cascade,
    priority        text not null check (priority in ('baixa', 'media', 'alta', 'urgente')),
    set_by_email    text not null,
    set_at          timestamptz not null default now(),
    constraint setup_admin_priorities_target_xor check (
        (submission_id is not null and ticket_id is null) or
        (submission_id is null and ticket_id is not null)
    ),
    unique (submission_id),
    unique (ticket_id)
);

comment on table public.setup_admin_priorities is
    'Etiqueta de prioridade atribuída pelo admin. Uma por chamado/submission.';

-- ---------------------------------------------------------------------
-- 4. is_admin() — checagem de role para policies
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select case
        when auth.jwt() is null then false
        when (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true then true
        when lower(auth.jwt() ->> 'email') in (
            'thiago@consultegeo.com.br',
            'atendimento@consultegeo.com.br'
        ) then true
        else false
    end;
$$;

comment on function public.is_admin() is
    'True se o JWT atual é de um admin (via app_metadata.is_admin OU whitelist hardcoded de emails).';

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. RLS Policies
-- ---------------------------------------------------------------------

alter table public.setup_admin_notes enable row level security;

drop policy if exists setup_admin_notes_admin_read on public.setup_admin_notes;
create policy setup_admin_notes_admin_read
    on public.setup_admin_notes
    for select
    using (public.is_admin());

drop policy if exists setup_admin_notes_admin_write on public.setup_admin_notes;
create policy setup_admin_notes_admin_write
    on public.setup_admin_notes
    for insert
    with check (public.is_admin());

drop policy if exists setup_admin_notes_admin_update on public.setup_admin_notes;
create policy setup_admin_notes_admin_update
    on public.setup_admin_notes
    for update
    using (public.is_admin())
    with check (public.is_admin());

alter table public.setup_admin_locks enable row level security;

drop policy if exists setup_admin_locks_admin_all on public.setup_admin_locks;
create policy setup_admin_locks_admin_all
    on public.setup_admin_locks
    for all
    using (public.is_admin())
    with check (public.is_admin());

alter table public.setup_admin_priorities enable row level security;

drop policy if exists setup_admin_priorities_admin_all on public.setup_admin_priorities;
create policy setup_admin_priorities_admin_all
    on public.setup_admin_priorities
    for all
    using (public.is_admin())
    with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 6. Acesso admin a setup_submissions e setup_tickets
-- ---------------------------------------------------------------------

drop policy if exists setup_tickets_admin_read on public.setup_tickets;
create policy setup_tickets_admin_read
    on public.setup_tickets
    for select
    using (public.is_admin());

drop policy if exists setup_tickets_admin_update on public.setup_tickets;
create policy setup_tickets_admin_update
    on public.setup_tickets
    for update
    using (public.is_admin())
    with check (public.is_admin());

drop policy if exists setup_submissions_admin_update on public.setup_submissions;
create policy setup_submissions_admin_update
    on public.setup_submissions
    for update
    using (public.is_admin())
    with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 7. View consolidada admin_dashboard_items
-- ---------------------------------------------------------------------
-- HOTFIX v5.22.31: usa colunas que realmente existem.
--
-- LADO SUBMISSIONS:
--   - identifier: ticket_number via subquery (1 ticket por submission)
--                 ou 'SUB-' + primeiros 8 chars do UUID (caso raro)
--   - cliente:    extraído de technical_json -> metadata -> cliente
--   - created_at: usa submitted_at
--   - updated_at: max(submitted_at, reviewed_at, resubmitted_at, last_team_edit_at)
--
-- LADO TICKETS:
--   - identifier: ticket_number
--   - title/subtitle/cliente: vêm da submission via JOIN
--   - status:     vem da submission via JOIN
--   - created_at: usa created_at do ticket
--   - updated_at: max(created_at, email_sent_at, accessed_at)
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
                                                           as note_count
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
                                                           as note_count
    from public.setup_tickets t
    left join public.setup_submissions      s on s.id = t.submission_id
    left join public.setup_admin_priorities p on p.ticket_id = t.id;

comment on view public.admin_dashboard_items is
    'View consolidada de submissions + tickets para o painel /admin. Hotfix v5.22.31: colunas alinhadas com schema real.';
