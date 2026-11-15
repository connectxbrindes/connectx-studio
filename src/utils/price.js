export const PERSONALIZATION_FEE = 19.90;

export function formatCurrency(value) {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

export function computePersonalizationFee(elements) {
  return elements.length > 0 ? PERSONALIZATION_FEE : 0;
}

export function computeLineTotal({ unitPrice, quantity, elements }) {
  const fee = computePersonalizationFee(elements);
  return (unitPrice + fee) * quantity;
}

/** Preço que o cliente da loja paga por unidade: o preço final do Painel
 * (Loja virtual → Preços e descontos), já com a personalização. Sem ele,
 * regra antiga: produto + personalização. */
export const storeUnitPrice = (product) =>
  product?.storePrice != null ? product.storePrice : (product?.price || 0) + PERSONALIZATION_FEE;

/** Preço por unidade numa faixa de atacado (R$ da faixa; faixas antigas em %). */
export const tierUnitPrice = (tier, unitPrice) =>
  tier.unitPrice != null ? tier.unitPrice : unitPrice * (1 - (tier.discountPct || 0) / 100);

/** Faixa de atacado que vale para a quantidade (a maior faixa alcançada), ou null.
 * tiers = [{ minQty, unitPrice }] do produto. Mesma regra do banco (place_store_order). */
export function tierFor(tiers, quantity) {
  return (tiers || [])
    .filter((t) => t.minQty <= quantity)
    .reduce((best, t) => (!best || t.minQty > best.minQty ? t : best), null);
}

/** Próxima faixa ainda não alcançada (para sugerir "leve X e ganhe Y%"). */
export function nextTier(tiers, quantity) {
  return (tiers || [])
    .filter((t) => t.minQty > quantity)
    .reduce((best, t) => (!best || t.minQty < best.minQty ? t : best), null);
}
