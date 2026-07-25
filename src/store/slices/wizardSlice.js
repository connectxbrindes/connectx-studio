export const STEPS = [
  { id: 1, key: 'product', label: 'Produto' },
  { id: 2, key: 'variant', label: 'Variação' },
  { id: 3, key: 'personalize', label: 'Personalizar' },
  { id: 4, key: 'review', label: 'Revisão' },
];

const withViewTransition = (update) => {
  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (typeof document !== 'undefined' && document.startViewTransition && !prefersReducedMotion) {
    document.startViewTransition(update);
  } else {
    update();
  }
};

export const createWizardSlice = (set, get) => ({
  currentStep: 1,
  furthestStep: 1,

  goNext: () => withViewTransition(() => set((state) => {
    const next = Math.min(state.currentStep + 1, STEPS.length);
    return { currentStep: next, furthestStep: Math.max(state.furthestStep, next) };
  })),

  goBack: () => withViewTransition(() => set((state) => ({
    currentStep: Math.max(state.currentStep - 1, 1),
  }))),

  goToStep: (step) => withViewTransition(() => set((state) => {
    if (step > state.furthestStep) return {};
    return { currentStep: step };
  })),

  resetWizard: () => set({ currentStep: 1, furthestStep: 1 }),

  canProceed: () => {
    const state = get();
    if (state.currentStep === 2) {
      const product = state.selectedProduct;
      if (!product) return false;
      if (product.options.models && !state.selectedModel) return false;
      if (product.options.sizes && !state.selectedSize) return false;
      return true;
    }
    return true;
  },
});
