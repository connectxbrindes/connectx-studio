import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { formatCurrency } from '../../utils/price';
import { fetchPriceTiers } from '../../lib/storeApi';

/** Seletor "compre em quantidade": mostra preço por unidade e total de cada
 * faixa de atacado do produto (Painel → Loja virtual → Preços e descontos).
 * Produto sem faixas cadastradas não mostra o seletor. */
export default function QuantityTiers({ productId, unitPrice, onChange }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(1);
  const [priceTiers, setPriceTiers] = useState([]);
  const ref = useRef(null);

  useEffect(() => {
    setSelected(1);
    onChange?.(1);
    setPriceTiers([]);
    if (productId) fetchPriceTiers(productId).then(setPriceTiers);
  }, [productId]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  if (priceTiers.length === 0) return null;

  const tiers = [{ qty: 1, discount: 0 }, ...priceTiers.map((t) => ({ qty: t.minQty, discount: t.discountPct / 100 }))].map((t) => {
    const unit = unitPrice * (1 - t.discount);
    return { ...t, unit, total: unit * t.qty, saved: (unitPrice - unit) * t.qty };
  });
  const current = tiers.find((t) => t.qty === selected);
  const label = (t) => `${t.qty} ${t.qty === 1 ? 'unidade' : 'unidades'} × ${formatCurrency(t.unit)}`;

  return (
    <div ref={ref} className="relative">
      <p className="mb-2 text-sm font-semibold text-brand-dark">Quantidade (preço de atacado)</p>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-xl border border-brand-dark/70 bg-white px-4 py-3 text-left text-base text-brand-dark"
      >
        <span>{label(current)}</span>
        <ChevronDown className={`h-5 w-5 text-text-secondary transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <ul role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-border bg-white shadow-xl">
          {tiers.map((t) => (
            <li key={t.qty} className="border-b border-border last:border-0">
              <button
                type="button"
                role="option"
                aria-selected={t.qty === selected}
                onClick={() => { setSelected(t.qty); onChange?.(t.qty); setOpen(false); }}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-bg"
              >
                <span>
                  <span className="block text-sm font-bold text-brand-dark">{label(t)}</span>
                  <span className="mt-1 block text-sm text-text-secondary">
                    {t.discount > 0
                      ? <>Economia: <span className="font-semibold text-green-600">{formatCurrency(t.saved)}</span> ({+(t.discount * 100).toFixed(2)}% off) | Total: {formatCurrency(t.total)}</>
                      : <>Preço normal | Total: {formatCurrency(t.total)}</>}
                  </span>
                </span>
                {t.qty === selected && <Check className="h-5 w-5 flex-shrink-0 text-accent" aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
