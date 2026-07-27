-- Personalization Studio — schema inicial (Supabase / Postgres)
-- Rode este arquivo inteiro no SQL Editor do seu projeto Supabase antes do seed.sql.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------------

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique
);

create table if not exists subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories (id) on delete cascade,
  name text not null,
  slug text not null unique
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  -- um produto pertence a UMA subcategoria (ex: Garrafas Térmicas) OU direto a
  -- uma categoria sem subcategoria (ex: Capas Personalizadas) — os dois são
  -- opcionais aqui de propósito, preenche o que fizer sentido pro produto.
  category_id uuid references categories (id) on delete set null,
  subcategory_id uuid references subcategories (id) on delete set null,
  name text not null,
  slug text not null unique,
  base_price numeric(10, 2) not null,
  description text,
  cover_image_url text,
  personalization_area jsonb,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists product_colors (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  name text not null,
  hex text not null,
  image_url text,
  sort_order int not null default 0
);

create table if not exists product_sizes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  name text not null,
  sort_order int not null default 0
);

create table if not exists product_models (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  name text not null,
  sort_order int not null default 0
);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on products;
create trigger products_set_updated_at
  before update on products
  for each row
  execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Pontos de venda (revendedores/parceiros) e pedidos
-- ---------------------------------------------------------------------------

create table if not exists resellers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  phone text,
  email text,
  commission_rate numeric(5, 2) not null default 0,
  status text not null default 'active' check (status in ('active', 'inactive')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default (
    'PED-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::text, 1, 8))
  ),
  customer_name text not null,
  customer_contact text,
  reseller_id uuid references resellers (id) on delete set null,
  product_id uuid references products (id) on delete set null,
  color_id uuid references product_colors (id) on delete set null,
  size_id uuid references product_sizes (id) on delete set null,
  model_id uuid references product_models (id) on delete set null,
  quantity int not null default 1,
  personalization_snapshot jsonb,
  personalization_fee numeric(10, 2) not null default 0,
  unit_price numeric(10, 2) not null,
  line_total numeric(10, 2) not null,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'producing', 'shipped', 'completed', 'canceled')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Perfis de usuário (só "master" por enquanto — deixa espaço pra outros papéis depois)
-- ---------------------------------------------------------------------------

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'master' check (role in ('master')),
  created_at timestamptz not null default now()
);

create or replace function is_master()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'master'
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table categories enable row level security;
alter table subcategories enable row level security;
alter table products enable row level security;
alter table product_colors enable row level security;
alter table product_sizes enable row level security;
alter table product_models enable row level security;
alter table resellers enable row level security;
alter table orders enable row level security;
alter table profiles enable row level security;

-- Catálogo: leitura pública (a vitrine não exige login), escrita só pro master.
-- Todo "create policy" aqui vem precedido de "drop policy if exists" pra esse
-- arquivo inteiro poder ser rodado de novo do zero, sem erro de "already exists".
drop policy if exists "catalog public read" on categories;
create policy "catalog public read" on categories for select using (true);
drop policy if exists "catalog master write" on categories;
create policy "catalog master write" on categories for all using (is_master()) with check (is_master());

drop policy if exists "catalog public read" on subcategories;
create policy "catalog public read" on subcategories for select using (true);
drop policy if exists "catalog master write" on subcategories;
create policy "catalog master write" on subcategories for all using (is_master()) with check (is_master());

drop policy if exists "catalog public read" on products;
create policy "catalog public read" on products for select using (true);
drop policy if exists "catalog master write" on products;
create policy "catalog master write" on products for all using (is_master()) with check (is_master());

drop policy if exists "catalog public read" on product_colors;
create policy "catalog public read" on product_colors for select using (true);
drop policy if exists "catalog master write" on product_colors;
create policy "catalog master write" on product_colors for all using (is_master()) with check (is_master());

drop policy if exists "catalog public read" on product_sizes;
create policy "catalog public read" on product_sizes for select using (true);
drop policy if exists "catalog master write" on product_sizes;
create policy "catalog master write" on product_sizes for all using (is_master()) with check (is_master());

drop policy if exists "catalog public read" on product_models;
create policy "catalog public read" on product_models for select using (true);
drop policy if exists "catalog master write" on product_models;
create policy "catalog master write" on product_models for all using (is_master()) with check (is_master());

-- Revendedores e pedidos: só o master enxerga e mexe.
drop policy if exists "resellers master only" on resellers;
create policy "resellers master only" on resellers for all using (is_master()) with check (is_master());
drop policy if exists "orders master only" on orders;
create policy "orders master only" on orders for all using (is_master()) with check (is_master());

-- Perfis: cada usuário só lê o próprio perfil (usado pra checar o papel no login).
drop policy if exists "profiles self read" on profiles;
create policy "profiles self read" on profiles for select using (auth.uid() = id);
-- Master também enxerga todos os perfis (usado pra saber se uma unidade já
-- tem login criado, no formulário de Revendedores).
drop policy if exists "profiles master read" on profiles;
create policy "profiles master read" on profiles for select using (is_master());

-- ---------------------------------------------------------------------------
-- Marcas + flags do Visualizador 3D (painel de gerenciamento de produtos)
-- ---------------------------------------------------------------------------

create table if not exists brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique
);

alter table brands enable row level security;

drop policy if exists "catalog public read" on brands;
create policy "catalog public read" on brands for select using (true);
drop policy if exists "catalog master write" on brands;
create policy "catalog master write" on brands for all using (is_master()) with check (is_master());

alter table products add column if not exists brand_id uuid references brands (id) on delete set null;
alter table products add column if not exists has_3d_viewer boolean not null default false;
alter table products add column if not exists model_3d_url text;

-- Catálogo global de modelos por marca (ex: Apple → iPhone 14, iPhone 15 Pro),
-- usado como lista de sugestão no formulário de produto. Independente dos
-- modelos de fato salvos em cada produto (tabela product_models).
create table if not exists brand_models (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands (id) on delete cascade,
  name text not null,
  unique (brand_id, name)
);

-- Prévia (2 imagens) do modelo — cadastrada uma vez aqui, reaproveitada em
-- qualquer produto que use esse modelo (sugestão de tamanho: 331x590px).
alter table brand_models add column if not exists mockup_image_url text;
alter table brand_models add column if not exists mask_image_url text;

alter table brand_models enable row level security;

drop policy if exists "catalog public read" on brand_models;
create policy "catalog public read" on brand_models for select using (true);
drop policy if exists "catalog master write" on brand_models;
create policy "catalog master write" on brand_models for all using (is_master()) with check (is_master());

-- Marca de cada modelo dentro de um produto (ex: Capa Personalizada aceita
-- modelos da Apple e da Samsung ao mesmo tempo) — permite o Studio mostrar
-- um seletor de Marca que filtra o Modelo por hierarquia.
alter table product_models add column if not exists brand_id uuid references brands (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Marca/Modelo como catálogo global no Studio (sem curadoria por produto)
-- ---------------------------------------------------------------------------

alter table products add column if not exists uses_device_models boolean not null default false;

-- Produtos que já tinham modelos curados manualmente (fluxo antigo) migram
-- automaticamente pra usar o catálogo global, sem perder a funcionalidade.
update products set uses_device_models = true
where id in (select distinct product_id from product_models);

-- orders.model_id passa a apontar pro catálogo global de modelos
-- (brand_models), já que o Studio não usa mais product_models pra isso.
-- product_models continua existindo (não é apagada), só vira legado.
alter table orders drop constraint if exists orders_model_id_fkey;
alter table orders add constraint orders_model_id_fkey
  foreign key (model_id) references brand_models (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Variação por Modelo: estoque por Produto+Modelo
-- (mockup/máscara ficam em brand_models — ver acima — reaproveitados por
-- qualquer produto; só o estoque é mesmo por produto)
-- ---------------------------------------------------------------------------

create table if not exists product_model_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  brand_model_id uuid not null references brand_models (id) on delete cascade,
  stock_quantity int not null default 0,
  created_at timestamptz not null default now(),
  unique (product_id, brand_model_id)
);

alter table product_model_variants drop column if exists mockup_image_url;
alter table product_model_variants drop column if exists mask_image_url;

alter table product_model_variants enable row level security;

drop policy if exists "catalog public read" on product_model_variants;
create policy "catalog public read" on product_model_variants for select using (true);
drop policy if exists "catalog master write" on product_model_variants;
create policy "catalog master write" on product_model_variants for all using (is_master()) with check (is_master());

-- Checkout via função security definer: permite cliente anônimo finalizar
-- pedido (orders hoje só tem policy de escrita pro master) e desconta o
-- estoque do modelo escolhido de forma atômica, sem abrir INSERT/UPDATE
-- público direto nas tabelas.
create or replace function place_order(order_rows jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  row_data jsonb;
begin
  for row_data in select * from jsonb_array_elements(order_rows) loop
    insert into orders (
      customer_name, customer_contact, reseller_id, product_id, color_id, size_id, model_id,
      quantity, personalization_snapshot, personalization_fee, unit_price, line_total
    ) values (
      row_data->>'customer_name', row_data->>'customer_contact',
      nullif(row_data->>'reseller_id','')::uuid, nullif(row_data->>'product_id','')::uuid,
      nullif(row_data->>'color_id','')::uuid, nullif(row_data->>'size_id','')::uuid,
      nullif(row_data->>'model_id','')::uuid, (row_data->>'quantity')::int,
      row_data->'personalization_snapshot', (row_data->>'personalization_fee')::numeric,
      (row_data->>'unit_price')::numeric, (row_data->>'line_total')::numeric
    );

    if row_data->>'model_id' is not null then
      update product_model_variants
      set stock_quantity = greatest(stock_quantity - (row_data->>'quantity')::int, 0)
      where product_id = (row_data->>'product_id')::uuid
        and brand_model_id = (row_data->>'model_id')::uuid;
    end if;
  end loop;
end;
$$;

grant execute on function place_order(jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Login por unidade (revendedor): cada loja/vendedor loga com usuário/senha
-- pra acessar o Studio, e essa identidade é quem grava reseller_id no pedido.
-- ---------------------------------------------------------------------------

alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('master', 'reseller'));
alter table profiles add column if not exists reseller_id uuid references resellers (id) on delete set null;

create or replace function current_reseller_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select reseller_id from profiles where id = auth.uid();
$$;

-- Usuário reseller consegue ler a própria unidade (nome exibido no Header);
-- master continua enxergando todas (policy "resellers master only" já cobre).
drop policy if exists "resellers self read" on resellers;
create policy "resellers self read" on resellers for select using (is_master() or id = current_reseller_id());

-- ---------------------------------------------------------------------------
-- Pedido completo: prévia do Studio + zip das imagens originais em qualidade
-- ---------------------------------------------------------------------------

alter table orders add column if not exists preview_image_url text;
alter table orders add column if not exists original_files_zip_url text;
-- Arte montada do cliente (sem mockup/máscara, fundo transparente) — a
-- produção usa direto, sem remontar o layout.
alter table orders add column if not exists art_image_url text;
-- "Carimbo" do nome da unidade no pedido — exibe no painel sem depender de
-- RLS/join na tabela de revendedores (staff de pedidos não lê resellers).
alter table orders add column if not exists reseller_name text;

create or replace function place_order(order_rows jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  row_data jsonb;
  v_reseller_id uuid;
begin
  for row_data in select * from jsonb_array_elements(order_rows) loop
    v_reseller_id := nullif(row_data->>'reseller_id','')::uuid;
    insert into orders (
      customer_name, customer_contact, reseller_id, reseller_name, product_id, color_id, size_id, model_id,
      quantity, personalization_snapshot, personalization_fee, unit_price, line_total,
      preview_image_url, original_files_zip_url, art_image_url
    ) values (
      row_data->>'customer_name', row_data->>'customer_contact',
      v_reseller_id, (select name from resellers where id = v_reseller_id),
      nullif(row_data->>'product_id','')::uuid,
      nullif(row_data->>'color_id','')::uuid, nullif(row_data->>'size_id','')::uuid,
      nullif(row_data->>'model_id','')::uuid, (row_data->>'quantity')::int,
      row_data->'personalization_snapshot', (row_data->>'personalization_fee')::numeric,
      (row_data->>'unit_price')::numeric, (row_data->>'line_total')::numeric,
      row_data->>'preview_image_url', row_data->>'original_files_zip_url', row_data->>'art_image_url'
    );

    if row_data->>'model_id' is not null then
      update product_model_variants
      set stock_quantity = greatest(stock_quantity - (row_data->>'quantity')::int, 0)
      where product_id = (row_data->>'product_id')::uuid
        and brand_model_id = (row_data->>'model_id')::uuid;
    end if;
  end loop;
end;
$$;

grant execute on function place_order(jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Numeração sequencial do pedido (#0001, #0002...) + status simplificado
-- ---------------------------------------------------------------------------

-- order_number continua existindo (chave única com data+hash), mas a loja
-- acompanha pelo número sequencial, mais fácil de falar/digitar.
create sequence if not exists orders_sequence_number_seq;

alter table orders add column if not exists sequence_number int;

with numbered as (
  select id, row_number() over (order by created_at) as rn
  from orders
  where sequence_number is null
)
update orders set sequence_number = numbered.rn
from numbered
where orders.id = numbered.id;

select setval('orders_sequence_number_seq', coalesce((select max(sequence_number) from orders), 0));

alter table orders alter column sequence_number set default nextval('orders_sequence_number_seq');
alter table orders alter column sequence_number set not null;
alter table orders drop constraint if exists orders_sequence_number_key;
alter table orders add constraint orders_sequence_number_key unique (sequence_number);

-- Fluxo é de retirada na loja (sem etapa de envio separada), então fica só
-- Pendente / Em produção / Concluído / Cancelado.
alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check
  check (status in ('pending', 'producing', 'completed', 'canceled'));

-- Todo pedido novo já nasce "Em produção" — a loja monitora e só marca
-- Pendente se travar por algum motivo.
alter table orders alter column status set default 'producing';

-- Reseller enxerga só os próprios pedidos (master já enxerga todos via
-- "orders master only").
drop policy if exists "orders reseller read own" on orders;
create policy "orders reseller read own" on orders for select using (reseller_id = current_reseller_id());

-- ---------------------------------------------------------------------------
-- Usuários do Painel: papel "staff" com permissões por seção
-- ---------------------------------------------------------------------------

-- staff = usuário do painel abaixo do master, com acesso só às seções que o
-- master liberar (permissions). O master enxerga/faz tudo.
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('master', 'reseller', 'staff'));
alter table profiles add column if not exists permissions text[] not null default '{}';
alter table profiles add column if not exists email text;

-- Espelha is_master(): true se master, ou staff com a seção na lista.
create or replace function has_permission(section text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and (role = 'master' or (role = 'staff' and section = any(permissions)))
  );
$$;

-- Escrita das seções passa a aceitar master OU staff com a permissão da seção.
-- (Leitura do catálogo continua pública; leitura de pedidos/revendedores é
-- coberta pela própria policy ALL abaixo.)
drop policy if exists "orders master only" on orders;
create policy "orders master only" on orders for all
  using (is_master() or has_permission('orders'))
  with check (is_master() or has_permission('orders'));

drop policy if exists "catalog master write" on products;
create policy "catalog master write" on products for all
  using (is_master() or has_permission('products')) with check (is_master() or has_permission('products'));
drop policy if exists "catalog master write" on product_colors;
create policy "catalog master write" on product_colors for all
  using (is_master() or has_permission('products')) with check (is_master() or has_permission('products'));
drop policy if exists "catalog master write" on product_sizes;
create policy "catalog master write" on product_sizes for all
  using (is_master() or has_permission('products')) with check (is_master() or has_permission('products'));
drop policy if exists "catalog master write" on categories;
create policy "catalog master write" on categories for all
  using (is_master() or has_permission('products')) with check (is_master() or has_permission('products'));
drop policy if exists "catalog master write" on subcategories;
create policy "catalog master write" on subcategories for all
  using (is_master() or has_permission('products')) with check (is_master() or has_permission('products'));
drop policy if exists "catalog master write" on brands;
create policy "catalog master write" on brands for all
  using (is_master() or has_permission('products')) with check (is_master() or has_permission('products'));
drop policy if exists "catalog master write" on brand_models;
create policy "catalog master write" on brand_models for all
  using (is_master() or has_permission('products')) with check (is_master() or has_permission('products'));
drop policy if exists "catalog master write" on product_model_variants;
create policy "catalog master write" on product_model_variants for all
  using (is_master() or has_permission('products')) with check (is_master() or has_permission('products'));

drop policy if exists "resellers master only" on resellers;
create policy "resellers master only" on resellers for all
  using (is_master() or has_permission('resellers'))
  with check (is_master() or has_permission('resellers'));

-- ---------------------------------------------------------------------------
-- Integração de estoque com o Bling (ERP)
-- ---------------------------------------------------------------------------

-- Térmicos: estoque por produto+cor (capas já têm estoque por produto+modelo
-- em product_model_variants). bling_sku = código do item no Bling (mapeamento).
alter table product_colors add column if not exists stock_quantity int;
alter table product_colors add column if not exists bling_sku text;
alter table product_model_variants add column if not exists bling_sku text;

