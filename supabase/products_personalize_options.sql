-- Passo Personalizar: quais botões cada produto oferece (cadastro do produto no Painel).
-- Texto sempre aparece; "+ Imagem" e "Coleções" podem ser desligados por produto.
alter table public.products
  add column if not exists allow_image_upload boolean not null default true,
  add column if not exists allow_collections boolean not null default true;

-- Caneta e chaveiro: só texto.
update public.products set allow_image_upload = false, allow_collections = false
where slug in ('caneta-metalica', 'chaveiro-abridor');
