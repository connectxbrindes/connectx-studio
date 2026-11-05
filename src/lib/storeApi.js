import { supabaseStore, supabaseAdmin, isSupabaseConfigured } from './supabaseClient';
import { buildOrderAssets } from './api';

// ---------------------------------------------------------------------------
// Loja virtual de varejo (/store) — sessão do cliente final (supabaseStore).
// ---------------------------------------------------------------------------

/** Mensagens amigáveis para os códigos de erro que as funções do banco lançam. */
const ERROR_MESSAGES = {
  TOKEN_INVALIDO: 'Código não encontrado. Confira os caracteres do seu cartão.',
  TOKEN_JA_USADO: 'Este código já foi utilizado.',
  TOKEN_INATIVO: 'Este código não está ativo.',
  TOKEN_PRODUTO_AUSENTE: 'Este código não vale para os produtos do seu carrinho.',
  NAO_AUTENTICADO: 'Entre na sua conta para finalizar a compra.',
  NOME_OBRIGATORIO: 'Informe seu nome.',
  CARRINHO_VAZIO: 'Seu carrinho está vazio.',
  PRODUTO_INDISPONIVEL: 'Um dos produtos do carrinho não está mais disponível.',
  SEM_PERMISSAO: 'Sem permissão para esta ação.',
  QUANTIDADE_INVALIDA: 'Quantidade inválida (1 a 10.000).',
  TAMANHO_INVALIDO: 'Tamanho do código inválido (6 a 16).',
  PREFIXO_INVALIDO: 'Prefixo inválido (até 6 letras/números).',
  PRODUTO_OBRIGATORIO: 'Escolha pelo menos um produto.',
  ENDERECO_INCOMPLETO: 'Preencha o endereço completo para entrega.',
};

export function friendlyError(error, fallback = 'Algo deu errado. Tente novamente.') {
  const raw = typeof error === 'string' ? error : error?.message || '';
  const code = Object.keys(ERROR_MESSAGES).find((k) => raw.includes(k));
  return code ? ERROR_MESSAGES[code] : fallback;
}

export function onStoreAuthChange(callback) {
  if (!isSupabaseConfigured) return () => {};
  const { data } = supabaseStore.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

/** Cliente logado na loja: { id, email, name, phone } ou null. */
export async function fetchStoreCustomer() {
  if (!isSupabaseConfigured) return null;
  const { data: sessionData } = await supabaseStore.auth.getSession();
  const user = sessionData?.session?.user;
  if (!user) return null;
  const { data } = await supabaseStore.from('store_customers').select('name, phone').eq('id', user.id).maybeSingle();
  return {
    id: user.id,
    email: user.email,
    name: data?.name || user.user_metadata?.name || '',
    phone: data?.phone || user.user_metadata?.phone || '',
  };
}

export async function storeSignUp({ name, email, phone, password }) {
  const { data, error } = await supabaseStore.functions.invoke('store-signup', {
    body: { name, email, phone, password },
  });
  if (error) return { error: 'Não foi possível criar o cadastro. Tente novamente.' };
  if (data?.error) return { error: data.error };
  return storeSignIn({ email, password });
}

export async function storeSignIn({ email, password }) {
  const { error } = await supabaseStore.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) return { error: 'E-mail ou senha incorretos.' };
  return { error: null };
}

export async function storeSignOut() {
  await supabaseStore.auth.signOut();
}

export async function checkCampaignToken(code) {
  const { data, error } = await supabaseStore.rpc('check_campaign_token', { p_code: code });
  if (error) return { valid: false, message: 'Não foi possível validar o código agora.' };
  if (!data?.valid) return { valid: false, message: friendlyError(data?.reason) };
  return { valid: true, code: data.code, productIds: data.product_ids || [], productNames: data.product_names || [] };
}

export async function fetchCampaignProductIds() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabaseStore.rpc('campaign_product_ids');
  if (error) return [];
  return (data || []).map((row) => (typeof row === 'string' ? row : row.campaign_product_ids));
}

/** O que está ligado na loja: frete pelos Correios (tabela por estado), pagamento
 * online (Mercado Pago) e o endereço de retirada. */
export async function fetchStoreConfig() {
  const fallback = { shipping: false, payment: false, pickupAddress: '' };
  if (!isSupabaseConfigured) return fallback;
  const [{ data: fnData }, { data: settings }] = await Promise.all([
    supabaseStore.functions.invoke('store-checkout', { body: { action: 'config' } }),
    supabaseStore.from('store_settings').select('pickup_address, shipping_enabled').eq('id', 1).maybeSingle(),
  ]);
  return {
    shipping: Boolean(fnData?.shipping && settings?.shipping_enabled),
    payment: Boolean(fnData?.payment),
    pickupAddress: settings?.pickup_address || '',
  };
}

/** Cota PAC/SEDEX pro CEP. items = itens do carrinho. */
export async function quoteShipping(cep, items) {
  const { data, error } = await supabaseStore.functions.invoke('store-checkout', {
    body: {
      action: 'quote',
      cep,
      items: items.map((it) => ({
        product_id: it.productId,
        quantity: it.quantity,
        personalized: Boolean(it.elements && it.elements.length > 0),
      })),
    },
  });
  if (error) return { error: 'Não foi possível calcular o frete agora.' };
  if (data?.error) return { error: data.error };
  return { options: data.options || [] };
}

/** Endereço pelo CEP (ViaCEP, público). */
export async function lookupCep(cep) {
  const digits = (cep || '').replace(/\D/g, '');
  if (digits.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    const data = await res.json();
    if (data.erro) return null;
    return { street: data.logradouro || '', district: data.bairro || '', city: data.localidade || '', state: data.uf || '' };
  } catch {
    return null;
  }
}

/** Finaliza a compra: sobe as artes, grava o pedido e (se houver valor a
 * pagar) recebe o link do Mercado Pago. Preço e frete são recalculados no
 * servidor. Retorno: { status: 'payment'|'free'|'manual', init_point?, order_numbers, total }. */
export async function submitStoreOrder(cartItems, { token, customer, delivery, address, shippingServiceId }) {
  const rows = await Promise.all(
    cartItems.map(async (item) => {
      const { previewUrl, zipUrl, artUrl } = await buildOrderAssets(item, supabaseStore);
      return {
        product_id: item.productId,
        color_id: item.colorId || null,
        size_id: item.sizeId || null,
        model_id: item.modelId || null,
        quantity: item.quantity,
        personalization_snapshot: item.elements && item.elements.length > 0 ? item.elements : null,
        preview_image_url: previewUrl,
        original_files_zip_url: zipUrl,
        art_image_url: artUrl,
      };
    })
  );

  const { data, error } = await supabaseStore.functions.invoke('store-checkout', {
    body: {
      action: 'checkout',
      order_rows: rows,
      token: token || null,
      customer,
      delivery,
      address: delivery === 'shipping' ? address : null,
      shipping_service_id: shippingServiceId || null,
    },
  });
  if (error) return { error: 'Não foi possível enviar o pedido. Tente novamente.' };
  if (data?.error) return { error: data.error };
  return { error: null, result: data };
}

// ---------------------------------------------------------------------------
// Painel — gestão de tokens da campanha (sessão do Painel)
// ---------------------------------------------------------------------------

export async function fetchTokenBatches() {
  const { data, error } = await supabaseAdmin.rpc('campaign_token_batch_stats');
  if (error) {
    console.error('Error fetching token batches:', error);
    return [];
  }
  return data || [];
}

export async function generateTokenBatch({ name, productIds, quantity, prefix, length }) {
  const { data, error } = await supabaseAdmin.rpc('generate_campaign_tokens', {
    p_name: name,
    p_product_ids: productIds,
    p_quantity: quantity,
    p_prefix: prefix || null,
    p_length: length,
  });
  if (error) return { error: friendlyError(error, 'Não foi possível gerar o lote.') };
  return { error: null, batchId: data };
}

export async function setTokenBatchActive(batchId, active) {
  const { error } = await supabaseAdmin.from('campaign_token_batches').update({ active }).eq('id', batchId);
  return { error };
}

/** Todos os tokens de um lote (paginado — o PostgREST limita 1000 por chamada). */
export async function fetchBatchTokens(batchId) {
  const pageSize = 1000;
  const all = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from('campaign_tokens')
      .select('code, status, used_at, used_order_number')
      .eq('batch_id', batchId)
      .order('created_at', { ascending: true })
      .order('code', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) return { error, tokens: all };
    all.push(...data);
    if (data.length < pageSize) break;
  }
  return { error: null, tokens: all };
}

export async function findToken(code) {
  const normalized = (code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!normalized) return null;
  const { data } = await supabaseAdmin
    .from('campaign_tokens')
    .select('id, code, status, used_at, used_order_number, batch:campaign_token_batches ( name, active )')
    .eq('code', normalized)
    .maybeSingle();
  return data;
}

export async function setTokenStatus(tokenId, status) {
  const { error } = await supabaseAdmin.from('campaign_tokens').update({ status }).eq('id', tokenId).neq('status', 'used');
  return { error };
}

export async function fetchStoreSettings() {
  const { data } = await supabaseAdmin.from('store_settings').select('*').eq('id', 1).maybeSingle();
  return data;
}

export async function saveStoreSettings(payload) {
  const { error } = await supabaseAdmin
    .from('store_settings')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', 1);
  return { error };
}

/** Tabela de frete Correios (preço de balcão por estado de destino). */
export async function fetchShippingRates() {
  const { data } = await supabaseAdmin.from('shipping_rates').select('*').order('uf');
  return data || [];
}

/** Salva as linhas alteradas da tabela de frete. rows = [{ uf, ...campos }]. */
export async function saveShippingRates(rows) {
  const now = new Date().toISOString();
  const results = await Promise.all(
    rows.map(({ uf, ...fields }) => supabaseAdmin.from('shipping_rates').update({ ...fields, updated_at: now }).eq('uf', uf)),
  );
  return { error: results.find((r) => r.error)?.error || null };
}

// ---------------------------------------------------------------------------
// Banners da vitrine
// ---------------------------------------------------------------------------

/** Banners ativos e dentro do período (a regra de período fica no banco). */
export async function fetchPublicBanners() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabaseStore
    .from('store_banners')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) return [];
  return data || [];
}

export async function fetchAdminBanners() {
  const { data, error } = await supabaseAdmin
    .from('store_banners')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) {
    console.error('Error fetching banners:', error);
    return [];
  }
  return data || [];
}

export async function saveBanner(id, payload) {
  const body = { ...payload, updated_at: new Date().toISOString() };
  const { error } = id
    ? await supabaseAdmin.from('store_banners').update(body).eq('id', id)
    : await supabaseAdmin.from('store_banners').insert(body);
  return { error };
}

export async function deleteBanner(id) {
  const { error } = await supabaseAdmin.from('store_banners').delete().eq('id', id);
  return { error };
}

/** Grava a ordem (sort_order = posição na lista). */
export async function reorderBanners(ids) {
  const results = await Promise.all(
    ids.map((id, index) => supabaseAdmin.from('store_banners').update({ sort_order: index }).eq('id', id))
  );
  return { error: results.find((r) => r.error)?.error || null };
}

export async function uploadBannerImage(file) {
  const extension = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `banners/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabaseAdmin.storage.from('product-images').upload(path, file);
  if (error) {
    console.error('Error uploading banner:', error);
    return { url: null, error };
  }
  const { data } = supabaseAdmin.storage.from('product-images').getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}

// ---------------------------------------------------------------------------
// Dados da empresa (rodapé) e políticas — públicos
// ---------------------------------------------------------------------------

let publicInfoPromise = null;

/** Dados da empresa e políticas cadastrados no Painel (cache por sessão). */
export function fetchStorePublicInfo() {
  if (!isSupabaseConfigured) return Promise.resolve({});
  if (!publicInfoPromise) {
    publicInfoPromise = supabaseStore
      .from('store_settings')
      .select('company_name, cnpj, company_address, contact_whatsapp, contact_email, business_hours, pickup_address, exchange_policy, privacy_policy')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => data || {})
      .catch(() => ({}));
  }
  return publicInfoPromise;
}

// ---------- Descontos de atacado (Painel → Loja virtual → Preços e descontos) ----------

/** Faixas de desconto por quantidade, por produto, da menor para a maior.
 * Sem productId traz de todos (Painel). Leitura pública. */
export async function fetchPriceTiers(productId) {
  if (!isSupabaseConfigured) return [];
  let query = supabaseStore.from('store_price_tiers').select('product_id, min_qty, discount_pct').order('min_qty');
  if (productId) query = query.eq('product_id', productId);
  const { data, error } = await query;
  if (error) console.error('Error fetching price tiers:', error);
  return (data || []).map((t) => ({ productId: t.product_id, minQty: t.min_qty, discountPct: Number(t.discount_pct) }));
}

/** Substitui as faixas de um produto pelas informadas no Painel. */
export async function savePriceTiers(productId, tiers) {
  const { error: delError } = await supabaseAdmin.from('store_price_tiers').delete().eq('product_id', productId);
  if (delError) return { error: delError };
  if (tiers.length === 0) return { error: null };
  const { error } = await supabaseAdmin
    .from('store_price_tiers')
    .insert(tiers.map((t) => ({ product_id: productId, min_qty: t.minQty, discount_pct: t.discountPct })));
  return { error };
}

/** Atualiza o preço de venda (base_price) de um produto. */
export async function saveProductPrice(productId, basePrice) {
  const { error } = await supabaseAdmin.from('products').update({ base_price: basePrice }).eq('id', productId);
  return { error };
}
