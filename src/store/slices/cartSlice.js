// Mudou a quantidade no carrinho → recalcula o total da linha (preço + personalização).
const withQuantity = (item, quantity) => ({
  ...item,
  quantity,
  lineTotal: (Number(item.unitPrice) + Number(item.personalizationFee || 0)) * quantity,
});

export const createCartSlice = (set, get) => ({
  items: [],
  isDrawerOpen: false,
  toast: null,

  addItem: (item) => set((state) => ({
    items: [...state.items, { ...item, id: crypto.randomUUID() }],
  })),

  removeItem: (id) => set((state) => ({
    items: state.items.filter((item) => item.id !== id),
  })),

  // Trava no pedido mínimo do item (padrão 1).
  updateQuantity: (id, quantity) => set((state) => ({
    items: state.items.map((item) =>
      item.id === id ? withQuantity(item, Math.max(item.minOrderQty || 1, quantity)) : item
    ),
  })),

  clearCart: () => set({ items: [] }),

  openDrawer: () => set({ isDrawerOpen: true }),
  closeDrawer: () => set({ isDrawerOpen: false }),

  showToast: (message) => set({ toast: message }),
  dismissToast: () => set({ toast: null }),

  cartCount: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
  cartSubtotal: () => get().items.reduce((sum, item) => sum + item.lineTotal, 0),
});
