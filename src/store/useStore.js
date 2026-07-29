import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createWizardSlice } from './slices/wizardSlice';
import { createConfiguratorSlice } from './slices/configuratorSlice';
import { createCartSlice } from './slices/cartSlice';
import { createIdentitySlice } from './slices/identitySlice';
import { idbStorage } from './idbStorage';

export const useStore = create(
  persist(
    (set, get) => ({
      ...createWizardSlice(set, get),
      ...createConfiguratorSlice(set, get),
      ...createCartSlice(set, get),
      ...createIdentitySlice(set, get),
    }),
    {
      name: 'personalization-studio-cart-v2',
      // IndexedDB (não localStorage): os itens guardam imagens em base64 que
      // estouram a cota de ~5MB do localStorage e faziam o carrinho voltar
      // vazio no reload. Ver src/store/idbStorage.js.
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({ items: state.items }),
    }
  )
);
