-- Loja virtual: preço final manual e atacado em R$ por unidade.
-- Painel → Loja virtual → Preços e descontos.
--
-- products.store_price: o que o cliente da loja paga por unidade (já com a
--   personalização). Vazio = regra antiga (base_price + 19,90).
-- store_price_tiers.unit_price: a partir de min_qty unidades, cada unidade
--   custa unit_price. (discount_pct fica só para faixas antigas.)

alter table public.products
  add column if not exists store_price numeric(10,2) check (store_price is null or store_price > 0);

-- Mantém os preços de hoje: preço na loja = preço do produto + personalização.
update public.products set store_price = base_price + 19.90 where store_price is null;

alter table public.store_price_tiers
  add column if not exists unit_price numeric(10,2) check (unit_price is null or unit_price > 0);
alter table public.store_price_tiers alter column discount_pct drop not null;

-- Pedido da loja: preço recalculado aqui com o preço final e a faixa em R$.
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

  v_delivery_note := case when v_delivery = 'shipping' then
    'ENTREGA: ' || concat_ws(', ', p_address->>'street', p_address->>'number', nullif(p_address->>'complement', ''))
      || ' – ' || concat_ws(' – ', nullif(p_address->>'district', ''), (p_address->>'city') || '/' || (p_address->>'state'))
      || ' – CEP ' || (p_address->>'cep')
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

  insert into store_checkouts (customer_user_id, delivery_method, address, token_code)
  values (v_uid, v_delivery, case when v_delivery = 'shipping' then p_address end,
          case when v_gift_idx is not null then v_code end)
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
      status, channel, customer_user_id, token_code, discount_amount, checkout_id
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
      'store', v_uid, case when v_gift_idx is not null then v_code end, v_disc, v_checkout
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
