import { supabase, supabaseAdmin } from './supabaseClient';

// Novidades do Studio: pop-up dos revendedores. Cadastro no Painel → Studio → Novidades.

const BUCKET = 'studio-collections'; // imagens na pasta news/

const toNews = (n) => ({
  id: n.id,
  title: n.title,
  body: n.body,
  imageUrl: n.image_url || '',
  storagePath: n.storage_path || null,
  startDate: n.start_date,
  endDate: n.end_date,
  showCollectionLinks: n.show_collection_links,
  active: n.active,
});

/** Data local no formato AAAA-MM-DD. */
export function localDay(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Novidade em exibição hoje (a de início mais recente). */
export async function fetchCurrentNews() {
  if (!supabase) return null;
  const today = localDay();
  const { data, error } = await supabase
    .from('studio_news')
    .select('*')
    .eq('active', true)
    .lte('start_date', today)
    .gte('end_date', today)
    .order('start_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) {
    console.error('Error fetching news:', error);
    return null;
  }
  return data[0] ? toNews(data[0]) : null;
}

export async function fetchAdminNews() {
  const { data, error } = await supabaseAdmin
    .from('studio_news')
    .select('*')
    .order('start_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Error fetching admin news:', error);
    return [];
  }
  return data.map(toNews);
}

const toRow = (n) => ({
  title: n.title.trim(),
  body: n.body.trim(),
  image_url: n.imageUrl || null,
  storage_path: n.storagePath || null,
  start_date: n.startDate,
  end_date: n.endDate,
  show_collection_links: n.showCollectionLinks,
  active: n.active,
});

export async function saveNews(news) {
  const query = news.id
    ? supabaseAdmin.from('studio_news').update(toRow(news)).eq('id', news.id)
    : supabaseAdmin.from('studio_news').insert(toRow(news));
  const { data, error } = await query.select('*').single();
  return { news: data ? toNews(data) : null, error };
}

export async function deleteNews(news) {
  if (news.storagePath) await supabaseAdmin.storage.from(BUCKET).remove([news.storagePath]);
  const { error } = await supabaseAdmin.from('studio_news').delete().eq('id', news.id);
  return { error };
}

/** Sobe a imagem da novidade e devolve { url, path }. */
export async function uploadNewsImage(file) {
  let ext = (file.name.includes('.') ? file.name.split('.').pop() : '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (['jfif', 'pjpeg', 'pjp', 'jpe'].includes(ext)) ext = 'jpg';
  const path = `news/${crypto.randomUUID()}.${ext || 'jpg'}`;
  const contentType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : file.type || undefined;
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, file, { contentType });
  if (error) return { error };
  const url = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  return { url, path, error: null };
}

export async function removeNewsImage(path) {
  if (path) await supabaseAdmin.storage.from(BUCKET).remove([path]);
}
