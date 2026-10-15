-- =====================================================================
-- Implantação Consulte GEO — protótipo Supabase
-- 20260518_001_setup_drafts.sql
--
-- Tabela: setup_drafts
-- Armazena rascunhos do Cadastro Simplificado de Estrutura.
-- =====================================================================

create extension if not exists "pgcrypto";

create type if not exists setup_draft_status as enum (
    'rascunho',
    'enviado',
    'devolvido',
    'implantado',
    'cancelado'
);

create table if not exists public.setup_drafts (
    id              uuid primary key default gen_random_uuid(),
    status          setup_draft_status not null default 'rascunho',
    obra_codigo     text not null default '',
    obra_nome       text not null default '',
    snapshot        jsonb not null,
    technical_json  jsonb,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index if not exists ix_setup_drafts_status      on public.setup_drafts(status);
create index if not exists ix_setup_drafts_updated_at  on public.setup_drafts(updated_at desc);
create index if not exists ix_setup_drafts_obra_codigo on public.setup_drafts(obra_codigo);

-- updated_at trigger
create or replace function public.tg_setup_drafts_set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists tg_setup_drafts_updated on public.setup_drafts;
create trigger tg_setup_drafts_updated
before update on public.setup_drafts
for each row execute function public.tg_setup_drafts_set_updated_at();

-- RLS: por padrão habilitamos sem política — em preview, o anon key pode escrever
-- com a policy abaixo (REVISAR ANTES DE PRODUÇÃO).
alter table public.setup_drafts enable row level security;

drop policy if exists setup_drafts_anon_rw on public.setup_drafts;
create policy setup_drafts_anon_rw
on public.setup_drafts
for all
to anon
using (true)
with check (true);

comment on table public.setup_drafts is
  'Rascunhos do Cadastro Simplificado de Estrutura (Implantação Consulte GEO v4 / protótipo).';
