-- Banners da vitrine da loja virtual (/store), cadastrados no Painel.
-- Aplicado em produção via MCP (migration "store_banners").
--
-- layout 'image'   = banner pronto (arte inteira), com imagem para celular opcional.
-- layout 'product' = texto + foto do produto num círculo (montado pela vitrine).

create table if not exists store_banners (
  id uuid primary key default gen_random_uuid(),
  layout text not null default 'image' check (layout in ('image', 'product')),
  title text,
  eyebrow text,
  text text,
  cta_label text,
  link text,
  image_url text,
  mobile_image_url text,
  theme text not null default 'coral' check (theme in ('coral', 'blue', 'dark', 'light')),
  sort_order int not null default 0,
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table store_banners enable row level security;

-- Público vê só os ativos dentro do período.
create policy "store_banners public read" on store_banners for select using (
  active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())
);
create policy "store_banners panel read" on store_banners for select using (is_master() or has_permission('tokens'));
create policy "store_banners panel insert" on store_banners for insert with check (is_master() or has_permission('tokens'));
create policy "store_banners panel update" on store_banners for update
  using (is_master() or has_permission('tokens')) with check (is_master() or has_permission('tokens'));
create policy "store_banners panel delete" on store_banners for delete using (is_master() or has_permission('tokens'));

-- Upload das artes: pasta banners/ do bucket product-images (já é público pra leitura).
create policy "banner images panel insert" on storage.objects for insert with check (
  bucket_id = 'product-images' and name like 'banners/%' and (is_master() or has_permission('tokens'))
);
