import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import Header from '../components/layout/Header';
import StepIndicator from '../components/layout/StepIndicator';
import CartDrawer from '../components/layout/CartDrawer';
import StoreCartDrawer from '../components/store/StoreCartDrawer';
import StoreAuthModal from '../components/store/StoreAuthModal';
import StudioTour from '../components/studio/StudioTour';
import Toast from '../components/ui/Toast';
import Step1ChooseProduct from '../components/steps/Step1ChooseProduct';
import Step2ChooseVariant from '../components/steps/Step2ChooseVariant';
import Step3Personalize from '../components/steps/Step3Personalize';
import Step4Review from '../components/steps/Step4Review';
import { fetchCatalog } from '../lib/api';

const STEP_COMPONENTS = {
  1: Step1ChooseProduct,
  2: Step2ChooseVariant,
  3: Step3Personalize,
  4: Step4Review,
};

// `channel="store"` = loja virtual de varejo (/store): carrinho com token,
// preços visíveis e cadastro do cliente no checkout.
export default function Storefront({ channel = 'studio', initialProductSlug = null, initialColorId = null, initialQuantity = null }) {
  const isStore = channel === 'store';
  const setChannel = useStore((s) => s.setChannel);
  const currentStep = useStore((s) => s.currentStep);
  const catalogLoaded = useStore((s) => s.catalogLoaded);
  const setCatalog = useStore((s) => s.setCatalog);
  const setPreviewMode = useStore((s) => s.setPreviewMode);
  const resetWizard = useStore((s) => s.resetWizard);
  const StepComponent = STEP_COMPONENTS[currentStep];
  const stepRef = useRef(null);
  const navigate = useNavigate();
  // Loja: só libera a tela depois de aplicar o produto da URL (evita piscar o Passo 1).
  const [storeReady, setStoreReady] = useState(!isStore);

  // Ao entrar no Studio (ex: voltando de "Meus Pedidos"), começa do Passo 1 —
  // sem isso, o currentStep ficava no valor antigo (ex: Revisão) enquanto o
  // produto era resetado, dando aquela tela em branco. E garante que não está
  // em modo prévia (não vazou do painel).
  useEffect(() => {
    setPreviewMode(false);
    resetWizard();
  }, [setPreviewMode, resetWizard]);

  useEffect(() => {
    setChannel(channel);
  }, [channel, setChannel]);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      const data = await fetchCatalog();
      if (!mounted) return;
      setCatalog(data);
      // Loja virtual: veio do botão "Personalizar" da vitrine — já entra no
      // Passo 2 (Variação) com o produto e a cor escolhidos.
      const product = initialProductSlug && data.find((p) => p.slug === initialProductSlug);
      if (product) {
        const state = useStore.getState();
        state.selectProduct(product.id);
        const color = product.options.colors.find((c) => c.id === initialColorId);
        if (color) state.selectColor(color);
        // Quantidade escolhida no seletor de atacado da página do produto.
        if (initialQuantity > 1) state.setQuantity(Math.min(initialQuantity, 10000));
        useStore.setState({ currentStep: 2, furthestStep: 2 });
      }
      setStoreReady(true);
    }
    loadData();
    return () => { mounted = false; };
  }, [setCatalog, initialProductSlug, initialColorId, initialQuantity]);

  // Loja: o Passo 1 (escolher produto) é só dos revendedores. O cliente da loja
  // escolhe na vitrine — voltar para o Passo 1 leva à página do produto.
  useEffect(() => {
    if (!isStore || !storeReady || currentStep !== 1) return;
    // "Voltar" na Variação → página do produto; Studio zerado (ex: continuar comprando) → vitrine.
    const { selectedProduct, furthestStep } = useStore.getState();
    const slug = furthestStep > 1 ? selectedProduct?.slug : null;
    navigate(slug ? `/store/p/${slug}` : '/store#produtos', { replace: true });
  }, [isStore, storeReady, currentStep, navigate]);

  useEffect(() => {
    stepRef.current?.focus();
  }, [currentStep]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header channel={channel} />
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 py-4 sm:px-10">
        {!catalogLoaded || !storeReady || (isStore && currentStep === 1) ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent"></div>
          </div>
        ) : (
          <>
            <StepIndicator />
            <div
              key={currentStep}
              ref={stepRef}
              tabIndex={-1}
              className="animate-fade-in outline-none motion-reduce:animate-none"
            >
              <StepComponent />
            </div>
          </>
        )}
      </main>
      {isStore ? <StoreCartDrawer /> : <CartDrawer />}
      {isStore && <StoreAuthModal />}
      <StudioTour />
      <Toast />
    </div>
  );
}
