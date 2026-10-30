// Estado da loja virtual de varejo (/store). `channel` diz se o Studio está
// rodando como loja ('store') ou como o Studio das unidades ('studio').
export const createStoreSlice = (set) => ({
  channel: 'studio',
  storeCustomer: null,
  campaignProductIds: [],
  isStoreAuthOpen: false,
  upsellDismissed: false,

  setChannel: (channel) => set({ channel }),
  setStoreCustomer: (storeCustomer) => set({ storeCustomer }),
  setCampaignProductIds: (campaignProductIds) => set({ campaignProductIds }),
  openStoreAuth: () => set({ isStoreAuthOpen: true }),
  closeStoreAuth: () => set({ isStoreAuthOpen: false }),
  dismissUpsell: () => set({ upsellDismissed: true }),
});
