-- =====================================================================
-- 20260522_014_setup_step_help.sql · v5.22.36
--
-- Ajuda contextual configurável por etapa do wizard de implantação.
-- O admin cadastra, por etapa, um vídeo do YouTube + uma imagem de
-- exemplo + título/descrição. As telas do wizard exibem dinamicamente
-- (só aparece o que estiver preenchido).
--
-- DECISÕES:
--  - step_key é TEXTO ESTÁVEL (não número), porque o número da etapa
--    já mudou no passado (v5.22.11 removeu a Etapa 2 e renumerou tudo).
--    Usar 'dados-basicos', 'concretos' etc. desacopla da numeração.
--  - youtube_url guarda o que o admin colou; youtube_video_id guarda
--    o ID normalizado (extraído no frontend). Guardar ambos permite
--    reexibir o link original e gerar o embed.
--  - image_path guarda o PATH no Storage bucket (não a URL pública).
--    A URL pública é derivada no frontend via getPublicUrl(). Assim,
--    se o domínio do Storage mudar, nada quebra.
--  - Leitura pública (qualquer usuário do wizard lê via anon).
--    Escrita só is_admin().
--
-- STORAGE:
--  - Bucket 'step-help-images' público (leitura), upload só admin.
--  - Política de upload via RLS na tabela storage.objects.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tabela setup_step_help
-- ---------------------------------------------------------------------
create table if not exists public.setup_step_help (
    id               uuid primary key default gen_random_uuid(),
    step_key         text not null unique,
    youtube_url      text,
    youtube_video_id text,
    image_path       text,            -- path no bucket step-help-images
    help_title       text,
    help_description text,
    enabled          boolean not null default true,
    updated_by       text,
    updated_at       timestamptz not null default now(),
    constraint setup_step_help_step_key_chk
        check (length(trim(step_key)) > 0 and length(step_key) <= 64),
    constraint setup_step_help_title_len
        check (help_title is null or length(help_title) <= 200),
    constraint setup_step_help_desc_len
        check (help_description is null or length(help_description) <= 1000)
);

comment on table public.setup_step_help is
    'Ajuda contextual por etapa do wizard (vídeo YouTube + imagem + texto). v5.22.36.';
comment on column public.setup_step_help.step_key is
    'Chave estável da etapa: dados-basicos, estruturas, concretos, pecas, usuarios, fornecedores, revisao.';
comment on column public.setup_step_help.image_path is
    'Path do objeto no bucket step-help-images. URL pública derivada no frontend.';

-- ---------------------------------------------------------------------
-- 2. RLS
-- ---------------------------------------------------------------------
alter table public.setup_step_help enable row level security;

-- Leitura pública: qualquer usuário do wizard (anon) lê os registros
-- habilitados. Admin lê todos.
drop policy if exists setup_step_help_public_read on public.setup_step_help;
create policy setup_step_help_public_read
    on public.setup_step_help
    for select
    using (enabled = true or public.is_admin());

-- Escrita: só admin (insert/update/delete)
drop policy if exists setup_step_help_admin_insert on public.setup_step_help;
create policy setup_step_help_admin_insert
    on public.setup_step_help
    for insert
    with check (public.is_admin());

drop policy if exists setup_step_help_admin_update on public.setup_step_help;
create policy setup_step_help_admin_update
    on public.setup_step_help
    for update
    using (public.is_admin())
    with check (public.is_admin());

drop policy if exists setup_step_help_admin_delete on public.setup_step_help;
create policy setup_step_help_admin_delete
    on public.setup_step_help
    for delete
    using (public.is_admin());

-- ---------------------------------------------------------------------
-- 3. Trigger updated_at
-- ---------------------------------------------------------------------
create or replace function public.setup_step_help_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists trg_setup_step_help_updated_at on public.setup_step_help;
create trigger trg_setup_step_help_updated_at
    before update on public.setup_step_help
    for each row
    execute function public.setup_step_help_touch_updated_at();

-- ---------------------------------------------------------------------
-- 4. Seed das 7 etapas (vazias, enabled=true)
-- ---------------------------------------------------------------------
-- Idempotente: ON CONFLICT DO NOTHING. Cria os registros vazios para
-- o admin editar. step_key fixos.
insert into public.setup_step_help (step_key, enabled)
values
    ('dados-basicos', true),
    ('estruturas',    true),
    ('concretos',     true),
    ('pecas',         true),
    ('usuarios',      true),
    ('fornecedores',  true),
    ('revisao',       true)
on conflict (step_key) do nothing;

-- ---------------------------------------------------------------------
-- 5. Storage bucket step-help-images
-- ---------------------------------------------------------------------
-- Cria o bucket público (leitura). Idempotente.
insert into storage.buckets (id, name, public)
values ('step-help-images', 'step-help-images', true)
on conflict (id) do nothing;

-- Políticas de Storage:
-- Leitura pública do bucket
drop policy if exists step_help_images_public_read on storage.objects;
create policy step_help_images_public_read
    on storage.objects
    for select
    using (bucket_id = 'step-help-images');

-- Upload/update/delete só admin
drop policy if exists step_help_images_admin_insert on storage.objects;
create policy step_help_images_admin_insert
    on storage.objects
    for insert
    with check (bucket_id = 'step-help-images' and public.is_admin());

drop policy if exists step_help_images_admin_update on storage.objects;
create policy step_help_images_admin_update
    on storage.objects
    for update
    using (bucket_id = 'step-help-images' and public.is_admin())
    with check (bucket_id = 'step-help-images' and public.is_admin());

drop policy if exists step_help_images_admin_delete on storage.objects;
create policy step_help_images_admin_delete
    on storage.objects
    for delete
    using (bucket_id = 'step-help-images' and public.is_admin());
