-- =====================================================================
-- 20260807_021_restore_is_admin_for_public_rls.sql · v5.22.45
-- Correção de regressão da migration 019.
--
-- Algumas policies públicas preexistentes (ex.: setup_step_help) avaliam
-- `enabled = true OR public.is_admin()`. O papel anon precisa poder executar
-- a função para que a leitura dos registros habilitados não falhe com
-- `permission denied for function is_admin`.
--
-- A função permanece segura para anon: sem JWT administrativo retorna false,
-- não expõe dados e não concede privilégio por si só. As tabelas sensíveis
-- continuam sem grants diretos e com policies restritas a authenticated.
--
-- Rollback: revoke execute on function public.is_admin() from anon;
-- (o rollback também volta a quebrar as policies públicas que a chamam).
-- =====================================================================

begin;

grant execute on function public.is_admin() to anon;

comment on function public.is_admin() is
    'Retorna true apenas para JWT admin. EXECUTE para anon é necessário às policies públicas que combinam conteúdo habilitado OU admin.';

commit;
