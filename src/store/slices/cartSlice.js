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

  updateQuantity: (id, quantity) => set((state) => ({
    items: state.items.map((item) => (item.id === id ? { ...item, quantity: Math.max(1, quantity) } : item)),
  })),

  clearCart: () => set({ items: [] }),

  openDrawer: () => set({ isDrawerOpen: true }),
  closeDrawer: () => set({ isDrawerOpen: false }),

  showToast: (message) => set({ toast: message }),
  dismissToast: () => set({ toast: null }),

  cartCount: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
  cartSubtotal: () => get().items.reduce((sum, item) => sum + item.lineTotal, 0),
});
