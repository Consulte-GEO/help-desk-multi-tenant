-- =====================================================================
-- 20260807_016_close_setup_submissions_and_admin_view.sql · v5.22.45
-- Fase 1/3 do fechamento RLS V8.
--
-- Objetivos:
--   1. remover acesso direto irrestrito de anon a setup_submissions;
--   2. preservar SELECT/UPDATE somente para admins autenticados;
--   3. impedir que admin_dashboard_items, por ser view do owner postgres,
--      contorne RLS e exponha submissions/tickets ao papel anon.
--
-- Rollback da fase 1 (somente em emergência):
--   drop policy if exists setup_submissions_anon_block on public.setup_submissions;
--   create policy setup_submissions_anon_rw on public.setup_submissions
--     for all to anon using (true) with check (true);
--   grant all on table public.setup_submissions to anon, authenticated;
--   alter view public.admin_dashboard_items reset (security_invoker);
--   grant all on table public.admin_dashboard_items to anon, authenticated;
-- =====================================================================

begin;

alter table public.setup_submissions enable row level security;

drop policy if exists setup_submissions_anon_rw on public.setup_submissions;
drop policy if exists setup_submissions_anon_block on public.setup_submissions;
create policy setup_submissions_anon_block
    on public.setup_submissions
    for all
    to anon
    using (false)
    with check (false);

drop policy if exists setup_submissions_admin_select on public.setup_submissions;
create policy setup_submissions_admin_select
    on public.setup_submissions
    for select
    to authenticated
    using (public.is_admin());

drop policy if exists setup_submissions_admin_update on public.setup_submissions;
create policy setup_submissions_admin_update
    on public.setup_submissions
    for update
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

revoke all on table public.setup_submissions from public, anon, authenticated;
grant select, update on table public.setup_submissions to authenticated;

-- Views são security-definer por padrão no Postgres. A opção abaixo faz a
-- consulta respeitar as policies do usuário que invoca a view.
alter view public.admin_dashboard_items set (security_invoker = true);
revoke all on table public.admin_dashboard_items from public, anon, authenticated;
grant select on table public.admin_dashboard_items to authenticated;

comment on view public.admin_dashboard_items is
    'Painel consolidado admin. V8: security_invoker=true e SELECT somente para authenticated; tabelas-base exigem is_admin().';

commit;
