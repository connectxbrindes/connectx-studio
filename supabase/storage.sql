-- Bucket de imagens de produto/cor, usado pelo formulário de produtos no /admin.
-- Rode depois de schema.sql (precisa da função is_master()).

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "product images public read" on storage.objects;
create policy "product images public read" on storage.objects
  for select using (bucket_id = 'product-images');

drop policy if exists "product images master insert" on storage.objects;
create policy "product images master insert" on storage.objects
  for insert with check (bucket_id = 'product-images' and (is_master() or has_permission('products')));

drop policy if exists "product images master update" on storage.objects;
create policy "product images master update" on storage.objects
  for update using (bucket_id = 'product-images' and (is_master() or has_permission('products')));

drop policy if exists "product images master delete" on storage.objects;
create policy "product images master delete" on storage.objects
  for delete using (bucket_id = 'product-images' and (is_master() or has_permission('products')));

-- Bucket dos arquivos 3D (.obj) do Visualizador 3D do Studio.

insert into storage.buckets (id, name, public)
values ('product-models-3d', 'product-models-3d', true)
on conflict (id) do nothing;

drop policy if exists "product models 3d public read" on storage.objects;
create policy "product models 3d public read" on storage.objects
  for select using (bucket_id = 'product-models-3d');

drop policy if exists "product models 3d master insert" on storage.objects;
create policy "product models 3d master insert" on storage.objects
  for insert with check (bucket_id = 'product-models-3d' and (is_master() or has_permission('products')));

drop policy if exists "product models 3d master update" on storage.objects;
create policy "product models 3d master update" on storage.objects
  for update using (bucket_id = 'product-models-3d' and (is_master() or has_permission('products')));

drop policy if exists "product models 3d master delete" on storage.objects;
create policy "product models 3d master delete" on storage.objects
  for delete using (bucket_id = 'product-models-3d' and (is_master() or has_permission('products')));

-- Bucket das imagens originais (qualidade máxima) e prévias geradas pelo
-- Studio, anexadas a cada pedido. Depois do login por unidade, não existe
-- mais checkout anônimo — só usuário autenticado (master ou reseller) sobe
-- arquivo aqui.

insert into storage.buckets (id, name, public)
values ('order-assets', 'order-assets', true)
on conflict (id) do nothing;

drop policy if exists "order assets public read" on storage.objects;
create policy "order assets public read" on storage.objects
  for select using (bucket_id = 'order-assets');

drop policy if exists "order assets authenticated insert" on storage.objects;
create policy "order assets authenticated insert" on storage.objects
  for insert with check (bucket_id = 'order-assets' and auth.role() = 'authenticated');
