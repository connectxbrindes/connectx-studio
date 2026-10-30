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

/** Grava o pedido da loja. Preços/descontos são recalculados no banco. */
export async function submitStoreOrder(cartItems, { token, customer }) {
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

  const { data, error } = await supabaseStore.rpc('place_store_order', {
    order_rows: rows,
    p_token: token || null,
    p_customer: customer,
  });
  if (error) return { error: friendlyError(error, 'Não foi possível enviar o pedido. Tente novamente.') };
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
