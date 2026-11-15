-- Loja virtual: pedido mínimo próprio da loja (products.store_min_qty).
-- Nulo = usa o pedido mínimo do cadastro (min_order_qty), que segue valendo no Studio.

alter table products add column if not exists store_min_qty int
  check (store_min_qty is null or store_min_qty >= 1);
comment on column products.store_min_qty is 'Pedido mínimo na loja virtual (/store). Nulo = usa min_order_qty.';

-- place_store_order: recusa item abaixo do pedido mínimo da loja (PEDIDO_MINIMO).
-- Aplica como patch na definição atual para não divergir do resto da função.
do $patch$
declare
  d text;
begin
  select pg_get_functiondef('public.place_store_order(jsonb,text,jsonb,text,jsonb)'::regprocedure) into d;
  if position('PEDIDO_MINIMO' in d) > 0 then return; end if;
  d := replace(d,
    E'    v_qty := greatest(coalesce((r.d->>''quantity'')::int, 1), 1);\n',
    E'    v_qty := greatest(coalesce((r.d->>''quantity'')::int, 1), 1);\n'
    || E'    if v_qty < coalesce(nullif(v_product.store_min_qty, 0), nullif(v_product.min_order_qty, 0), 1) then\n'
    || E'      raise exception ''PEDIDO_MINIMO'';\n'
    || E'    end if;\n');
  if position('PEDIDO_MINIMO' in d) = 0 then raise exception 'patch place_store_order falhou'; end if;
  execute d;
end
$patch$;
