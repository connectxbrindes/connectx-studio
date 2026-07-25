import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import Header from '../components/layout/Header';
import StepIndicator from '../components/layout/StepIndicator';
import CartDrawer from '../components/layout/CartDrawer';
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

export default function Storefront() {
  const currentStep = useStore((s) => s.currentStep);
  const catalogLoaded = useStore((s) => s.catalogLoaded);
  const setCatalog = useStore((s) => s.setCatalog);
  const StepComponent = STEP_COMPONENTS[currentStep];
  const stepRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      const data = await fetchCatalog();
      if (mounted) setCatalog(data);
    }
    loadData();
    return () => { mounted = false; };
  }, [setCatalog]);

  useEffect(() => {
    stepRef.current?.focus();
  }, [currentStep]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 py-4 sm:px-10">
        {!catalogLoaded ? (
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
      <CartDrawer />
      <Toast />
    </div>
  );
}
