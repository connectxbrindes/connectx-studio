// Sitemap da loja virtual para o Google (servido em /sitemap.xml via vercel.json).
// Lista a home da loja, as categorias com produto ativo e cada produto ativo.
const SITE = 'https://www.connectxbrindes.com.br';

export default async function handler(req, res) {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const urls = [{ loc: `${SITE}/store`, priority: '1.0' }];

  try {
    const r = await fetch(
      `${url}/rest/v1/products?select=slug,updated_at,category:categories(slug),subcategory:subcategories(category:categories(slug))&status=eq.active`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    const products = r.ok ? await r.json() : [];
    const categories = new Set();
    for (const p of products) {
      const cat = p.category?.slug || p.subcategory?.category?.slug;
      if (cat) categories.add(cat);
    }
    for (const c of categories) urls.push({ loc: `${SITE}/store/c/${c}`, priority: '0.8' });
    for (const p of products) {
      if (!p.slug) continue;
      urls.push({ loc: `${SITE}/store/p/${p.slug}`, priority: '0.9', lastmod: p.updated_at?.slice(0, 10) });
    }
  } catch (err) {
    console.error('sitemap', err);
  }

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<priority>${u.priority}</priority></url>`).join('\n')}
</urlset>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.status(200).send(body);
}
