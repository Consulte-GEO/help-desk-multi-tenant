-- =====================================================================
-- Implantação Consulte GEO — protótipo Supabase
-- 20260518_003_setup_audit_events.sql
--
-- Tabela: setup_audit_events
-- Audit trail das ações do usuário no protótipo.
-- =====================================================================

create table if not exists public.setup_audit_events (
    id              uuid primary key default gen_random_uuid(),
    draft_id        uuid references public.setup_drafts(id) on delete set null,
    submission_id   uuid references public.setup_submissions(id) on delete set null,
    timestamp       timestamptz not null default now(),
    actor           text not null,
    action          text not null,
    entity          text not null,
    before          jsonb,
    after           jsonb,
    source          text not null default 'frontend'
);

create index if not exists ix_setup_audit_draft        on public.setup_audit_events(draft_id);
create index if not exists ix_setup_audit_submission   on public.setup_audit_events(submission_id);
create index if not exists ix_setup_audit_timestamp    on public.setup_audit_events(timestamp desc);
create index if not exists ix_setup_audit_action       on public.setup_audit_events(action);

alter table public.setup_audit_events enable row level security;

drop policy if exists setup_audit_events_anon_rw on public.setup_audit_events;
create policy setup_audit_events_anon_rw
on public.setup_audit_events
for all
to anon
using (true)
with check (true);

comment on table public.setup_audit_events is
  'Audit trail de ações de cadastro, validação, exportação e submissão no protótipo.';
