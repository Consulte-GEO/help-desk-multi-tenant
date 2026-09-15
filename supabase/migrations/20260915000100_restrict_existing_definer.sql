-- Authored for review. NOT applied remotely in this delivery.
-- Preserve the existing trigger/function body. Only remove direct client execution.
begin;
do $hardening$
declare r text;
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public;
    foreach r in array array['anon','authenticated'] loop
      if exists(select 1 from pg_roles where rolname=r) then
        execute format('revoke execute on function public.rls_auto_enable() from %I',r);
      end if;
    end loop;
  end if;
end $hardening$;
commit;
