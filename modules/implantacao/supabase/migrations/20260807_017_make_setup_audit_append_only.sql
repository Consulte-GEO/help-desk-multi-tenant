-- =====================================================================
-- 20260807_017_make_setup_audit_append_only.sql · v5.22.45
-- Fase 2/3 do fechamento RLS V8.
--
-- Estado intermediário seguro contra leitura, alteração e exclusão por anon:
-- o frontend legado ainda pode INSERT até a Fase 3 migrar para RPC por token.
-- Na Fase 3 esta policy de INSERT anon também é removida.
--
-- Rollback da fase 2 (somente em emergência):
--   drop policy if exists setup_audit_events_anon_insert on public.setup_audit_events;
--   drop policy if exists setup_audit_events_admin_select on public.setup_audit_events;
--   drop policy if exists setup_audit_events_admin_insert on public.setup_audit_events;
--   create policy setup_audit_events_anon_rw on public.setup_audit_events
--     for all to anon using (true) with check (true);
--   grant all on table public.setup_audit_events to anon, authenticated;
-- =====================================================================

begin;

alter table public.setup_audit_events enable row level security;

drop policy if exists setup_audit_events_anon_rw on public.setup_audit_events;
drop policy if exists setup_audit_events_anon_block on public.setup_audit_events;
drop policy if exists setup_audit_events_anon_insert on public.setup_audit_events;
create policy setup_audit_events_anon_insert
    on public.setup_audit_events
    for insert
    to anon
    with check (
        length(actor) between 1 and 254
        and length(action) between 1 and 160
        and length(entity) between 1 and 160
        and length(source) between 1 and 80
        and octet_length(coalesce(before, '{}'::jsonb)::text) <= 1048576
        and octet_length(coalesce(after, '{}'::jsonb)::text) <= 1048576
    );

drop policy if exists setup_audit_events_admin_select on public.setup_audit_events;
create policy setup_audit_events_admin_select
    on public.setup_audit_events
    for select
    to authenticated
    using (public.is_admin());

drop policy if exists setup_audit_events_admin_insert on public.setup_audit_events;
create policy setup_audit_events_admin_insert
    on public.setup_audit_events
    for insert
    to authenticated
    with check (public.is_admin());

-- Sem grants/policies de UPDATE ou DELETE: auditoria append-only.
revoke all on table public.setup_audit_events from public, anon, authenticated;
grant insert on table public.setup_audit_events to anon;
grant select, insert on table public.setup_audit_events to authenticated;

comment on table public.setup_audit_events is
    'Audit trail append-only. V8 fase 2: anon apenas INSERT temporário; admin autenticado SELECT/INSERT; UPDATE/DELETE bloqueados.';

commit;
