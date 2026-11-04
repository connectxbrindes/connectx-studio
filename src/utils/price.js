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

/** Preço que o cliente da loja paga por unidade: produto + personalização. */
export const storeUnitPrice = (product) => (product?.price || 0) + PERSONALIZATION_FEE;
