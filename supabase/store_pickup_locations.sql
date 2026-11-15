-- Loja virtual: retirada em uma das unidades (escolhida no carrinho).
-- A unidade escolhida aparece no Painel → Pedidos (coluna Unidade) e na
-- observação do pedido.

create table if not exists public.store_pickup_locations (
  id text primary key,
  name text not null,
  address text not null,
  sort_order int not null default 0,
  active boolean not null default true
);

alter table public.store_pickup_locations enable row level security;
drop policy if exists "store_pickup_locations public read" on public.store_pickup_locations;
create policy "store_pickup_locations public read" on public.store_pickup_locations
  for select using (active or is_master());
drop policy if exists "store_pickup_locations master write" on public.store_pickup_locations;
create policy "store_pickup_locations master write" on public.store_pickup_locations
  for all using (is_master()) with check (is_master());

insert into public.store_pickup_locations (id, name, address, sort_order) values
  ('jk', 'KingCase JK', 'Av. Pres. Juscelino K. de Oliveira, 800 - Loja 101 (Anexo Muffato JK)', 1),
  ('espanha', 'KingCase Espanha', 'Rua Espanha, 583 - Bom Jardim', 2),
  ('compre-mix', 'KingCase Compre Mix', 'Av. Jorn. Roberto Marinho, 3239 - Jardim Veneza (Anexo CompreMix)', 3),
  ('assist-smart', 'Assist Smart', 'Av. Marginal Tancredo Neves, 900 - Loja 07 (Anexo Carrefour Rodovia)', 4)
on conflict (id) do nothing;

alter table public.store_checkouts
  add column if not exists pickup_location_id text references public.store_pickup_locations(id);
alter table public.orders add column if not exists pickup_location text;

create or replace function public.place_store_order(order_rows jsonb, p_token text, p_customer jsonb, p_delivery text default 'pickup'::text, p_address jsonb default null::jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  c_personalization_fee constant numeric := 19.90; -- igual a PERSONALIZATION_FEE (src/utils/price.js)
  c_extra_discount constant numeric := 0.10;
  v_uid uuid := auth.uid();
  v_name text := nullif(trim(p_customer->>'name'), '');
  v_phone text := nullif(trim(p_customer->>'phone'), '');
  v_note text := nullif(trim(p_customer->>'note'), '');
  v_delivery text := coalesce(nullif(p_delivery, ''), 'pickup');
  v_delivery_note text;
  v_pickup store_pickup_locations%rowtype;
  v_email text;
  v_code text := normalize_token_code(p_token);
  v_token campaign_tokens%rowtype;
  v_batch campaign_token_batches%rowtype;
  v_gift_idx int;
  v_checkout uuid;
  r record;
  v_product products%rowtype;
  v_qty int;
  v_fee numeric;
  v_unit numeric;
  v_gross numeric;
  v_tier_pct numeric;
  v_tier_unit numeric;
  v_tier_min int;
  v_wholesale numeric;
  v_net numeric;
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
  if v_delivery not in ('pickup', 'shipping') then raise exception 'ENTREGA_INVALIDA'; end if;
  if v_delivery = 'shipping' and (
       coalesce(regexp_replace(p_address->>'cep', '\D', '', 'g'), '') !~ '^\d{8}$'
       or coalesce(trim(p_address->>'street'), '') = '' or coalesce(trim(p_address->>'number'), '') = ''
       or coalesce(trim(p_address->>'city'), '') = '' or coalesce(trim(p_address->>'state'), '') = '') then
    raise exception 'ENDERECO_INCOMPLETO';
  end if;

  -- Retirada: unidade escolhida pelo cliente (p_address->>'pickup_location').
  if v_delivery = 'pickup' and nullif(p_address->>'pickup_location', '') is not null then
    select * into v_pickup from store_pickup_locations where id = p_address->>'pickup_location' and active;
    if not found then raise exception 'RETIRADA_INVALIDA'; end if;
  end if;

  v_delivery_note := case when v_delivery = 'shipping' then
    'ENTREGA: ' || concat_ws(', ', p_address->>'street', p_address->>'number', nullif(p_address->>'complement', ''))
      || ' – ' || concat_ws(' – ', nullif(p_address->>'district', ''), (p_address->>'city') || '/' || (p_address->>'state'))
      || ' – CEP ' || (p_address->>'cep')
    when v_pickup.id is not null then 'RETIRADA: ' || v_pickup.name || ' – ' || v_pickup.address
    else 'RETIRADA NA LOJA' end;

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

  insert into store_checkouts (customer_user_id, delivery_method, address, token_code, pickup_location_id)
  values (v_uid, v_delivery, case when v_delivery = 'shipping' then p_address end,
          case when v_gift_idx is not null then v_code end, v_pickup.id)
  returning id into v_checkout;

  for r in select value as d, (ordinality - 1)::int as i from jsonb_array_elements(order_rows) with ordinality loop
    select * into v_product from products where id = nullif(r.d->>'product_id', '')::uuid and status = 'active';
    if not found then raise exception 'PRODUTO_INDISPONIVEL'; end if;

    v_qty := greatest(coalesce((r.d->>'quantity')::int, 1), 1);
    if v_product.store_price is not null then
      -- Preço final manual: já inclui a personalização.
      v_fee := 0;
      v_unit := v_product.store_price;
    else
      v_fee := case when jsonb_typeof(r.d->'personalization_snapshot') = 'array'
                     and jsonb_array_length(r.d->'personalization_snapshot') > 0
                then c_personalization_fee else 0 end;
      v_unit := v_product.base_price + v_fee;
    end if;
    v_gross := v_unit * v_qty;

    v_tier_pct := null;
    v_tier_unit := null;
    v_tier_min := null;
    select discount_pct, unit_price, min_qty into v_tier_pct, v_tier_unit, v_tier_min
    from store_price_tiers
    where product_id = v_product.id and min_qty <= v_qty
    order by min_qty desc limit 1;
    v_wholesale := case
      when v_tier_unit is not null then greatest(v_gross - v_tier_unit * v_qty, 0)
      when v_tier_pct is not null then round(v_gross * v_tier_pct / 100, 2)
      else 0 end;
    v_net := v_gross - v_wholesale;
    if v_gift_idx is not null and r.i = v_gift_idx then
      v_disc := v_wholesale + round(v_net / v_qty, 2);
    elsif v_gift_idx is not null then
      v_disc := v_wholesale + round(v_net * c_extra_discount, 2);
    else
      v_disc := v_wholesale;
    end if;
    v_total := v_gross - v_disc;

    insert into orders (
      customer_name, customer_contact, customer_note, reseller_id, reseller_name,
      product_id, color_id, size_id, model_id, quantity, personalization_snapshot,
      personalization_fee, unit_price, line_total, preview_image_url, original_files_zip_url, art_image_url,
      status, channel, customer_user_id, token_code, discount_amount, checkout_id, pickup_location
    ) values (
      v_name, concat_ws(' · ', v_phone, v_email),
      concat_ws(E'\n',
        case when v_tier_unit is not null and v_wholesale > 0 then
               'Atacado R$ ' || replace(trim(to_char(v_tier_unit, 'FM999990.00')), '.', ',') || '/un. (a partir de ' || v_tier_min || ' un.)'
             when v_tier_pct is not null and v_tier_unit is null then
               'Atacado ' || trim(to_char(v_tier_pct, 'FM990.##')) || '% (a partir de ' || v_tier_min || ' un.)' end,
        case when v_gift_idx is not null and r.i = v_gift_idx then 'BRINDE — token ' || v_code
             when v_gift_idx is not null then 'Desconto campanha 10% (token ' || v_code || ')' end,
        v_delivery_note,
        v_note),
      null, 'Loja Virtual',
      v_product.id, nullif(r.d->>'color_id', '')::uuid, nullif(r.d->>'size_id', '')::uuid,
      nullif(r.d->>'model_id', '')::uuid, v_qty, r.d->'personalization_snapshot',
      v_fee, v_unit - v_fee, v_total,
      r.d->>'preview_image_url', r.d->>'original_files_zip_url', r.d->>'art_image_url',
      case when v_total = 0 and v_delivery = 'pickup' then 'producing' else 'pending' end,
      'store', v_uid, case when v_gift_idx is not null then v_code end, v_disc, v_checkout, v_pickup.name
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

  update store_checkouts
  set items_total = v_sum, discount_total = v_sum_disc,
      status = case when v_sum = 0 and v_delivery = 'pickup' then 'free' else 'awaiting_payment' end
  where id = v_checkout;

  if v_gift_idx is not null then
    update campaign_tokens set status = 'used', used_at = now(), used_by = v_uid, used_order_number = v_gift_order
    where id = v_token.id;
  end if;

  return jsonb_build_object('checkout_id', v_checkout, 'order_numbers', to_jsonb(v_numbers),
                            'total', v_sum, 'discount', v_sum_disc);
end;
$function$;
