-- Tabela de frete da loja (/store): preço de balcão dos Correios por estado de
-- destino. Sem contrato com os Correios não há API oficial, então a equipe
-- preenche no Painel (Loja virtual / Tokens → Tabela de frete).
-- Preço = valor até 1 kg + valor por kg adicional (arredonda o kg pra cima).
-- Serviço sem preço (null) = não oferecido para aquele estado.
create table if not exists public.shipping_rates (
  uf text primary key check (uf ~ '^[A-Z]{2}$'),
  pac_price numeric(10,2) check (pac_price >= 0),
  pac_extra_kg numeric(10,2) not null default 0 check (pac_extra_kg >= 0),
  pac_days int check (pac_days >= 0),
  sedex_price numeric(10,2) check (sedex_price >= 0),
  sedex_extra_kg numeric(10,2) not null default 0 check (sedex_extra_kg >= 0),
  sedex_days int check (sedex_days >= 0),
  updated_at timestamptz not null default now()
);

alter table public.shipping_rates enable row level security;

drop policy if exists "shipping_rates public read" on public.shipping_rates;
create policy "shipping_rates public read" on public.shipping_rates
  for select using (true);

drop policy if exists "shipping_rates panel update" on public.shipping_rates;
create policy "shipping_rates panel update" on public.shipping_rates
  for update using (is_master() or has_permission('tokens'))
  with check (is_master() or has_permission('tokens'));

insert into public.shipping_rates (uf)
select unnest(array['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB',
                    'PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'])
on conflict (uf) do nothing;
