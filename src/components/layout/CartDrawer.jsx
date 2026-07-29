import { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import { formatCurrency } from '../../utils/price';
import { submitOrders } from '../../lib/api';
import Button from '../ui/Button';
import EmptyState from '../ui/EmptyState';

export default function CartDrawer() {
  const isOpen = useStore((s) => s.isDrawerOpen);
  const closeDrawer = useStore((s) => s.closeDrawer);
  const items = useStore((s) => s.items);
  const removeItem = useStore((s) => s.removeItem);
  const updateQuantity = useStore((s) => s.updateQuantity);
  const clearCart = useStore((s) => s.clearCart);
  const showToast = useStore((s) => s.showToast);
  const subtotal = useStore((s) => s.cartSubtotal());
  const identity = useStore((s) => s.identity);
  const resetConfigurator = useStore((s) => s.resetConfigurator);
  const resetWizard = useStore((s) => s.resetWizard);

  const [customerName, setCustomerName] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleCheckout = async () => {
    if (!customerName.trim()) {
      setError('Informe o nome do cliente para finalizar o pedido.');
      return;
    }
    setError('');
    setIsSubmitting(true);
    const { error: submitError } = await submitOrders(items, {
      name: customerName.trim(),
      contact: customerContact.trim(),
      note: customerNote.trim(),
      resellerId: identity?.resellerId || null,
    });
    setIsSubmitting(false);

    if (submitError) {
      setError('Não foi possível enviar o pedido. Tente novamente.');
      return;
    }

    clearCart();
    setCustomerName('');
    setCustomerContact('');
    setCustomerNote('');
    closeDrawer();
    // Volta pra tela de escolher produto (Passo 1), pronta pra um pedido
    // novo — sem isso, o cliente ficava preso no produto/personalização do
    // pedido que acabou de finalizar.
    resetConfigurator();
    resetWizard();
    showToast('Pedido realizado com sucesso!');
  };

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') closeDrawer();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeDrawer]);

  return (
    <>
      <div
        onClick={closeDrawer}
        aria-hidden="true"
        className={`fixed inset-0 z-20 bg-black/30 transition-opacity duration-300 motion-reduce:transition-none ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Carrinho de compras"
        className={`fixed right-0 top-0 z-30 flex h-full w-full max-w-md flex-col bg-panel shadow-2xl transition-transform duration-300 motion-reduce:transition-none ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <h2 className="text-xl font-bold">Seu Carrinho</h2>
          <button
            type="button"
            onClick={closeDrawer}
            aria-label="Fechar carrinho"
            className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-bg"
          >
            ✕
          </button>
        </div>

        {items.length === 0 ? (
          <EmptyState title="Carrinho vazio" description="Personalize um produto e adicione ao carrinho." />
        ) : (
          <ul className="flex-1 divide-y divide-border overflow-y-auto px-6">
            {items.map((item) => (
              <li key={item.id} className="flex gap-4 py-5">
                <img
                  src={item.thumbnail || item.image}
                  alt={item.productName}
                  className="h-20 w-20 flex-shrink-0 rounded-lg bg-bg object-contain"
                />
                <div className="flex flex-1 flex-col gap-1">
                  <p className="font-semibold">{item.productName}</p>
                  <p className="text-sm text-text-secondary">
                    {[item.color, item.size, item.model].filter(Boolean).join(' · ')}
                  </p>
                  {item.personalizationFee > 0 && (
                    <p className="text-xs text-accent">Personalização aplicada</p>
                  )}
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center rounded-lg border border-border">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="h-8 w-8 text-text-secondary hover:text-text-primary"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="h-8 w-8 text-text-secondary hover:text-text-primary"
                      >
                        +
                      </button>
                    </div>
                    <p className="font-semibold">{formatCurrency(item.lineTotal)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  aria-label={`Remover ${item.productName} do carrinho`}
                  className="self-start text-text-secondary hover:text-accent"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-border px-6 py-6">
          <div className="mb-4 flex items-center justify-between text-lg font-bold">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>

          {items.length > 0 && (
            <div className="mb-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm">
                Nome do cliente
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-text-primary"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Telefone ou e-mail
                <input
                  value={customerContact}
                  onChange={(e) => setCustomerContact(e.target.value)}
                  className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-text-primary"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Observação
                <textarea
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  rows={2}
                  placeholder="Alguma observação sobre este pedido? (opcional)"
                  className="resize-none rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-text-primary placeholder:text-text-secondary"
                />
              </label>
              {error && <p className="text-sm text-accent">{error}</p>}
            </div>
          )}

          <Button className="w-full" disabled={items.length === 0 || isSubmitting} onClick={handleCheckout}>
            {isSubmitting ? 'Enviando…' : 'Finalizar Compra'}
          </Button>
        </div>
      </aside>
    </>
  );
}
