-- Central de Artes: as unidades (revendedores) abrem chamados no Studio pedindo
-- artes de divulgação; a equipe acompanha e responde no Painel → Central de Artes.
-- Cada unidade só enxerga os próprios chamados (RLS por reseller_id).
-- Equipe: master ou staff com a permissão 'arts'.

create or replace function public.is_arts_team()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select is_master() or has_permission('arts');
$$;

create table if not exists public.art_requests (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity (start with 101) unique,
  reseller_id uuid not null references public.resellers(id) on delete cascade,
  reseller_name text not null default '',
  created_by uuid default auth.uid(),
  title text not null check (length(trim(title)) > 0),
  art_type text not null,
  purpose text not null,
  due_date date,
  status text not null default 'received' check (status in ('received', 'producing', 'review', 'done')),
  assignee text,
  unit_unread int not null default 0,
  team_unread int not null default 0,
  last_message text,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.art_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.art_requests(id) on delete cascade,
  sender text not null check (sender in ('unit', 'team', 'system')),
  author_id uuid default auth.uid(),
  author_name text not null default '',
  body text not null default '',
  image_url text,
  file_name text,
  deliverable boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists art_messages_request_idx on public.art_messages (request_id, created_at);
create index if not exists art_requests_reseller_idx on public.art_requests (reseller_id, last_message_at desc);

-- Chamado novo: amarra à unidade de quem abriu (não dá pra abrir em nome de outra).
create or replace function public.art_requests_before_insert()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if not is_arts_team() then
    new.reseller_id := current_reseller_id();
    new.status := 'received';
    new.assignee := null;
  end if;
  if new.reseller_id is null then
    raise exception 'Usuário sem unidade vinculada';
  end if;
  select coalesce(nullif(short_name, ''), name) into new.reseller_name from resellers where id = new.reseller_id;
  new.unit_unread := 0;
  new.team_unread := 0;
  return new;
end $$;
drop trigger if exists art_requests_before_insert on public.art_requests;
create trigger art_requests_before_insert before insert on public.art_requests
  for each row execute function public.art_requests_before_insert();

-- Edição: a unidade só pode mudar título/objetivo, marcar como lida e
-- aprovar (review → done) ou pedir ajuste (review → producing).
-- Mudança de status vira uma linha na conversa.
create or replace function public.art_requests_before_update()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  team boolean := is_arts_team();
  labels jsonb := '{"received":"Recebida","producing":"Em produção","review":"Aguardando","done":"Concluída"}';
begin
  if current_setting('art.internal', true) = '1' then
    new.updated_at := now();
    return new;
  end if;
  new.id := old.id; new.number := old.number; new.reseller_id := old.reseller_id;
  new.reseller_name := old.reseller_name; new.created_by := old.created_by; new.created_at := old.created_at;
  if not team then
    new.art_type := old.art_type;
    new.due_date := old.due_date;
    new.assignee := old.assignee;
    new.team_unread := old.team_unread;
    new.last_message := old.last_message;
    new.last_message_at := old.last_message_at;
    if new.status is distinct from old.status
       and not (old.status = 'review' and new.status in ('done', 'producing')) then
      new.status := old.status;
    end if;
    new.unit_unread := old.unit_unread;
  else
    new.unit_unread := old.unit_unread;
    new.team_unread := old.team_unread;
  end if;
  if new.status is distinct from old.status then
    perform set_config('art.internal', '1', true);
    insert into art_messages (request_id, sender, author_name, body)
    values (new.id, 'system', '', 'Status: ' || (labels ->> new.status));
    perform set_config('art.internal', '0', true);
    if team then new.unit_unread := new.unit_unread + 1; else new.team_unread := new.team_unread + 1; end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists art_requests_before_update on public.art_requests;
create trigger art_requests_before_update before update on public.art_requests
  for each row execute function public.art_requests_before_update();

-- Mensagem: define quem enviou pelo login (não pelo que o navegador manda)
-- e soma "não lidas" para o outro lado.
create or replace function public.art_messages_before_insert()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare r art_requests;
begin
  new.created_at := now();
  if new.sender = 'system' and current_setting('art.internal', true) = '1' then
    return new;
  end if;
  select * into r from art_requests where id = new.request_id;
  -- Chamado concluído = conversa encerrada (a central reabre mudando o status).
  if r.status = 'done' then
    raise exception 'Chamado concluído: conversa encerrada';
  end if;
  if is_arts_team() then
    new.sender := 'team';
    new.author_name := 'Central de Artes';
  else
    new.sender := 'unit';
    new.author_name := r.reseller_name;
    new.deliverable := false;
  end if;
  new.author_id := auth.uid();
  return new;
end $$;
drop trigger if exists art_messages_before_insert on public.art_messages;
create trigger art_messages_before_insert before insert on public.art_messages
  for each row execute function public.art_messages_before_insert();

create or replace function public.art_messages_after_insert()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.sender = 'system' then return new; end if;
  perform set_config('art.internal', '1', true);
  update art_requests set
    last_message = case when new.body <> '' then new.body when new.image_url is not null then '📎 Imagem' else last_message end,
    last_message_at = new.created_at,
    unit_unread = unit_unread + case when new.sender = 'team' then 1 else 0 end,
    team_unread = team_unread + case when new.sender = 'unit' then 1 else 0 end
  where id = new.request_id;
  perform set_config('art.internal', '0', true);
  return new;
end $$;
drop trigger if exists art_messages_after_insert on public.art_messages;
create trigger art_messages_after_insert after insert on public.art_messages
  for each row execute function public.art_messages_after_insert();

-- Marca o chamado como lido pelo lado de quem chama.
create or replace function public.art_mark_read(p_request uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  perform set_config('art.internal', '1', true);
  if is_arts_team() then
    update art_requests set team_unread = 0 where id = p_request and team_unread <> 0;
  end if;
  update art_requests set unit_unread = 0
   where id = p_request and reseller_id = current_reseller_id() and unit_unread <> 0;
  perform set_config('art.internal', '0', true);
end $$;
grant execute on function public.art_mark_read(uuid) to authenticated;

alter table public.art_requests enable row level security;
alter table public.art_messages enable row level security;

drop policy if exists "art_requests read" on public.art_requests;
create policy "art_requests read" on public.art_requests for select
  using (is_arts_team() or reseller_id = current_reseller_id());
drop policy if exists "art_requests insert" on public.art_requests;
create policy "art_requests insert" on public.art_requests for insert
  with check (is_arts_team() or current_reseller_id() is not null);
drop policy if exists "art_requests update" on public.art_requests;
create policy "art_requests update" on public.art_requests for update
  using (is_arts_team() or reseller_id = current_reseller_id());
drop policy if exists "art_requests delete" on public.art_requests;
create policy "art_requests delete" on public.art_requests for delete
  using (is_master());

drop policy if exists "art_messages read" on public.art_messages;
create policy "art_messages read" on public.art_messages for select
  using (exists (select 1 from art_requests r where r.id = request_id
                 and (is_arts_team() or r.reseller_id = current_reseller_id())));
drop policy if exists "art_messages insert" on public.art_messages;
create policy "art_messages insert" on public.art_messages for insert
  with check (sender <> 'system' and exists (select 1 from art_requests r where r.id = request_id
                 and (is_arts_team() or r.reseller_id = current_reseller_id())));

-- Imagens e arquivos da conversa (caminho com id aleatório).
insert into storage.buckets (id, name, public, file_size_limit)
values ('art-requests', 'art-requests', true, 26214400)
on conflict (id) do nothing;
drop policy if exists "art requests files insert" on storage.objects;
create policy "art requests files insert" on storage.objects for insert
  with check (bucket_id = 'art-requests' and auth.role() = 'authenticated');
drop policy if exists "art requests files read" on storage.objects;
create policy "art requests files read" on storage.objects for select
  using (bucket_id = 'art-requests');

-- Atualização ao vivo (Painel e Studio recebem novidades sem recarregar).
do $$ begin
  begin alter publication supabase_realtime add table public.art_requests; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.art_messages; exception when duplicate_object then null; end;
end $$;
