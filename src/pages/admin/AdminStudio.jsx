import { useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { fetchCatalog } from '../../lib/api';
import StepIndicator from '../../components/layout/StepIndicator';
import Toast from '../../components/ui/Toast';
import Step1ChooseProduct from '../../components/steps/Step1ChooseProduct';
import Step2ChooseVariant from '../../components/steps/Step2ChooseVariant';
import Step3Personalize from '../../components/steps/Step3Personalize';
import Step4Review from '../../components/steps/Step4Review';

const STEP_COMPONENTS = {
  1: Step1ChooseProduct,
  2: Step2ChooseVariant,
  3: Step3Personalize,
  4: Step4Review,
};

// Prévia do Studio dentro do painel — mesmo fluxo da loja, mas em modo teste
// (sem Header da loja, sem carrinho e sem criar pedido).
export default function AdminStudio() {
  const currentStep = useStore((s) => s.currentStep);
  const catalogLoaded = useStore((s) => s.catalogLoaded);
  const setCatalog = useStore((s) => s.setCatalog);
  const setPreviewMode = useStore((s) => s.setPreviewMode);
  const resetConfigurator = useStore((s) => s.resetConfigurator);
  const resetWizard = useStore((s) => s.resetWizard);
  const StepComponent = STEP_COMPONENTS[currentStep];

  // Entra em modo prévia e começa do zero; ao sair, desliga o modo prévia
  // (pra não vazar pro Studio real da loja).
  useEffect(() => {
    setPreviewMode(true);
    resetConfigurator();
    resetWizard();
    return () => setPreviewMode(false);
  }, [setPreviewMode, resetConfigurator, resetWizard]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const data = await fetchCatalog();
      if (mounted) setCatalog(data);
    }
    load();
    return () => {
      mounted = false;
    };
  }, [setCatalog]);

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-2xl font-bold">Studio — prévia / teste</h2>
        <p className="mt-1 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent">
          Modo teste: nenhum pedido é criado aqui. Use pra conferir produtos/modelos ou mostrar a prévia pro cliente.
        </p>
      </div>

      {!catalogLoaded ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent"></div>
        </div>
      ) : (
        <>
          <StepIndicator />
          <div key={currentStep} className="animate-fade-in outline-none motion-reduce:animate-none">
            <StepComponent />
          </div>
        </>
      )}
      <Toast />
    </div>
  );
}
