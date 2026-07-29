import JSZip from 'jszip';
import { supabase, supabaseAdmin, isSupabaseConfigured } from './supabaseClient';
import { products as mockProducts } from '../data/products';

// Duas sessões independentes (ver supabaseClient.js): `supabase` = sessão do
// Studio (unidade/reseller), `supabaseAdmin` = sessão do Painel (master).
// Cada função usa o client da sessão que ela precisa — funções do Painel só
// funcionam logado como master, funções do Studio só logado como unidade.
// Reads públicos (RLS `using(true)`) funcionam em qualquer um; ficam no
// client do consumidor principal.

/**
 * Fetches the active catalog from Supabase and transforms it into the
 * structure expected by the Storefront.
 * Fallbacks to mock data if Supabase is not configured or fails.
 */
export async function fetchCatalog() {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured. Using mock catalog data.');
    return mockProducts;
  }

  const [{ data, error }, allBrandModels] = await Promise.all([
    supabase
      .from('products')
      .select(`
        id,
        name,
        slug,
        base_price,
        description,
        cover_image_url,
        personalization_area,
        status,
        has_3d_viewer,
        model_3d_url,
        uses_device_models,
        category:categories ( id, name, slug ),
        subcategory:subcategories ( id, name, slug, category:categories ( id, name, slug ) ),
        brand:brands ( id, name, slug ),
        colors:product_colors ( id, name, hex, image_url, sort_order, stock_quantity ),
        sizes:product_sizes ( id, name, sort_order ),
        variants:product_model_variants ( brand_model_id, stock_quantity )
      `)
      .eq('status', 'active'),
    fetchAllBrandModels(),
  ]);

  if (error) {
    console.error('Error fetching catalog:', error);
    return mockProducts; // Fallback
  }

  // Marca/Modelo é um catálogo global (cadastrado nas abas Marca/Modelo do
  // admin) — qualquer produto com uses_device_models mostra o mesmo catálogo
  // completo, sem curadoria por produto. A prévia (mockup + máscara) também
  // é do modelo, cadastrada uma vez só e reaproveitada em qualquer produto.
  const globalModels = allBrandModels.map((m) => ({
    id: m.id,
    name: m.name,
    brandId: m.brand?.id || null,
    brandName: m.brand?.name || null,
    mockupImageUrl: m.mockup_image_url || null,
    maskImageUrl: m.mask_image_url || null,
  }));

  // Transform to match the structure the app expects
  const transformedProducts = data.map((p) => {
    // Sort options by sort_order
    const sortedColors = [...(p.colors || [])].sort((a, b) => a.sort_order - b.sort_order);
    const sortedSizes = [...(p.sizes || [])].sort((a, b) => a.sort_order - b.sort_order);

    // Um produto pode ter category_id direto OU chegar via subcategory_id
    // (que por sua vez aponta pra uma categoria) — sem isso, produtos só
    // com subcategoria somem do agrupamento por categoria no Studio.
    const effectiveCategory = p.category || p.subcategory?.category || null;

    // Estoque é por Produto+Modelo — sem variant cadastrado, o modelo ainda
    // aparece no seletor, só sem controle de estoque.
    const variantByModelId = new Map((p.variants || []).map((v) => [v.brand_model_id, v]));
    const productModels = p.uses_device_models
      ? globalModels.map((m) => ({
          ...m,
          stockQuantity: variantByModelId.has(m.id) ? variantByModelId.get(m.id).stock_quantity : null,
        }))
      : null;

    return {
      id: p.id,
      name: p.name,
      price: Number(p.base_price),
      image: p.cover_image_url,
      category: effectiveCategory,
      subcategory: p.subcategory ? { id: p.subcategory.id, name: p.subcategory.name, slug: p.subcategory.slug } : null,
      brand: p.brand || null,
      personalizationArea: p.personalization_area,
      hasViewer3d: Boolean(p.has_3d_viewer && p.model_3d_url),
      model3dUrl: p.model_3d_url || null,
      options: {
        colors: sortedColors.map((c) => ({
          id: c.id,
          name: c.name,
          hex: c.hex,
          image: c.image_url,
          // null = sem controle de estoque (não bloqueia); número = saldo.
          stockQuantity: c.stock_quantity ?? null,
        })),
        sizes: sortedSizes.length > 0 ? sortedSizes.map((s) => ({ id: s.id, name: s.name })) : null,
        models: productModels,
      },
    };
  });

  return transformedProducts;
}

// ---------------------------------------------------------------------------
// Categorias/subcategorias (usadas nos selects do formulário de produto)
// ---------------------------------------------------------------------------

export async function fetchCategories() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabaseAdmin.from('categories').select('id, name, slug').order('name');
  if (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
  return data;
}

export async function fetchSubcategories() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabaseAdmin
    .from('subcategories')
    .select('id, name, slug, category_id')
    .order('name');
  if (error) {
    console.error('Error fetching subcategories:', error);
    return [];
  }
  return data;
}

export async function saveCategory(categoryId, payload) {
  if (!isSupabaseConfigured) return { data: null, error: new Error('Supabase não configurado') };

  const query = categoryId
    ? supabaseAdmin.from('categories').update(payload).eq('id', categoryId).select().single()
    : supabaseAdmin.from('categories').insert(payload).select().single();

  const { data, error } = await query;
  if (error) console.error('Error saving category:', error);
  return { data, error };
}

export async function deleteCategory(categoryId) {
  if (!isSupabaseConfigured) return { error: new Error('Supabase não configurado') };
  const { error } = await supabaseAdmin.from('categories').delete().eq('id', categoryId);
  if (error) console.error('Error deleting category:', error);
  return { error };
}

export async function saveSubcategory(subcategoryId, payload) {
  if (!isSupabaseConfigured) return { data: null, error: new Error('Supabase não configurado') };

  const query = subcategoryId
    ? supabaseAdmin.from('subcategories').update(payload).eq('id', subcategoryId).select().single()
    : supabaseAdmin.from('subcategories').insert(payload).select().single();

  const { data, error } = await query;
  if (error) console.error('Error saving subcategory:', error);
  return { data, error };
}

export async function deleteSubcategory(subcategoryId) {
  if (!isSupabaseConfigured) return { error: new Error('Supabase não configurado') };
  const { error } = await supabaseAdmin.from('subcategories').delete().eq('id', subcategoryId);
  if (error) console.error('Error deleting subcategory:', error);
  return { error };
}

// ---------------------------------------------------------------------------
// Marcas
// ---------------------------------------------------------------------------

export async function fetchBrands() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabaseAdmin.from('brands').select('id, name, slug').order('name');
  if (error) {
    console.error('Error fetching brands:', error);
    return [];
  }
  return data;
}

export async function saveBrand(brandId, payload) {
  if (!isSupabaseConfigured) return { data: null, error: new Error('Supabase não configurado') };

  const query = brandId
    ? supabaseAdmin.from('brands').update(payload).eq('id', brandId).select().single()
    : supabaseAdmin.from('brands').insert(payload).select().single();

  const { data, error } = await query;
  if (error) console.error('Error saving brand:', error);
  return { data, error };
}

export async function deleteBrand(brandId) {
  if (!isSupabaseConfigured) return { error: new Error('Supabase não configurado') };
  const { error } = await supabaseAdmin.from('brands').delete().eq('id', brandId);
  if (error) console.error('Error deleting brand:', error);
  return { error };
}

// ---------------------------------------------------------------------------
// Modelos de Marca (Brand Models)
// ---------------------------------------------------------------------------

export async function fetchAllBrandModels() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabaseAdmin
    .from('brand_models')
    .select('id, name, mockup_image_url, mask_image_url, brand:brands ( id, name )')
    .order('name');
  if (error) {
    console.error('Error fetching brand models:', error);
    return [];
  }
  return data;
}

export async function saveBrandModel(modelId, payload) {
  if (!isSupabaseConfigured) return { data: null, error: new Error('Supabase não configurado') };

  const query = modelId
    ? supabaseAdmin.from('brand_models').update(payload).eq('id', modelId).select('id, name, mockup_image_url, mask_image_url, brand:brands ( id, name )').single()
    : supabaseAdmin.from('brand_models').insert(payload).select('id, name, mockup_image_url, mask_image_url, brand:brands ( id, name )').single();

  const { data, error } = await query;
  if (error) console.error('Error saving brand model:', error);
  return { data, error };
}

export async function deleteBrandModel(modelId) {
  if (!isSupabaseConfigured) return { error: new Error('Supabase não configurado') };
  const { error } = await supabaseAdmin.from('brand_models').delete().eq('id', modelId);
  if (error) console.error('Error deleting brand model:', error);
  return { error };
}

// ---------------------------------------------------------------------------
// Produtos (admin)
// ---------------------------------------------------------------------------

export async function fetchAdminProducts() {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabaseAdmin
    .from('products')
    .select(`
      id, name, slug, base_price, description, cover_image_url, personalization_area, status,
      category_id, subcategory_id, brand_id, has_3d_viewer, model_3d_url, uses_device_models,
      category:categories ( id, name ),
      subcategory:subcategories ( id, name, category:categories ( id, name ) ),
      brand:brands ( id, name ),
      colors:product_colors ( id, name, hex, image_url, sort_order, stock_quantity, bling_sku ),
      sizes:product_sizes ( id, name, sort_order ),
      variants:product_model_variants (
        id, brand_model_id, stock_quantity, bling_sku,
        brand_model:brand_models ( id, name, brand:brands ( id, name ) )
      )
    `)
    .order('name');

  if (error) {
    console.error('Error fetching admin products:', error);
    return [];
  }

  return data.map((p) => ({
    ...p,
    colors: [...(p.colors || [])].sort((a, b) => a.sort_order - b.sort_order),
    sizes: [...(p.sizes || [])].sort((a, b) => a.sort_order - b.sort_order),
  }));
}

export async function saveProduct(productId, payload) {
  if (!isSupabaseConfigured) return { data: null, error: new Error('Supabase não configurado') };

  const query = productId
    ? supabaseAdmin.from('products').update(payload).eq('id', productId).select().single()
    : supabaseAdmin.from('products').insert(payload).select().single();

  const { data, error } = await query;
  if (error) console.error('Error saving product:', error);
  return { data, error };
}

export async function deleteProduct(productId) {
  if (!isSupabaseConfigured) return { error: new Error('Supabase não configurado') };
  const { error } = await supabaseAdmin.from('products').delete().eq('id', productId);
  if (error) console.error('Error deleting product:', error);
  return { error };
}

/** Substitui cores/tamanhos de um produto pela lista atual do formulário.
 * Marca/Modelo não entram aqui — vêm do catálogo global (ver fetchCatalog). */
export async function replaceProductChildren(productId, { colors = [], sizes = [] }) {
  if (!isSupabaseConfigured) return { error: new Error('Supabase não configurado') };

  await Promise.all([
    supabaseAdmin.from('product_colors').delete().eq('product_id', productId),
    supabaseAdmin.from('product_sizes').delete().eq('product_id', productId),
  ]);

  const tasks = [];
  if (colors.length > 0) {
    tasks.push(
      supabaseAdmin.from('product_colors').insert(
        colors.map((c, index) => ({
          product_id: productId,
          name: c.name,
          hex: c.hex,
          image_url: c.image_url || null,
          sort_order: index,
          stock_quantity: c.stock_quantity === '' || c.stock_quantity == null ? null : Number(c.stock_quantity),
          bling_sku: c.bling_sku?.trim() || null,
        }))
      )
    );
  }
  if (sizes.length > 0) {
    tasks.push(
      supabaseAdmin
        .from('product_sizes')
        .insert(sizes.map((s, index) => ({ product_id: productId, name: s.name, sort_order: index })))
    );
  }

  const results = await Promise.all(tasks);
  const error = results.find((r) => r.error)?.error || null;
  if (error) console.error('Error replacing product children:', error);
  return { error };
}

export async function uploadProductImage(file) {
  if (!isSupabaseConfigured) return { url: null, error: new Error('Supabase não configurado') };

  const extension = file.name.split('.').pop();
  const path = `${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabaseAdmin.storage.from('product-images').upload(path, file);

  if (uploadError) {
    console.error('Error uploading image:', uploadError);
    return { url: null, error: uploadError };
  }

  const { data } = supabaseAdmin.storage.from('product-images').getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}

/** Sobe o arquivo .obj do Visualizador 3D de um produto. */
export async function uploadProductModel3D(file) {
  if (!isSupabaseConfigured) return { url: null, error: new Error('Supabase não configurado') };

  if (!file.name.toLowerCase().endsWith('.obj')) {
    return { url: null, error: new Error('O arquivo precisa ter a extensão .obj') };
  }

  const path = `${crypto.randomUUID()}.obj`;
  const { error: uploadError } = await supabaseAdmin.storage.from('product-models-3d').upload(path, file);

  if (uploadError) {
    console.error('Error uploading 3D model:', uploadError);
    return { url: null, error: uploadError };
  }

  const { data } = supabaseAdmin.storage.from('product-models-3d').getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}

// ---------------------------------------------------------------------------
// Arquivos do pedido (bucket order-assets): imagem original em qualidade
// máxima enviada pelo cliente no Studio, prévia composta gerada no Passo 4,
// e o zip com os originais de todos os itens — tudo exibido em Pedidos.
// (Sessão do Studio — quem sobe é a unidade logada.)
// ---------------------------------------------------------------------------

async function uploadOrderAsset(folder, blob, extension) {
  if (!isSupabaseConfigured) return { url: null, error: new Error('Supabase não configurado') };

  const path = `${folder}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from('order-assets').upload(path, blob);

  if (uploadError) {
    console.error(`Error uploading order asset (${folder}):`, uploadError);
    return { url: null, error: uploadError };
  }

  const { data } = supabase.storage.from('order-assets').getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}

/** Sobe o arquivo original (qualidade máxima) assim que o cliente escolhe a
 * imagem no Studio — roda em paralelo com a edição, sem travar o canvas. */
export async function uploadOrderOriginalImage(file) {
  const extension = file.name.split('.').pop() || 'png';
  return uploadOrderAsset('originals', file, extension);
}

/** Sobe a prévia (PNG) composta pelo Studio, pra exibir no painel de Pedidos. */
export async function uploadOrderPreview(blob) {
  return uploadOrderAsset('previews', blob, 'png');
}

/** Sobe o zip com as imagens originais de um item do pedido. */
export async function uploadOrderOriginalsZip(blob) {
  return uploadOrderAsset('zips', blob, 'zip');
}

/** Sobe a arte montada (PNG transparente, sem mockup) que a produção usa direto. */
export async function uploadOrderArt(blob) {
  return uploadOrderAsset('art', blob, 'png');
}

// ---------------------------------------------------------------------------
// Variação por Modelo (estoque + mockup por Produto+Modelo)
// ---------------------------------------------------------------------------

/** Substitui a lista de variações (marca/modelo + estoque + mockup) de um
 * produto pela lista atual do formulário — mesmo padrão de replaceProductChildren. */
export async function replaceProductModelVariants(productId, variants = []) {
  if (!isSupabaseConfigured) return { error: new Error('Supabase não configurado') };

  await supabaseAdmin.from('product_model_variants').delete().eq('product_id', productId);

  if (variants.length === 0) return { error: null };

  const { error } = await supabaseAdmin.from('product_model_variants').insert(
    variants.map((v) => ({
      product_id: productId,
      brand_model_id: v.brandModelId,
      stock_quantity: v.stockQuantity,
      bling_sku: v.blingSku?.trim() || null,
    }))
  );

  if (error) console.error('Error replacing product model variants:', error);
  return { error };
}

// ---------------------------------------------------------------------------
// Revendedores / pontos de venda
// ---------------------------------------------------------------------------

export async function fetchResellers() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabaseAdmin.from('resellers').select('*').order('name');
  if (error) {
    console.error('Error fetching resellers:', error);
    return [];
  }
  return data;
}

export async function saveReseller(resellerId, payload) {
  if (!isSupabaseConfigured) return { data: null, error: new Error('Supabase não configurado') };

  const query = resellerId
    ? supabaseAdmin.from('resellers').update(payload).eq('id', resellerId).select().single()
    : supabaseAdmin.from('resellers').insert(payload).select().single();

  const { data, error } = await query;
  if (error) console.error('Error saving reseller:', error);
  return { data, error };
}

export async function deleteReseller(resellerId) {
  if (!isSupabaseConfigured) return { error: new Error('Supabase não configurado') };
  const { error } = await supabaseAdmin.from('resellers').delete().eq('id', resellerId);
  if (error) console.error('Error deleting reseller:', error);
  return { error };
}

/** Cria ou redefine o login (usuário/senha) de uma unidade. Chama a Edge
 * Function porque criar/editar um usuário de autenticação exige a service
 * role key, que nunca pode ir pro bundle do frontend. Usa a sessão do Painel
 * (master): a Edge Function valida o token de quem chamou. */
export async function provisionResellerLogin({ action, resellerId, email, password }) {
  if (!isSupabaseConfigured) return { error: new Error('Supabase não configurado') };

  const { data, error } = await supabaseAdmin.functions.invoke('create-reseller-login', {
    body: { action, resellerId, email, password },
  });

  if (error) {
    console.error('Error provisioning reseller login:', error);
    return { error };
  }
  if (data?.error) return { error: new Error(data.error) };
  return { error: null };
}

// ---------------------------------------------------------------------------
// Usuários do Painel (staff) — gestão só pelo master
// ---------------------------------------------------------------------------

/** Lista os usuários do painel (papel staff) com e-mail e permissões. */
export async function fetchPanelUsers() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, email, permissions, created_at')
    .eq('role', 'staff')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Error fetching panel users:', error);
    return [];
  }
  return data;
}

/** Cria/edita/redefine senha/exclui um usuário do painel. Passa pela Edge
 * Function (service role) porque mexe em usuário de autenticação; ela valida
 * que quem chamou é master. Sessão do Painel. */
export async function managePanelUser({ action, userId, email, password, permissions }) {
  if (!isSupabaseConfigured) return { error: new Error('Supabase não configurado') };

  const { data, error } = await supabaseAdmin.functions.invoke('manage-panel-user', {
    body: { action, userId, email, password, permissions },
  });

  if (error) {
    console.error('Error managing panel user:', error);
    return { error };
  }
  if (data?.error) return { error: new Error(data.error) };
  return { error: null };
}

/** Papel + permissões da sessão do Painel (master ou staff) — usado pelo
 * AdminGuard pra gatear seções. */
export async function fetchAdminProfile() {
  if (!isSupabaseConfigured) return null;

  const { data: userData } = await supabaseAdmin.auth.getUser();
  if (!userData?.user) return null;

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('role, permissions')
    .eq('id', userData.user.id)
    .single();

  if (error || !data) {
    console.error('Error fetching admin profile:', error);
    return null;
  }
  return { role: data.role, permissions: data.permissions || [] };
}

/** Identidade da sessão do Studio (a unidade/reseller logada, ou master) —
 * usada pra saber quem está operando o Studio (Header + reseller_id do pedido). */
export async function fetchCurrentIdentity() {
  if (!isSupabaseConfigured) return null;

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('role, reseller_id, reseller:resellers ( name )')
    .eq('id', userData.user.id)
    .single();

  if (error || !data) {
    console.error('Error fetching current identity:', error);
    return null;
  }

  return {
    role: data.role,
    resellerId: data.reseller_id || null,
    resellerName: data.reseller?.name || null,
  };
}

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------

export async function fetchOrders() {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabaseAdmin
    .from('orders')
    .select(`
      id, order_number, sequence_number, customer_name, customer_contact, customer_note, quantity,
      personalization_fee, unit_price, line_total, status, created_at,
      preview_image_url, original_files_zip_url, art_image_url,
      reseller_id, reseller_name,
      product:products ( name ),
      color:product_colors ( name ),
      size:product_sizes ( name ),
      model:brand_models ( name )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching orders:', error);
    return [];
  }
  return data;
}

/** Pedidos da unidade logada (reseller) — RLS ("orders reseller read own")
 * já restringe pro que ela mesma fez, não precisa filtrar aqui. Sessão do Studio. */
export async function fetchMyOrders() {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('orders')
    .select(`
      id, order_number, sequence_number, customer_name, customer_contact, customer_note, quantity,
      line_total, status, created_at, preview_image_url,
      product:products ( name ),
      color:product_colors ( name ),
      size:product_sizes ( name ),
      model:brand_models ( name )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching my orders:', error);
    return [];
  }
  return data;
}

export async function updateOrderStatus(orderId, status) {
  if (!isSupabaseConfigured) return { error: new Error('Supabase não configurado') };
  const { error } = await supabaseAdmin.from('orders').update({ status }).eq('id', orderId);
  if (error) console.error('Error updating order status:', error);
  return { error };
}

/** Sobe a prévia do item (PNG já capturado no Passo 4) e monta+sobe um zip
 * com as imagens originais (qualidade máxima) de cada elemento de imagem —
 * pra aparecer completo no painel de Pedidos. Uma falha aqui não deve travar
 * o checkout, só deixa aquele campo vazio no pedido. */
async function buildOrderAssets(item) {
  let previewUrl = null;
  let zipUrl = null;
  let artUrl = null;

  try {
    if (item.thumbnail) {
      const previewBlob = await (await fetch(item.thumbnail)).blob();
      const { url } = await uploadOrderPreview(previewBlob);
      previewUrl = url;
    }
  } catch (err) {
    console.error('Error uploading order preview:', err);
  }

  try {
    if (item.artImage) {
      const artBlob = await (await fetch(item.artImage)).blob();
      const { url } = await uploadOrderArt(artBlob);
      artUrl = url;
    }
  } catch (err) {
    console.error('Error uploading order art:', err);
  }

  try {
    const imageElements = (item.elements || []).filter((el) => el.type === 'image' && el.originalImageUrl);
    if (imageElements.length > 0) {
      const zip = new JSZip();
      await Promise.all(
        imageElements.map(async (el, index) => {
          const blob = await (await fetch(el.originalImageUrl)).blob();
          const extension = el.originalImageUrl.split('.').pop().split('?')[0] || 'png';
          zip.file(`imagem-${index + 1}.${extension}`, blob);
        })
      );
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const { url } = await uploadOrderOriginalsZip(zipBlob);
      zipUrl = url;
    }
  } catch (err) {
    console.error('Error building order originals zip:', err);
  }

  return { previewUrl, zipUrl, artUrl };
}

/** Grava um pedido por item do carrinho — chamado a partir do "Finalizar
 * Compra". `customer.resellerId` vem da identidade logada (a unidade que
 * está operando o Studio), não de um campo de formulário. Sessão do Studio. */
export async function submitOrders(cartItems, customer) {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured. Order not persisted.');
    return { error: null, skipped: true };
  }

  const rows = await Promise.all(
    cartItems.map(async (item) => {
      const { previewUrl, zipUrl, artUrl } = await buildOrderAssets(item);
      return {
        customer_name: customer.name,
        customer_contact: customer.contact || null,
        customer_note: customer.note || null,
        reseller_id: customer.resellerId || null,
        product_id: item.productId,
        color_id: item.colorId || null,
        size_id: item.sizeId || null,
        model_id: item.modelId || null,
        quantity: item.quantity,
        personalization_snapshot: item.elements && item.elements.length > 0 ? item.elements : null,
        personalization_fee: item.personalizationFee,
        unit_price: item.unitPrice,
        line_total: item.lineTotal,
        preview_image_url: previewUrl,
        original_files_zip_url: zipUrl,
        art_image_url: artUrl,
      };
    })
  );

  // Via RPC (função security definer) em vez de insert direto: a policy de
  // orders só permite escrita pro master. A função também desconta o
  // estoque do modelo escolhido, atomicamente.
  const { error } = await supabase.rpc('place_order', { order_rows: rows });
  if (error) console.error('Error submitting orders:', error);
  return { error, skipped: false };
}
