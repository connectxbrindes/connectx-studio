-- Popula o banco com os dados que já existem hoje em src/data/products.js.
-- Rode depois do schema.sql, no SQL Editor do Supabase.

insert into categories (name, slug) values
  ('Térmicos Personalizados', 'termicos-personalizados'),
  ('Capas Personalizadas', 'capas-personalizadas')
on conflict (slug) do nothing;

insert into subcategories (category_id, name, slug)
select c.id, v.name, v.slug
from (values
  ('Garrafas Térmicas', 'garrafas-termicas'),
  ('Copos Térmicos', 'copos-termicos')
) as v(name, slug)
join categories c on c.slug = 'termicos-personalizados'
on conflict (slug) do nothing;

-- Garrafa Térmica -----------------------------------------------------------

insert into products (subcategory_id, name, slug, base_price, cover_image_url, personalization_area)
select s.id, 'Garrafa Térmica', 'garrafa-termica', 129.90, '/GarrafaCapa.webp',
       '{"x": 30, "y": 25, "width": 40, "height": 45}'::jsonb
from subcategories s where s.slug = 'garrafas-termicas'
on conflict (slug) do nothing;

insert into product_colors (product_id, name, hex, image_url, sort_order)
select p.id, v.name, v.hex, v.image_url, v.sort_order
from (values
  ('Rosa', '#FFC0CB', '/Garrafa_Rosa.webp', 0),
  ('Preto', '#111111', '/Garrafa_Preto.webp', 1),
  ('Branco', '#F9F9F9', '/Garrafa_branca.webp', 2),
  ('Roxo', '#4527A0', '/Garrafa_Roxo.webp', 3),
  ('Vermelho', '#A6282A', '/Garrafa_Vermelho.webp', 4)
) as v(name, hex, image_url, sort_order)
join products p on p.slug = 'garrafa-termica';

insert into product_sizes (product_id, name, sort_order)
select p.id, v.name, v.sort_order
from (values ('500ml', 0), ('1L', 1)) as v(name, sort_order)
join products p on p.slug = 'garrafa-termica';

-- Copo Térmico ----------------------------------------------------------------

insert into products (subcategory_id, name, slug, base_price, cover_image_url, personalization_area)
select s.id, 'Copo Térmico', 'copo-termico', 99.90, '/CopoCapa.webp',
       '{"x": 28, "y": 20, "width": 44, "height": 40}'::jsonb
from subcategories s where s.slug = 'copos-termicos'
on conflict (slug) do nothing;

insert into product_colors (product_id, name, hex, image_url, sort_order)
select p.id, v.name, v.hex, v.image_url, v.sort_order
from (values
  ('Azul', '#005BBB', '/copo_cuia_azul.webp', 0),
  ('Branco', '#FFFFFF', '/copo_cuia_branco.webp', 1),
  ('Preto', '#111111', '/copo_cuia_preto.webp', 2)
) as v(name, hex, image_url, sort_order)
join products p on p.slug = 'copo-termico';

insert into product_sizes (product_id, name, sort_order)
select p.id, '473ml', 0
from products p where p.slug = 'copo-termico';

-- Capa Personalizada ----------------------------------------------------------

insert into products (category_id, name, slug, base_price, cover_image_url, personalization_area)
select c.id, 'Capa Personalizada', 'capa-personalizada', 69.90, '/TPUCapa.webp',
       '{"x": 25, "y": 15, "width": 50, "height": 55}'::jsonb
from categories c where c.slug = 'capas-personalizadas'
on conflict (slug) do nothing;

insert into product_colors (product_id, name, hex, sort_order)
select p.id, v.name, v.hex, v.sort_order
from (values
  ('Transparente', '#F0F8FF', 0),
  ('Fumê', '#696969', 1)
) as v(name, hex, sort_order)
join products p on p.slug = 'capa-personalizada';

insert into product_models (product_id, name, sort_order)
select p.id, v.name, v.sort_order
from (values
  ('iPhone 14', 0),
  ('iPhone 14 Pro', 1),
  ('Galaxy S23', 2)
) as v(name, sort_order)
join products p on p.slug = 'capa-personalizada';
