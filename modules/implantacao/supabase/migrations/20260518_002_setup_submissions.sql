-- =====================================================================
-- Implantação Consulte GEO — protótipo Supabase
-- 20260518_002_setup_submissions.sql
--
-- Tabela: setup_submissions
-- Submissão "congelada" do rascunho enviado para validação da equipe.
-- =====================================================================

create type if not exists setup_submission_status as enum (
    'enviado',
    'em_validacao',
    'devolvido',
    'aprovado',
    'implantado',
    'cancelado'
);

create table if not exists public.setup_submissions (
    id              uuid primary key default gen_random_uuid(),
    draft_id        uuid references public.setup_drafts(id) on delete set null,
    status          setup_submission_status not null default 'enviado',
    obra_codigo     text not null default '',
    obra_nome       text not null default '',
    technical_json  jsonb not null,
    submitted_at    timestamptz not null default now(),
    reviewed_at     timestamptz,
    reviewer        text,
    review_note     text
);

create index if not exists ix_setup_submissions_status       on public.setup_submissions(status);
create index if not exists ix_setup_submissions_submitted_at on public.setup_submissions(submitted_at desc);
create index if not exists ix_setup_submissions_draft        on public.setup_submissions(draft_id);

alter table public.setup_submissions enable row level security;

drop policy if exists setup_submissions_anon_rw on public.setup_submissions;
create policy setup_submissions_anon_rw
on public.setup_submissions
for all
to anon
using (true)
with check (true);

comment on table public.setup_submissions is
  'Submissões de rascunhos do Cadastro Simplificado de Estrutura para validação interna.';
