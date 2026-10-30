-- Loja virtual (/store) + campanha de tokens de brinde.
-- Aplicado em produção via MCP (migration "store_campaign_tokens").
--
-- - store_customers: cadastro do cliente de varejo (1:1 com auth.users).
--   Cliente de varejo NÃO tem linha em `profiles`, então não acessa Studio/Painel.
-- - campaign_token_batches / campaign_tokens: lotes de tokens gerados no Painel,
--   cada lote vale para um ou mais produtos. Token é de uso único.
-- - place_store_order: grava o pedido da loja, recalcula preços no servidor,
--   consome o token (brinde = 1 unidade grátis) e aplica 10% nos demais itens.

alter table orders add column if not exists channel text not null default 'studio';
alter table orders add column if not exists customer_user_id uuid references auth.users(id) on delete set null;
alter table orders add column if not exists token_code text;
alter table orders add column if not exists discount_amount numeric not null default 0;

create table if not exists store_customers (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table store_customers enable row level security;
create policy "store_customers self read" on store_customers for select using (id = auth.uid());
create policy "store_customers panel read" on store_customers for select using (is_master() or has_permission('orders'));

create table if not exists campaign_token_batches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  product_ids uuid[] not null,
  quantity int not null,
  prefix text,
  code_length int not null,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table campaign_token_batches enable row level security;
create policy "token batches panel read" on campaign_token_batches for select using (is_master() or has_permission('tokens'));
create policy "token batches panel update" on campaign_token_batches for update
  using (is_master() or has_permission('tokens')) with check (is_master() or has_permission('tokens'));

create table if not exists campaign_tokens (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references campaign_token_batches(id) on delete cascade,
  code text not null unique,
  status text not null default 'active' check (status in ('active', 'used', 'inactive')),
  used_at timestamptz,
  used_by uuid references auth.users(id) on delete set null,
  used_order_number text,
  created_at timestamptz not null default now()
);
create index if not exists campaign_tokens_batch_idx on campaign_tokens(batch_id);
alter table campaign_tokens enable row level security;
create policy "tokens panel read" on campaign_tokens for select using (is_master() or has_permission('tokens'));
create policy "tokens panel update" on campaign_tokens for update
  using (is_master() or has_permission('tokens')) with check (is_master() or has_permission('tokens'));

-- Cliente da loja enxerga os próprios pedidos.
create policy "orders store customer read own" on orders for select using (customer_user_id = auth.uid());

-- Normaliza o que o cliente digita: maiúsculas, sem espaços/hífens.
create or replace function normalize_token_code(p_code text)
returns text language sql immutable as $$
  select nullif(upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')), '');
$$;

-- Gera um lote de tokens (Painel). Alfabeto sem caracteres ambíguos (0/O, 1/I).
create or replace function generate_campaign_tokens(
  p_name text, p_product_ids uuid[], p_quantity int, p_prefix text default null, p_length int default 8
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_prefix text := normalize_token_code(p_prefix);
  v_batch uuid;
  v_created int := 0;
  v_attempts int := 0;
  v_bytes bytea;
  v_code text;
  i int;
begin
  if not (is_master() or has_permission('tokens')) then raise exception 'SEM_PERMISSAO'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'NOME_OBRIGATORIO'; end if;
  if p_product_ids is null or cardinality(p_product_ids) = 0 then raise exception 'PRODUTO_OBRIGATORIO'; end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 10000 then raise exception 'QUANTIDADE_INVALIDA'; end if;
  if p_length is null or p_length < 6 or p_length > 16 then raise exception 'TAMANHO_INVALIDO'; end if;
  if v_prefix is not null and length(v_prefix) > 6 then raise exception 'PREFIXO_INVALIDO'; end if;

  insert into campaign_token_batches (name, product_ids, quantity, prefix, code_length, created_by)
  values (trim(p_name), p_product_ids, p_quantity, v_prefix, p_length, auth.uid())
  returning id into v_batch;

  while v_created < p_quantity loop
    v_attempts := v_attempts + 1;
    if v_attempts > p_quantity * 5 + 100 then raise exception 'FALHA_AO_GERAR'; end if;
    v_bytes := gen_random_bytes(p_length);
    v_code := coalesce(v_prefix, '');
    for i in 0 .. p_length - 1 loop
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
    end loop;
    insert into campaign_tokens (batch_id, code) values (v_batch, v_code) on conflict (code) do nothing;
    if found then v_created := v_created + 1; end if;
  end loop;

  return v_batch;
end;
$$;
revoke execute on function generate_campaign_tokens(text, uuid[], int, text, int) from public, anon;
grant execute on function generate_campaign_tokens(text, uuid[], int, text, int) to authenticated;

-- Checagem pública (loja): o token existe, está ativo e vale pra quais produtos.
create or replace function check_campaign_token(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_token campaign_tokens%rowtype;
  v_batch campaign_token_batches%rowtype;
begin
  select * into v_token from campaign_tokens where code = normalize_token_code(p_code);
  if not found then return jsonb_build_object('valid', false, 'reason', 'TOKEN_INVALIDO'); end if;
  if v_token.status = 'used' then return jsonb_build_object('valid', false, 'reason', 'TOKEN_JA_USADO'); end if;
  select * into v_batch from campaign_token_batches where id = v_token.batch_id;
  if v_token.status <> 'active' or not v_batch.active then
    return jsonb_build_object('valid', false, 'reason', 'TOKEN_INATIVO');
  end if;
  return jsonb_build_object(
    'valid', true,
    'code', v_token.code,
    'product_ids', to_jsonb(v_batch.product_ids),
    'product_names', (select coalesce(jsonb_agg(name order by name), '[]'::jsonb) from products where id = any(v_batch.product_ids))
  );
end;
$$;
grant execute on function check_campaign_token(text) to anon, authenticated;

-- Produtos que fazem parte da campanha (lotes ativos) — usado pelo pop-up de 10%.
create or replace function campaign_product_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select distinct unnest(product_ids) from campaign_token_batches where active;
$$;
grant execute on function campaign_product_ids() to anon, authenticated;

-- Pedido da loja virtual. Preço recalculado aqui (base_price + taxa de
-- personalização) — o valor enviado pelo navegador é ignorado.
create or replace function place_store_order(order_rows jsonb, p_token text, p_customer jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c_personalization_fee constant numeric := 19.90; -- igual a PERSONALIZATION_FEE (src/utils/price.js)
  c_extra_discount constant numeric := 0.10;
  v_uid uuid := auth.uid();
  v_name text := nullif(trim(p_customer->>'name'), '');
  v_phone text := nullif(trim(p_customer->>'phone'), '');
  v_note text := nullif(trim(p_customer->>'note'), '');
  v_email text;
  v_code text := normalize_token_code(p_token);
  v_token campaign_tokens%rowtype;
  v_batch campaign_token_batches%rowtype;
  v_gift_idx int;
  r record;
  v_product products%rowtype;
  v_qty int;
  v_fee numeric;
  v_gross numeric;
  v_disc numeric;
  v_total numeric;
  v_order_number text;
  v_gift_order text;
  v_numbers text[] := '{}';
  v_sum numeric := 0;
  v_sum_disc numeric := 0;
begin
  if v_uid is null then raise exception 'NAO_AUTENTICADO'; end if;
  if jsonb_typeof(order_rows) <> 'array' or jsonb_array_length(order_rows) = 0 then raise exception 'CARRINHO_VAZIO'; end if;
  if v_name is null then raise exception 'NOME_OBRIGATORIO'; end if;

  select email into v_email from auth.users where id = v_uid;
  insert into store_customers (id, name, email, phone) values (v_uid, v_name, v_email, v_phone)
  on conflict (id) do update set name = excluded.name, email = excluded.email,
    phone = coalesce(excluded.phone, store_customers.phone), updated_at = now();

  if v_code is not null then
    select * into v_token from campaign_tokens where code = v_code for update;
    if not found then raise exception 'TOKEN_INVALIDO'; end if;
    if v_token.status = 'used' then raise exception 'TOKEN_JA_USADO'; end if;
    select * into v_batch from campaign_token_batches where id = v_token.batch_id;
    if v_token.status <> 'active' or not v_batch.active then raise exception 'TOKEN_INATIVO'; end if;

    select (ordinality - 1)::int into v_gift_idx
    from jsonb_array_elements(order_rows) with ordinality
    where nullif(value->>'product_id', '')::uuid = any(v_batch.product_ids)
    order by ordinality limit 1;
    if v_gift_idx is null then raise exception 'TOKEN_PRODUTO_AUSENTE'; end if;
  end if;

  for r in select value as d, (ordinality - 1)::int as i from jsonb_array_elements(order_rows) with ordinality loop
    select * into v_product from products where id = nullif(r.d->>'product_id', '')::uuid and status = 'active';
    if not found then raise exception 'PRODUTO_INDISPONIVEL'; end if;

    v_qty := greatest(coalesce((r.d->>'quantity')::int, 1), 1);
    v_fee := case when jsonb_typeof(r.d->'personalization_snapshot') = 'array'
                   and jsonb_array_length(r.d->'personalization_snapshot') > 0
              then c_personalization_fee else 0 end;
    v_gross := (v_product.base_price + v_fee) * v_qty;
    if v_gift_idx is not null and r.i = v_gift_idx then
      v_disc := v_product.base_price + v_fee;              -- 1 unidade grátis (brinde)
    elsif v_gift_idx is not null then
      v_disc := round(v_gross * c_extra_discount, 2);      -- 10% nos demais itens
    else
      v_disc := 0;
    end if;
    v_total := v_gross - v_disc;

    insert into orders (
      customer_name, customer_contact, customer_note, reseller_id, reseller_name,
      product_id, color_id, size_id, model_id, quantity, personalization_snapshot,
      personalization_fee, unit_price, line_total, preview_image_url, original_files_zip_url, art_image_url,
      status, channel, customer_user_id, token_code, discount_amount
    ) values (
      v_name, concat_ws(' · ', v_phone, v_email),
      concat_ws(E'\n',
        case when v_gift_idx is not null and r.i = v_gift_idx then 'BRINDE — token ' || v_code
             when v_gift_idx is not null then 'Desconto campanha 10% (token ' || v_code || ')' end,
        v_note),
      null, 'Loja Virtual',
      v_product.id, nullif(r.d->>'color_id', '')::uuid, nullif(r.d->>'size_id', '')::uuid,
      nullif(r.d->>'model_id', '')::uuid, v_qty, r.d->'personalization_snapshot',
      v_fee, v_product.base_price, v_total,
      r.d->>'preview_image_url', r.d->>'original_files_zip_url', r.d->>'art_image_url',
      -- Item 100% brinde vai direto pra produção; item com valor fica Pendente
      -- até o pagamento (integração de pagamento vem na próxima etapa).
      case when v_total = 0 then 'producing' else 'pending' end,
      'store', v_uid, case when v_gift_idx is not null then v_code end, v_disc
    ) returning order_number into v_order_number;

    v_numbers := v_numbers || v_order_number;
    v_sum := v_sum + v_total;
    v_sum_disc := v_sum_disc + v_disc;
    if v_gift_idx is not null and r.i = v_gift_idx then v_gift_order := v_order_number; end if;

    if nullif(r.d->>'model_id', '') is not null then
      update product_model_variants
      set stock_quantity = greatest(stock_quantity - v_qty, 0)
      where product_id = v_product.id and brand_model_id = (r.d->>'model_id')::uuid;
    end if;
  end loop;

  if v_gift_idx is not null then
    update campaign_tokens set status = 'used', used_at = now(), used_by = v_uid, used_order_number = v_gift_order
    where id = v_token.id;
  end if;

  return jsonb_build_object('order_numbers', to_jsonb(v_numbers), 'total', v_sum, 'discount', v_sum_disc);
end;
$$;
revoke execute on function place_store_order(jsonb, text, jsonb) from public, anon;
grant execute on function place_store_order(jsonb, text, jsonb) to authenticated;

-- Resumo dos lotes pro Painel (contagem de usados/ativos/inativos).
create or replace function campaign_token_batch_stats()
returns table (id uuid, name text, product_ids uuid[], product_names text[], quantity int, prefix text, code_length int,
               active boolean, created_at timestamptz, used_count bigint, active_count bigint, inactive_count bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (is_master() or has_permission('tokens')) then raise exception 'SEM_PERMISSAO'; end if;
  return query
  select b.id, b.name, b.product_ids,
         array(select p.name from products p where p.id = any(b.product_ids) order by p.name),
         b.quantity, b.prefix, b.code_length, b.active, b.created_at,
         count(t.id) filter (where t.status = 'used'),
         count(t.id) filter (where t.status = 'active'),
         count(t.id) filter (where t.status = 'inactive')
  from campaign_token_batches b
  left join campaign_tokens t on t.batch_id = b.id
  group by b.id
  order by b.created_at desc;
end;
$$;
revoke execute on function campaign_token_batch_stats() from public, anon;
grant execute on function campaign_token_batch_stats() to authenticated;
