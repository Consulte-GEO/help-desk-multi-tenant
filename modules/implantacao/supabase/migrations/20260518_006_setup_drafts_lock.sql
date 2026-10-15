-- =====================================================================
-- Implantação Consulte GEO — protótipo Supabase
-- 20260518_006_setup_drafts_lock.sql · v5.20
--
-- Adiciona colunas para "trancar" drafts após submit. O draft não é
-- deletado — fica read-only, preservando auditoria e permitindo que o
-- cliente "duplique" um envio anterior como ponto de partida no futuro.
-- =====================================================================

alter table public.setup_drafts
    add column if not exists locked_at timestamptz;

alter table public.setup_drafts
    add column if not exists locked_by_submission uuid
        references public.setup_submissions(id) on delete set null;

create index if not exists ix_setup_drafts_locked on public.setup_drafts(locked_at)
    where locked_at is not null;

comment on column public.setup_drafts.locked_at is
  'Marcado quando o draft foi enviado para validação. Indica que o draft é read-only para o cliente.';
comment on column public.setup_drafts.locked_by_submission is
  'FK para a submission que travou o draft. Permite navegar do draft trancado para o ticket gerado.';
