-- Novidades do Studio: pop-up mostrado aos revendedores ao entrar no Studio,
-- uma vez por dia, entre start_date e end_date (inclusive).
-- Cadastro no Painel → Studio → Novidades (permissão 'studio').

create table if not exists public.studio_news (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  body text not null default '',
  image_url text,
  storage_path text,
  start_date date not null default current_date,
  end_date date not null default (current_date + 6),
  show_collection_links boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

alter table public.studio_news enable row level security;

drop policy if exists "studio_news read" on public.studio_news;
create policy "studio_news read" on public.studio_news
  for select using (active or is_master() or has_permission('studio'));
drop policy if exists "studio_news panel write" on public.studio_news;
create policy "studio_news panel write" on public.studio_news
  for all using (is_master() or has_permission('studio'))
  with check (is_master() or has_permission('studio'));

-- Imagens das novidades ficam no bucket das coleções, na pasta news/.

-- Primeira novidade: lançamento das Coleções (já estava no ar).
insert into public.studio_news (title, body, image_url, start_date, end_date, show_collection_links)
select
  'Novidade: Coleções',
  '**Onde encontrar as artes:** ao montar um pedido, no passo **3 · Personalizar**, clique no botão **Coleções** e abra a pasta da coleção. É só escolher a arte para aplicar no produto.',
  '/novidade-colecoes.jpg',
  date '2026-11-09',
  date '2026-11-15',
  true
where not exists (select 1 from public.studio_news);
