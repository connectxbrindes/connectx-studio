import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';

/** Pop-up de 10%: aparece quando o cliente coloca o brinde da campanha no
 * carrinho e abre o carrinho só com ele. Incentiva adicionar outro produto. */
export default function UpsellPopup({ isOpen, giftName }) {
  const navigate = useNavigate();
  const dismissUpsell = useStore((s) => s.dismissUpsell);
  const closeDrawer = useStore((s) => s.closeDrawer);
  const resetConfigurator = useStore((s) => s.resetConfigurator);
  const resetWizard = useStore((s) => s.resetWizard);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && dismissUpsell();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, dismissUpsell]);

  if (!isOpen) return null;

  const handleChooseAnother = () => {
    dismissUpsell();
    closeDrawer();
    resetConfigurator();
    resetWizard();
    navigate('/store#produtos');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="upsell-title">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={dismissUpsell} />
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-panel text-center shadow-2xl animate-fade-in">
        <button
          type="button"
          onClick={dismissUpsell}
          aria-label="Fechar"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
        >
          ✕
        </button>
        <div className="bg-accent px-6 pb-6 pt-8 text-white">
          <p className="text-sm font-semibold uppercase tracking-widest opacity-90">Oferta especial</p>
          <p className="mt-1 text-6xl font-extrabold leading-none">10%</p>
          <p className="text-lg font-bold">de desconto</p>
        </div>
        <div className="flex flex-col gap-4 px-6 py-6">
          <h2 id="upsell-title" className="text-xl font-bold">
            Seu brinde já está no carrinho!
          </h2>
          <p className="text-sm text-text-secondary">
            Aproveite: personalize <strong className="text-text-primary">outro produto</strong> e ganhe{' '}
            <strong className="text-text-primary">10% de desconto</strong> nele ao usar o código do seu cartão
            {giftName ? <> junto com o <strong className="text-text-primary">{giftName}</strong></> : null}.
          </p>
          <button
            type="button"
            onClick={handleChooseAnother}
            className="w-full rounded-lg bg-accent px-6 py-3 font-semibold text-white transition-opacity hover:opacity-90"
          >
            Quero escolher outro produto
          </button>
          <button type="button" onClick={dismissUpsell} className="text-sm font-medium text-text-secondary hover:text-text-primary">
            Agora não, seguir para o carrinho
          </button>
        </div>
      </div>
    </div>
  );
}
