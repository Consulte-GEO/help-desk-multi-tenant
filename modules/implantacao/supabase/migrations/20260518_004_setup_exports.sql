-- =====================================================================
-- Implantação Consulte GEO — protótipo Supabase
-- 20260518_004_setup_exports.sql
--
-- Tabela: setup_exports
-- Log de exportações geradas (JSON técnico, planilha Excel).
-- =====================================================================

create type if not exists setup_export_kind as enum ('json', 'excel');

create table if not exists public.setup_exports (
    id              uuid primary key default gen_random_uuid(),
    draft_id        uuid references public.setup_drafts(id) on delete set null,
    submission_id   uuid references public.setup_submissions(id) on delete set null,
    kind            setup_export_kind not null,
    filename        text not null,
    size_bytes      bigint,
    hash            text,
    created_at      timestamptz not null default now()
);

create index if not exists ix_setup_exports_kind        on public.setup_exports(kind);
create index if not exists ix_setup_exports_created_at  on public.setup_exports(created_at desc);
create index if not exists ix_setup_exports_draft       on public.setup_exports(draft_id);

alter table public.setup_exports enable row level security;

drop policy if exists setup_exports_anon_rw on public.setup_exports;
create policy setup_exports_anon_rw
on public.setup_exports
for all
to anon
using (true)
with check (true);

comment on table public.setup_exports is
  'Log de exportações técnicas (JSON, Excel) geradas a partir do Cadastro Simplificado de Estrutura.';
