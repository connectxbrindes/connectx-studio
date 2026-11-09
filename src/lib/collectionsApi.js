import { supabase, supabaseAdmin } from './supabaseClient';

// Coleções do Studio: artes prontas que o cliente aplica no produto pelo
// botão "Coleções" (passo Personalizar). Cadastro no Painel → Studio → Coleções.

const SELECT = 'id, name, sort_order, active, category_ids, promo_url, images:studio_collection_images ( id, name, image_url, storage_path, sort_order, created_at )';

const toCollection = (c) => ({
  id: c.id,
  name: c.name,
  sortOrder: c.sort_order,
  active: c.active,
  // Categorias onde a coleção aparece. Vazio = todas.
  categoryIds: c.category_ids || [],
  // Link das peças de divulgação (vazio = sem link).
  promoUrl: c.promo_url || '',
  images: (c.images || [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
    .map((i) => ({ id: i.id, name: i.name, url: i.image_url, storagePath: i.storage_path })),
});

/** Coleções ativas com imagens (leitura pública — Studio e loja). */
export async function fetchStudioCollections() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('studio_collections')
    .select(SELECT)
    .eq('active', true)
    .order('sort_order')
    .order('created_at');
  if (error) {
    console.error('Error fetching collections:', error);
    return [];
  }
  return data.map(toCollection).filter((c) => c.images.length > 0);
}

/** Todas as coleções (Painel), inclusive ocultas e vazias. */
export async function fetchAdminCollections() {
  const { data, error } = await supabaseAdmin
    .from('studio_collections')
    .select(SELECT)
    .order('sort_order')
    .order('created_at');
  if (error) {
    console.error('Error fetching admin collections:', error);
    return [];
  }
  return data.map(toCollection);
}

export async function createCollection(name, sortOrder = 0) {
  const { data, error } = await supabaseAdmin
    .from('studio_collections')
    .insert({ name: name.trim(), sort_order: sortOrder })
    .select(SELECT)
    .single();
  return { collection: data ? toCollection(data) : null, error };
}

export async function updateCollection(id, patch) {
  const row = {};
  if (patch.name !== undefined) row.name = patch.name.trim();
  if (patch.active !== undefined) row.active = patch.active;
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
  if (patch.categoryIds !== undefined) row.category_ids = patch.categoryIds;
  if (patch.promoUrl !== undefined) row.promo_url = patch.promoUrl.trim() || null;
  const { error } = await supabaseAdmin.from('studio_collections').update(row).eq('id', id);
  return { error };
}

export async function deleteCollection(collection) {
  const paths = collection.images.map((i) => i.storagePath).filter(Boolean);
  if (paths.length) await supabaseAdmin.storage.from('studio-collections').remove(paths);
  const { error } = await supabaseAdmin.from('studio_collections').delete().eq('id', collection.id);
  return { error };
}

/** Sobe uma imagem para a coleção. */
export async function addCollectionImage(collectionId, file, sortOrder = 0) {
  let ext = (file.name.includes('.') ? file.name.split('.').pop() : '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (['jfif', 'pjpeg', 'pjp', 'jpe'].includes(ext)) ext = 'jpg';
  const path = `${collectionId}/${crypto.randomUUID()}.${ext || 'png'}`;
  const contentType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : file.type || undefined;
  const { error: upErr } = await supabaseAdmin.storage.from('studio-collections').upload(path, file, { contentType });
  if (upErr) return { image: null, error: upErr };
  const url = supabaseAdmin.storage.from('studio-collections').getPublicUrl(path).data.publicUrl;
  const name = file.name.replace(/\.[^.]+$/, '');
  const { data, error } = await supabaseAdmin
    .from('studio_collection_images')
    .insert({ collection_id: collectionId, name, image_url: url, storage_path: path, sort_order: sortOrder })
    .select('id, name, image_url, storage_path')
    .single();
  if (error) {
    await supabaseAdmin.storage.from('studio-collections').remove([path]);
    return { image: null, error };
  }
  return { image: { id: data.id, name: data.name, url: data.image_url, storagePath: data.storage_path }, error: null };
}

export async function deleteCollectionImage(image) {
  if (image.storagePath) await supabaseAdmin.storage.from('studio-collections').remove([image.storagePath]);
  const { error } = await supabaseAdmin.from('studio_collection_images').delete().eq('id', image.id);
  return { error };
}
