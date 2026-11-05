-- Descontos de atacado da loja virtual, por produto: a partir de X unidades, Y% de desconto.
-- Editados no Painel → Loja virtual → Preços e descontos.
create table if not exists public.store_price_tiers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  min_qty integer not null check (min_qty >= 2),
  discount_pct numeric(5,2) not null check (discount_pct > 0 and discount_pct < 100),
  created_at timestamptz not null default now(),
  constraint store_price_tiers_product_qty_key unique (product_id, min_qty)
);

alter table public.store_price_tiers enable row level security;

create policy "store_price_tiers public read" on public.store_price_tiers
  for select using (true);

create policy "store_price_tiers panel write" on public.store_price_tiers
  for all using (is_master() or has_permission('tokens'))
  with check (is_master() or has_permission('tokens'));
