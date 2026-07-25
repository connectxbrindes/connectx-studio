import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createWizardSlice } from './slices/wizardSlice';
import { createConfiguratorSlice } from './slices/configuratorSlice';
import { createCartSlice } from './slices/cartSlice';
import { createIdentitySlice } from './slices/identitySlice';

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
      partialize: (state) => ({ items: state.items }),
    }
  )
);
