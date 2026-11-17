-- Tokens da campanha vinculados a revendedores.
-- Um lote pode ser repartido: cada código pertence (ou não) a um revendedor.
-- O revendedor vê os próprios códigos no Studio ("Meus códigos").

alter table campaign_tokens
  add column if not exists reseller_id uuid references resellers(id) on delete set null,
  add column if not exists assigned_at timestamptz;
create index if not exists campaign_tokens_reseller_idx on campaign_tokens (reseller_id);

-- Painel: vincula os próximos N códigos livres (disponíveis e sem revendedor) do lote.
create or replace function assign_campaign_tokens(p_batch_id uuid, p_reseller_id uuid, p_quantity int)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_count int;
begin
  if not (is_master() or has_permission('tokens')) then raise exception 'SEM_PERMISSAO'; end if;
  if p_quantity is null or p_quantity < 1 then raise exception 'QUANTIDADE_INVALIDA'; end if;
  if not exists (select 1 from resellers where id = p_reseller_id) then raise exception 'REVENDEDOR_INVALIDO'; end if;

  with next_free as (
    select id from campaign_tokens
    where batch_id = p_batch_id and reseller_id is null and status = 'active'
    order by created_at, code
    limit p_quantity
    for update skip locked
  )
  update campaign_tokens t set reseller_id = p_reseller_id, assigned_at = now()
  from next_free where t.id = next_free.id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Painel: devolve ao lote os códigos ainda não usados de um revendedor.
create or replace function release_campaign_tokens(p_batch_id uuid, p_reseller_id uuid)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_count int;
begin
  if not (is_master() or has_permission('tokens')) then raise exception 'SEM_PERMISSAO'; end if;
  update campaign_tokens set reseller_id = null, assigned_at = null
  where batch_id = p_batch_id and reseller_id = p_reseller_id and status <> 'used';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Studio: códigos do revendedor logado.
create or replace function my_campaign_tokens()
returns table (code text, status text, used_at timestamptz, used_order_number text,
               assigned_at timestamptz, batch_name text, batch_active boolean, product_names text[])
language sql stable security definer set search_path = public
as $$
  select t.code, t.status, t.used_at, t.used_order_number, t.assigned_at,
         b.name, b.active,
         array(select p.name from products p where p.id = any(b.product_ids) order by p.name)
  from campaign_tokens t
  join campaign_token_batches b on b.id = t.batch_id
  where t.reseller_id is not null and t.reseller_id = current_reseller_id()
  order by b.created_at desc, t.code;
$$;

revoke all on function assign_campaign_tokens(uuid, uuid, int) from public, anon;
revoke all on function release_campaign_tokens(uuid, uuid) from public, anon;
revoke all on function my_campaign_tokens() from public, anon;
grant execute on function assign_campaign_tokens(uuid, uuid, int) to authenticated;
grant execute on function release_campaign_tokens(uuid, uuid) to authenticated;
grant execute on function my_campaign_tokens() to authenticated;
