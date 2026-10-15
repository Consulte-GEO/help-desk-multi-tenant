-- =====================================================================
-- 20260522_015_step_help_multiple_images.sql · v5.22.37
--
-- Permite até 5 imagens de exemplo por etapa (antes era 1).
-- Migra o image_path único existente para o novo array image_paths.
--
-- DECISÕES:
--  - Adiciona image_paths text[] (não remove image_path ainda, para
--    não quebrar nada em trânsito; image_path fica deprecado e deixa
--    de ser escrito pelo frontend a partir desta versão).
--  - Constraint: no máximo 5 imagens. array_length de array vazio é
--    NULL, então usamos coalesce(...,0) para o check não falhar em
--    arrays vazios.
--  - Idempotente: ADD COLUMN IF NOT EXISTS + UPDATE condicional só
--    migra registros que ainda não têm image_paths populado.
-- =====================================================================

-- 1. Nova coluna array (default vazio)
alter table public.setup_step_help
    add column if not exists image_paths text[] not null default '{}';

-- 2. Migra image_path único → image_paths (só onde ainda não migrado)
update public.setup_step_help
   set image_paths = array[image_path]
 where image_path is not null
   and length(trim(image_path)) > 0
   and coalesce(array_length(image_paths, 1), 0) = 0;

-- 3. Constraint de no máximo 5 imagens
do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'setup_step_help_max_5_images'
    ) then
        alter table public.setup_step_help
            add constraint setup_step_help_max_5_images
            check (coalesce(array_length(image_paths, 1), 0) <= 5);
    end if;
end $$;

comment on column public.setup_step_help.image_paths is
    'Até 5 paths de imagens no bucket step-help-images. Substitui image_path (deprecado). v5.22.37.';
comment on column public.setup_step_help.image_path is
    'DEPRECADO v5.22.37 — use image_paths. Mantido para compat de leitura.';
