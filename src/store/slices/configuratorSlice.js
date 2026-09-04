// Modelos podem trazer uma marca (brandId/brandName) — quando isso acontece,
// o Studio precisa oferecer um seletor de Marca antes do Modelo, respeitando
// a hierarquia (só mostrar os modelos daquela marca). Produtos com modelos
// sem marca (dado legado) continuam funcionando como uma lista única, sem o
// seletor.
function deriveModelSelection(product) {
  const models = product?.options.models || null;
  if (!models) return { modelBrands: [], selectedBrand: null, selectedModel: null };

  const brandsById = new Map();
  for (const m of models) {
    if (m.brandId && !brandsById.has(m.brandId)) {
      brandsById.set(m.brandId, { id: m.brandId, name: m.brandName });
    }
  }
  const modelBrands = [...brandsById.values()];
  const selectedBrand = modelBrands[0] || null;
  const modelsForBrand = selectedBrand ? models.filter((m) => m.brandId === selectedBrand.id) : models;

  return { modelBrands, selectedBrand, selectedModel: modelsForBrand[0] || null };
}

export const createConfiguratorSlice = (set) => ({
  catalog: [],
  catalogLoaded: false,
  selectedProduct: null,
  selectedColor: null,
  selectedSize: null,
  modelBrands: [],
  selectedBrand: null,
  selectedModel: null,
  quantity: 1,
  elements: [],
  selectedElementId: null,
  // true quando o fluxo roda como prévia dentro do painel (sem carrinho/pedido).
  previewMode: false,

  setPreviewMode: (value) => set({ previewMode: value }),

  setCatalog: (products) => set(() => {
    const defaultProduct = products.length > 0 ? products[0] : null;
    return {
      catalog: products,
      catalogLoaded: true,
      selectedProduct: defaultProduct,
      selectedColor: defaultProduct ? defaultProduct.options.colors[0] : null,
      selectedSize: defaultProduct?.options.sizes ? defaultProduct.options.sizes[0] : null,
      ...deriveModelSelection(defaultProduct),
      quantity: defaultProduct?.minOrderQty || 1,
      elements: [],
      selectedElementId: null,
    };
  }),

  selectProduct: (productId) => set((state) => {
    const product = state.catalog.find((p) => p.id === productId);
    if (!product) return {};
    return {
      selectedProduct: product,
      selectedColor: product.options.colors[0],
      selectedSize: product.options.sizes ? product.options.sizes[0] : null,
      ...deriveModelSelection(product),
      quantity: product.minOrderQty || 1,
      elements: [],
      selectedElementId: null,
    };
  }),

  selectColor: (color) => set({ selectedColor: color }),
  selectSize: (size) => set({ selectedSize: size }),
  selectBrand: (brand) => set((state) => {
    const modelsForBrand = state.selectedProduct?.options.models?.filter((m) => m.brandId === brand.id) || [];
    return { selectedBrand: brand, selectedModel: modelsForBrand[0] || null };
  }),
  selectModel: (model) => set({ selectedModel: model }),
  // Trava no pedido mínimo do produto (padrão 1 quando não há mínimo).
  setQuantity: (quantity) => set((state) => ({
    quantity: Math.max(state.selectedProduct?.minOrderQty || 1, quantity),
  })),

  resetConfigurator: () => set((state) => {
    const product = state.catalog.length > 0 ? state.catalog[0] : null;
    return {
      selectedProduct: product,
      selectedColor: product ? product.options.colors[0] : null,
      selectedSize: product?.options.sizes ? product.options.sizes[0] : null,
      ...deriveModelSelection(product),
      quantity: product?.minOrderQty || 1,
      elements: [],
      selectedElementId: null,
    };
  }),

  addTextElement: () => set((state) => {
    if (!state.selectedProduct) return {};
    const id = crypto.randomUUID();
    const area = state.selectedProduct.personalizationArea;
    const element = {
      id,
      type: 'text',
      x: area.x + area.width / 2 - 15,
      y: area.y + area.height / 2 - 5,
      width: 30,
      height: 10,
      rotation: area.angle || 0,
      zIndex: state.elements.length + 1,
      content: 'Seu texto aqui',
      fontFamily: 'Inter, sans-serif',
      fontSize: 20,
      fontWeight: 600,
      color: '#1a1a1a',
      textAlign: 'center',
    };
    return { elements: [...state.elements, element], selectedElementId: id };
  }),

  addImageElement: (src, naturalWidth, naturalHeight, containerAspect) => set((state) => {
    if (!state.selectedProduct) return {};
    const id = crypto.randomUUID();
    const area = state.selectedProduct.personalizationArea;
    const naturalAspect = naturalWidth && naturalHeight ? naturalWidth / naturalHeight : 1;
    // width/height do elemento são % da largura/altura do container. Pra a
    // caixa nascer com a MESMA proporção da imagem (sem esticar), converto
    // usando a proporção real (largura/altura em px) do container — medida na
    // hora e passada pelo Toolbar. Fallback: mockup usa aspect-[331/590];
    // térmico sem medida assume quadrado.
    const cAspect = containerAspect && containerAspect > 0
      ? containerAspect
      : (state.selectedModel?.mockupImageUrl ? 331 / 590 : 1);
    const width = Math.min(area.width, 25);
    const height = (width * cAspect) / naturalAspect;
    const element = {
      id,
      type: 'image',
      x: area.x + area.width / 2 - width / 2,
      y: area.y + area.height / 2 - height / 2,
      width,
      height,
      rotation: area.angle || 0,
      zIndex: state.elements.length + 1,
      src,
      naturalWidth,
      naturalHeight,
    };
    return { elements: [...state.elements, element], selectedElementId: id };
  }),

  updateElement: (id, patch) => set((state) => ({
    elements: state.elements.map((el) => (el.id === id ? { ...el, ...patch } : el)),
  })),

  removeElement: (id) => set((state) => ({
    elements: state.elements.filter((el) => el.id !== id),
    selectedElementId: state.selectedElementId === id ? null : state.selectedElementId,
  })),

  selectElement: (id) => set({ selectedElementId: id }),

  bringToFront: (id) => set((state) => {
    const maxZ = Math.max(0, ...state.elements.map((el) => el.zIndex));
    return {
      elements: state.elements.map((el) => (el.id === id ? { ...el, zIndex: maxZ + 1 } : el)),
    };
  }),

  clearElements: () => set({ elements: [], selectedElementId: null }),
});
