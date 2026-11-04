import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gift } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { formatCurrency } from '../../utils/price';
import { checkCampaignToken, fetchStoreConfig, lookupCep, quoteShipping, submitStoreOrder } from '../../lib/storeApi';
import Button from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import UpsellPopup from './UpsellPopup';

const EXTRA_DISCOUNT = 0.1;
const round2 = (n) => Math.round(n * 100) / 100;
import { LAST_PAYMENT_KEY } from './PaymentReturnModal';

/** Mesma regra do banco (place_store_order): com token válido, 1 unidade do
 * primeiro item elegível sai grátis e os demais itens têm 10% de desconto.
 * Aqui é só pra exibir — o valor final é recalculado no servidor. */
function computeTotals(items, token) {
  const giftIndex = token ? items.findIndex((it) => token.productIds.includes(it.productId)) : -1;
  let subtotal = 0;
  let giftDiscount = 0;
  let extraDiscount = 0;
  items.forEach((it, i) => {
    subtotal += it.lineTotal;
    if (giftIndex === -1) return;
    if (i === giftIndex) giftDiscount += it.lineTotal / Math.max(it.quantity, 1);
    else extraDiscount += round2(it.lineTotal * EXTRA_DISCOUNT);
  });
  return { giftIndex, subtotal, giftDiscount, extraDiscount, itemsTotal: subtotal - giftDiscount - extraDiscount };
}

const formatCep = (v) => {
  const d = v.replace(/\D/g, '').slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

const inputClass =
  'w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-text-primary placeholder:text-text-secondary';

const EMPTY_ADDRESS = { cep: '', street: '', number: '', complement: '', district: '', city: '', state: '' };

export default function StoreCartDrawer() {
  const navigate = useNavigate();
  const isOpen = useStore((s) => s.isDrawerOpen);
  const closeDrawer = useStore((s) => s.closeDrawer);
  const items = useStore((s) => s.items);
  const removeItem = useStore((s) => s.removeItem);
  const updateQuantity = useStore((s) => s.updateQuantity);
  const clearCart = useStore((s) => s.clearCart);
  const resetConfigurator = useStore((s) => s.resetConfigurator);
  const resetWizard = useStore((s) => s.resetWizard);
  const customer = useStore((s) => s.storeCustomer);
  const openStoreAuth = useStore((s) => s.openStoreAuth);
  const campaignProductIds = useStore((s) => s.campaignProductIds);
  const upsellDismissed = useStore((s) => s.upsellDismissed);

  const [config, setConfig] = useState({ shipping: false, payment: false, pickupAddress: '' });
  const [tokenInput, setTokenInput] = useState('');
  const [token, setToken] = useState(null);
  const [tokenMessage, setTokenMessage] = useState('');
  const [checkingToken, setCheckingToken] = useState(false);

  const [delivery, setDelivery] = useState('pickup');
  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const [quote, setQuote] = useState(null); // { options } | null
  const [quoteError, setQuoteError] = useState('');
  const [quoting, setQuoting] = useState(false);
  const [serviceId, setServiceId] = useState(null);

  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    fetchStoreConfig().then(setConfig);
  }, []);

  useEffect(() => {
    if (customer?.phone) setPhone((p) => p || customer.phone);
  }, [customer]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => e.key === 'Escape' && closeDrawer();
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeDrawer]);

  // Carrinho mudou (item/quantidade) → a cotação antiga não vale mais.
  const cartKey = items.map((it) => `${it.productId}:${it.quantity}`).join('|');
  useEffect(() => {
    setQuote(null);
    setServiceId(null);
  }, [cartKey]);

  const totals = useMemo(() => computeTotals(items, token), [items, token]);
  const tokenWithoutProduct = token && totals.giftIndex === -1;
  const selectedService = quote?.options?.find((o) => o.id === serviceId) || null;
  const shippingPrice = delivery === 'shipping' ? selectedService?.price || 0 : 0;
  const grandTotal = Math.max(totals.itemsTotal, 0) + shippingPrice;

  // Pop-up de 10%: carrinho aberto contendo só o(s) brinde(s) da campanha.
  const giftItem = items.find((it) => campaignProductIds.includes(it.productId));
  const onlyGifts = items.length > 0 && items.every((it) => campaignProductIds.includes(it.productId));
  const showUpsell = isOpen && !upsellDismissed && !success && Boolean(giftItem) && onlyGifts;

  const handleApplyToken = async (e) => {
    e?.preventDefault();
    if (!tokenInput.trim()) return;
    setCheckingToken(true);
    setTokenMessage('');
    const result = await checkCampaignToken(tokenInput);
    setCheckingToken(false);
    if (!result.valid) {
      setToken(null);
      setTokenMessage(result.message);
      return;
    }
    setToken(result);
    setTokenInput(result.code);
  };

  const handleRemoveToken = () => {
    setToken(null);
    setTokenInput('');
    setTokenMessage('');
  };

  const handleQuote = async (e) => {
    e?.preventDefault();
    const digits = address.cep.replace(/\D/g, '');
    if (digits.length !== 8) {
      setQuoteError('Digite um CEP com 8 números.');
      return;
    }
    setQuoting(true);
    setQuoteError('');
    setQuote(null);
    setServiceId(null);
    const [result, found] = await Promise.all([quoteShipping(digits, items), lookupCep(digits)]);
    setQuoting(false);
    if (found) setAddress((a) => ({ ...a, ...found, street: found.street || a.street, district: found.district || a.district }));
    if (result.error) {
      setQuoteError(result.error);
      return;
    }
    setQuote(result);
    if (result.options[0]) setServiceId(result.options[0].id);
  };

  const updateAddress = (field) => (e) => setAddress({ ...address, [field]: e.target.value });

  const doCheckout = async () => {
    setError('');
    if (tokenWithoutProduct) {
      setError(`Seu código vale para: ${token.productNames.join(', ')}. Adicione o produto ou remova o código.`);
      return;
    }
    if (phone.replace(/\D/g, '').length < 10) {
      setError('Informe um celular com DDD para contato.');
      return;
    }
    if (delivery === 'shipping') {
      if (!selectedService) {
        setError('Calcule o frete pelo CEP e escolha PAC ou SEDEX.');
        return;
      }
      if (!address.street.trim() || !address.number.trim() || !address.city.trim() || !address.state.trim()) {
        setError('Preencha rua, número, cidade e UF para a entrega.');
        return;
      }
    }

    setIsSubmitting(true);
    const { error: submitError, result } = await submitStoreOrder(items, {
      token: token?.code || null,
      customer: { name: customer.name, phone: phone.trim(), note: note.trim() },
      delivery,
      address: { ...address, cep: address.cep.replace(/\D/g, '') },
      shippingServiceId: selectedService?.id,
    });
    if (submitError) {
      setIsSubmitting(false);
      setError(submitError);
      if (/código/i.test(submitError)) setToken(null);
      if (/frete/i.test(submitError)) setQuote(null);
      return;
    }

    clearCart();
    setToken(null);
    setTokenInput('');
    setNote('');

    if (result.status === 'payment' && result.init_point) {
      // Guarda o link pra "tentar de novo" se o pagamento falhar na volta.
      try {
        localStorage.setItem(LAST_PAYMENT_KEY, JSON.stringify({ url: result.init_point, orders: result.order_numbers }));
      } catch { /* sem storage, segue */ }
      window.location.href = result.init_point;
      return;
    }
    setIsSubmitting(false);
    setSuccess({ status: result.status, orderNumbers: result.order_numbers || [], total: Number(result.total || 0) });
  };

  const handleCheckout = () => {
    if (!customer) {
      openStoreAuth();
      return;
    }
    doCheckout();
  };

  const handleNewOrder = () => {
    setSuccess(null);
    closeDrawer();
    resetConfigurator();
    resetWizard();
    navigate('/store');
  };

  const successMessage = () => {
    if (!success) return '';
    if (success.status === 'free') {
      return 'Seu brinde já foi para produção. Avisaremos pelo seu celular quando estiver pronto para retirada na loja.';
    }
    return `Total: ${formatCurrency(success.total)}. Nossa equipe vai entrar em contato pelo seu celular para combinar o pagamento.`;
  };

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

        {success ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl text-green-600">✓</div>
            <h3 className="text-xl font-bold">Pedido recebido!</h3>
            <p className="text-sm text-text-secondary">
              {success.orderNumbers.length > 1 ? 'Números dos pedidos: ' : 'Número do pedido: '}
              <span className="font-mono font-semibold text-text-primary">{success.orderNumbers.join(', ')}</span>
            </p>
            <p className="text-sm text-text-secondary">{successMessage()}</p>
            <Button onClick={handleNewOrder} className="mt-2">Personalizar outro produto</Button>
          </div>
        ) : items.length === 0 ? (
          <EmptyState title="Carrinho vazio" description="Personalize um produto e adicione ao carrinho." />
        ) : (
          <div className="flex-1 overflow-y-auto">
            <ul className="divide-y divide-border px-6">
              {items.map((item, index) => {
                const isGift = index === totals.giftIndex;
                return (
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
                      {isGift && <p className="flex items-center gap-1 text-xs font-semibold text-green-600"><Gift className="h-3.5 w-3.5" aria-hidden="true" /> Brinde — 1 unidade grátis</p>}
                      {token && !isGift && totals.giftIndex !== -1 && (
                        <p className="text-xs font-semibold text-accent">10% de desconto aplicado</p>
                      )}
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center rounded-lg border border-border">
                          <button type="button" onClick={() => updateQuantity(item.id, item.quantity - 1)} className="h-8 w-8 text-text-secondary hover:text-text-primary">−</button>
                          <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                          <button type="button" onClick={() => updateQuantity(item.id, item.quantity + 1)} className="h-8 w-8 text-text-secondary hover:text-text-primary">+</button>
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
                );
              })}
            </ul>

            <div className="flex flex-col gap-5 border-t border-border px-6 py-5">
              {/* Token do cartão da campanha */}
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold">Código do cartão (brinde)</p>
                {token ? (
                  <div className="flex items-center justify-between rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm">
                    <span>
                      <span className="font-mono font-bold">{token.code}</span>
                      <span className="block text-xs text-green-700">Válido para: {token.productNames.join(', ')}</span>
                    </span>
                    <button type="button" onClick={handleRemoveToken} className="text-xs font-semibold text-text-secondary hover:text-accent">
                      Remover
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleApplyToken} className="flex gap-2">
                    <input
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                      placeholder="Digite o código do cartão"
                      className={`${inputClass} flex-1 font-mono uppercase`}
                    />
                    <Button type="submit" variant="secondary" className="px-4 py-2 text-sm" disabled={checkingToken || !tokenInput.trim()}>
                      {checkingToken ? '…' : 'Aplicar'}
                    </Button>
                  </form>
                )}
                {tokenMessage && <p className="text-xs text-accent">{tokenMessage}</p>}
                {tokenWithoutProduct && (
                  <p className="text-xs text-accent">
                    Este código vale para {token.productNames.join(', ')}. Adicione esse produto ao carrinho para ganhar o brinde.
                  </p>
                )}
              </div>

              {/* Entrega */}
              <div className="flex flex-col gap-2 text-sm">
                <p className="font-semibold">Entrega</p>
                <label className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 ${delivery === 'pickup' ? 'border-text-primary' : 'border-border'}`}>
                  <input type="radio" name="delivery" className="mt-1" checked={delivery === 'pickup'} onChange={() => setDelivery('pickup')} />
                  <span className="flex-1">
                    Retirar na loja
                    {config.pickupAddress && <span className="block text-xs text-text-secondary">{config.pickupAddress}</span>}
                  </span>
                  <span className="font-semibold text-green-600">Grátis</span>
                </label>
                {config.shipping && (
                  <label className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 ${delivery === 'shipping' ? 'border-text-primary' : 'border-border'}`}>
                    <input type="radio" name="delivery" checked={delivery === 'shipping'} onChange={() => setDelivery('shipping')} />
                    <span className="flex-1">Receber em casa (Correios)</span>
                    {selectedService && delivery === 'shipping' && <span className="font-semibold">{formatCurrency(selectedService.price)}</span>}
                  </label>
                )}

                {delivery === 'shipping' && (
                  <div className="flex flex-col gap-3 rounded-lg bg-bg p-3">
                    <form onSubmit={handleQuote} className="flex gap-2">
                      <input
                        inputMode="numeric"
                        autoComplete="postal-code"
                        value={address.cep}
                        onChange={(e) => setAddress({ ...address, cep: formatCep(e.target.value) })}
                        placeholder="Seu CEP"
                        className={`${inputClass} flex-1 bg-panel`}
                      />
                      <Button type="submit" variant="secondary" className="px-4 py-2 text-sm" disabled={quoting}>
                        {quoting ? 'Calculando…' : 'Calcular frete'}
                      </Button>
                    </form>
                    {quoteError && <p className="text-xs text-accent">{quoteError}</p>}
                    {quote?.options?.map((o) => (
                      <label key={o.id} className={`flex cursor-pointer items-center gap-2 rounded-lg border bg-panel px-3 py-2 ${serviceId === o.id ? 'border-text-primary' : 'border-border'}`}>
                        <input type="radio" name="service" checked={serviceId === o.id} onChange={() => setServiceId(o.id)} />
                        <span className="flex-1">
                          {o.company} {o.name}
                          {o.days ? <span className="block text-xs text-text-secondary">até {o.days} dias úteis + produção</span> : null}
                        </span>
                        <span className="font-semibold">{formatCurrency(o.price)}</span>
                      </label>
                    ))}
                    {quote && (
                      <div className="grid grid-cols-6 gap-2">
                        <input value={address.street} onChange={updateAddress('street')} placeholder="Rua / Avenida" autoComplete="address-line1" className={`${inputClass} col-span-4 bg-panel`} />
                        <input value={address.number} onChange={updateAddress('number')} placeholder="Nº" className={`${inputClass} col-span-2 bg-panel`} />
                        <input value={address.complement} onChange={updateAddress('complement')} placeholder="Complemento (opcional)" autoComplete="address-line2" className={`${inputClass} col-span-6 bg-panel`} />
                        <input value={address.district} onChange={updateAddress('district')} placeholder="Bairro" className={`${inputClass} col-span-6 bg-panel`} />
                        <input value={address.city} onChange={updateAddress('city')} placeholder="Cidade" autoComplete="address-level2" className={`${inputClass} col-span-4 bg-panel`} />
                        <input value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value.toUpperCase().slice(0, 2) })} placeholder="UF" autoComplete="address-level1" className={`${inputClass} col-span-2 bg-panel`} />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Cliente */}
              {customer ? (
                <div className="flex flex-col gap-3">
                  <p className="text-xs text-text-secondary">
                    Comprando como <span className="font-semibold text-text-primary">{customer.name || customer.email}</span> ({customer.email})
                  </p>
                  <label className="flex flex-col gap-1 text-sm">
                    Celular / WhatsApp
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" className={inputClass} />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Observação
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={2}
                      placeholder="Alguma observação sobre o pedido? (opcional)"
                      className={`${inputClass} resize-none`}
                    />
                  </label>
                </div>
              ) : (
                <p className="text-xs text-text-secondary">Para finalizar, faça um cadastro rápido (ou entre na sua conta).</p>
              )}
            </div>
          </div>
        )}

        {!success && (
          <div className="border-t border-border px-6 py-5">
            <dl className="mb-4 flex flex-col gap-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-text-secondary">Subtotal</dt>
                <dd>{formatCurrency(totals.subtotal)}</dd>
              </div>
              {totals.giftDiscount > 0 && (
                <div className="flex justify-between text-green-600">
                  <dt>Brinde (código do cartão)</dt>
                  <dd>− {formatCurrency(totals.giftDiscount)}</dd>
                </div>
              )}
              {totals.extraDiscount > 0 && (
                <div className="flex justify-between text-green-600">
                  <dt>Desconto 10% nos demais itens</dt>
                  <dd>− {formatCurrency(totals.extraDiscount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-text-secondary">
                  {delivery === 'shipping' ? `Frete${selectedService ? ` (${selectedService.name})` : ''}` : 'Retirada na loja'}
                </dt>
                <dd className={shippingPrice > 0 ? '' : 'text-green-600'}>
                  {delivery === 'shipping' && !selectedService ? 'calcule pelo CEP' : shippingPrice > 0 ? formatCurrency(shippingPrice) : 'Grátis'}
                </dd>
              </div>
              <div className="mt-1 flex justify-between text-lg font-bold">
                <dt>Total</dt>
                <dd>{formatCurrency(grandTotal)}</dd>
              </div>
            </dl>
            {error && <p className="mb-3 text-sm text-accent">{error}</p>}
            <Button className="w-full" disabled={items.length === 0 || isSubmitting} onClick={handleCheckout}>
              {isSubmitting
                ? 'Enviando pedido…'
                : !customer
                  ? 'Cadastrar e finalizar'
                  : grandTotal > 0 && config.payment
                    ? 'Ir para o pagamento'
                    : 'Finalizar compra'}
            </Button>
            {customer && grandTotal > 0 && config.payment && (
              <p className="mt-2 text-center text-xs text-text-secondary">Pagamento seguro pelo Mercado Pago (Pix, cartão ou boleto).</p>
            )}
          </div>
        )}
      </aside>

      <UpsellPopup isOpen={showUpsell} giftName={giftItem?.productName} />
    </>
  );
}
