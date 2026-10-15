-- =====================================================================
-- ⚠ JÁ APLICADA EM PRODUÇÃO — NÃO REAPLICAR ⚠
-- Aplicada em 10/08/2026 via MCP (apply_migration), registrada no
-- ledger como *_harden_search_path_and_external_cache_rls.
--
-- Higiene de advisors (PK backlog §1.4 + §2.8):
-- 1) external_cache: ENABLE RLS (era o único advisory CRITICAL).
--    Tabela do app legado, 0 linhas na data. Sem policies = fecha
--    anon/authenticated; service_role bypassa RLS (EFs de backend não
--    são afetadas). Rollback: ALTER TABLE ... DISABLE ROW LEVEL SECURITY.
-- 2) search_path fixo nas 5 funções com search_path mutável (5 WARN
--    zerados): format_ticket_number e setup_step_help_touch_updated_at
--    (app) + handle_new_user, handle_new_project e
--    populate_default_coefficients (legado; handle_new_user roda no
--    signup do Auth usado pelo /admin — sem mudança de comportamento).
-- =====================================================================

alter table public.external_cache enable row level security;

comment on table public.external_cache is
  'Tabela do app legado (pré-implantação). RLS habilitada em 10/08/2026 sem policies — anon/authenticated sem acesso; service_role bypassa. 0 linhas na data.';

alter function public.format_ticket_number(seq bigint, year_input integer)
  set search_path = public;
alter function public.setup_step_help_touch_updated_at()
  set search_path = public;
alter function public.handle_new_user()
  set search_path = public;
alter function public.handle_new_project()
  set search_path = public;
alter function public.populate_default_coefficients()
  set search_path = public;
