-- =====================================================================
-- 20260807_019_harden_setup_admin_and_indexes.sql · v5.22.45
-- Fechamento complementar apontado pelo Database Linter após a V8.
--
-- Objetivos:
--   1. retirar grants diretos do papel anon em tickets/comentários;
--   2. limitar policies administrativas ao papel authenticated;
--   3. restringir RPCs administrativas/geradoras de sequência;
--   4. fixar search_path do trigger de updated_at;
--   5. indexar FKs usadas pelo fluxo de submissão/exportação.
--
-- Rollback emergencial:
--   grant all on public.setup_tickets, public.setup_review_comments to anon, authenticated;
--   grant execute on function public.nextval_ticket() to anon, authenticated;
--   grant execute on function public.add_review_comment_as_admin(uuid,text) to anon;
-- =====================================================================

begin;

alter table public.setup_tickets enable row level security;
alter table public.setup_review_comments enable row level security;

drop policy if exists setup_tickets_admin_read on public.setup_tickets;
create policy setup_tickets_admin_read
    on public.setup_tickets
    for select
    to authenticated
    using (public.is_admin());

drop policy if exists setup_tickets_admin_update on public.setup_tickets;
create policy setup_tickets_admin_update
    on public.setup_tickets
    for update
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

drop policy if exists setup_review_comments_admin_read on public.setup_review_comments;
create policy setup_review_comments_admin_read
    on public.setup_review_comments
    for select
    to authenticated
    using (public.is_admin());

revoke all on table public.setup_tickets from public, anon, authenticated;
revoke all on table public.setup_review_comments from public, anon, authenticated;
grant select, update on table public.setup_tickets to authenticated;
grant select on table public.setup_review_comments to authenticated;

revoke all on function public.add_review_comment_as_admin(uuid, text) from public, anon;
grant execute on function public.add_review_comment_as_admin(uuid, text) to authenticated, service_role;

revoke all on function public.nextval_ticket() from public, anon, authenticated;
grant execute on function public.nextval_ticket() to service_role;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

alter function public.tg_setup_drafts_set_updated_at()
    set search_path = pg_catalog, public;
revoke all on function public.tg_setup_drafts_set_updated_at() from public, anon, authenticated;
grant execute on function public.tg_setup_drafts_set_updated_at() to service_role;

create index if not exists ix_setup_drafts_locked_by_submission
    on public.setup_drafts(locked_by_submission)
    where locked_by_submission is not null;

create index if not exists ix_setup_exports_submission_id
    on public.setup_exports(submission_id)
    where submission_id is not null;

commit;
