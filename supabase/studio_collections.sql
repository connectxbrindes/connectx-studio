-- Coleções do Studio: artes prontas (estampas, temas, datas) que o cliente
-- escolhe no passo Personalizar pelo botão "Coleções" e aplica no produto.
-- Cadastradas no Painel → Studio → Coleções (permissão 'studio').

create table if not exists public.studio_collections (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.studio_collection_images (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.studio_collections(id) on delete cascade,
  name text not null default '',
  image_url text not null,
  storage_path text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists studio_collection_images_collection_idx
  on public.studio_collection_images (collection_id, sort_order, created_at);

alter table public.studio_collections enable row level security;
alter table public.studio_collection_images enable row level security;

drop policy if exists "studio_collections public read" on public.studio_collections;
create policy "studio_collections public read" on public.studio_collections
  for select using (active or is_master() or has_permission('studio'));
drop policy if exists "studio_collections panel write" on public.studio_collections;
create policy "studio_collections panel write" on public.studio_collections
  for all using (is_master() or has_permission('studio'))
  with check (is_master() or has_permission('studio'));

drop policy if exists "studio_collection_images public read" on public.studio_collection_images;
create policy "studio_collection_images public read" on public.studio_collection_images
  for select using (true);
drop policy if exists "studio_collection_images panel write" on public.studio_collection_images;
create policy "studio_collection_images panel write" on public.studio_collection_images
  for all using (is_master() or has_permission('studio'))
  with check (is_master() or has_permission('studio'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('studio-collections', 'studio-collections', true, 15728640,
        array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif'])
on conflict (id) do nothing;

drop policy if exists "studio collections files read" on storage.objects;
create policy "studio collections files read" on storage.objects for select
  using (bucket_id = 'studio-collections');
drop policy if exists "studio collections files insert" on storage.objects;
create policy "studio collections files insert" on storage.objects for insert
  with check (bucket_id = 'studio-collections' and (is_master() or has_permission('studio')));
drop policy if exists "studio collections files delete" on storage.objects;
create policy "studio collections files delete" on storage.objects for delete
  using (bucket_id = 'studio-collections' and (is_master() or has_permission('studio')));

-- Categorias onde a coleção aparece (vazio = todas).
alter table public.studio_collections
  add column if not exists category_ids uuid[] not null default '{}';
