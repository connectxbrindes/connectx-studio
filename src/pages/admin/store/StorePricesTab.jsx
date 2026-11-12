import { Fragment, useEffect, useState } from 'react';
import { fetchAdminProducts } from '../../../lib/api';
import { fetchPriceTiers, savePriceTiers, saveProductPrice } from '../../../lib/storeApi';
import { formatCurrency, PERSONALIZATION_FEE } from '../../../utils/price';
import Button from '../../../components/ui/Button';

const inputClass = 'w-full rounded-md border border-border px-2 py-1.5 text-sm outline-none focus:border-text-primary';
const toNumber = (v) => Number(String(v).replace(',', '.'));
const tierSummary = (tiers) =>
  tiers.length ? tiers.map((t) => `${t.minQty}+ un. −${+t.discountPct}%`).join(' · ') : 'Sem desconto de atacado';

/** Preço de venda e descontos de atacado de cada produto da loja. */
export default function StorePricesTab() {
  const [products, setProducts] = useState(null);
  const [tiersByProduct, setTiersByProduct] = useState({});
  const [edits, setEdits] = useState({});
  const [storeText, setStoreText] = useState({}); // texto digitado em "Preço na loja"
  const [openId, setOpenId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    Promise.all([fetchAdminProducts(), fetchPriceTiers()]).then(([p, tiers]) => {
      setProducts((p || []).filter((x) => x.status === 'active'));
      const grouped = {};
      tiers.forEach((t) => { (grouped[t.productId] ||= []).push(t); });
      setTiersByProduct(grouped);
    });
  }, []);

  if (!products) return null;

  const dirtyIds = Object.keys(edits);

  const handleSavePrices = async () => {
    if (dirtyIds.some((id) => !(toNumber(edits[id]) > 0))) {
      setMessage(`Preço precisa ser maior que zero (na loja, maior que ${formatCurrency(PERSONALIZATION_FEE)}).`);
      return;
    }
    setSaving(true);
    const results = await Promise.all(dirtyIds.map((id) => saveProductPrice(id, toNumber(edits[id]))));
    setSaving(false);
    if (results.some((r) => r.error)) {
      setMessage('Não foi possível salvar. Confira se seu usuário tem acesso a Produtos.');
      return;
    }
    setProducts((ps) => ps.map((p) => (edits[p.id] != null ? { ...p, base_price: toNumber(edits[p.id]) } : p)));
    setEdits({});
    setStoreText({});
    setMessage('Preços salvos!');
  };

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-panel p-5">
      <div>
        <h3 className="text-lg font-bold">Preços e descontos de atacado</h3>
        <p className="text-sm text-text-secondary">
          Preço de venda de cada produto (o mesmo “Preço Base” do cadastro). Na loja o cliente paga esse valor +{' '}
          {formatCurrency(PERSONALIZATION_FEE)} da personalização. Você pode digitar o preço do produto ou direto o preço
          final na loja: um ajusta o outro. Em <strong>Descontos</strong> você define, para cada
          produto, a partir de quantas unidades ele fica mais barato. Aparece na página do produto como “10 unidades × R$ …”.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-text-secondary">
              <th className="py-2 pr-3 font-medium">Produto</th>
              <th className="py-2 pr-3 font-medium">Preço do produto (R$)</th>
              <th className="py-2 pr-3 font-medium">Preço na loja</th>
              <th className="py-2 pr-3 font-medium">Revendedor</th>
              <th className="py-2 font-medium">Descontos de atacado</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const value = edits[p.id] ?? (p.base_price != null ? Number(p.base_price).toFixed(2) : '');
              const n = toNumber(value);
              const tiers = tiersByProduct[p.id] || [];
              const isOpen = openId === p.id;
              return (
                <Fragment key={p.id}>
                  <tr className={`border-b border-border ${isOpen ? 'bg-bg' : ''}`}>
                    <td className="py-2 pr-3 font-medium">{p.name}</td>
                    <td className="w-36 py-2 pr-3">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={value}
                        onChange={(e) => {
                          setEdits({ ...edits, [p.id]: e.target.value });
                          setStoreText(({ [p.id]: _, ...rest }) => rest);
                          setMessage('');
                        }}
                        className={`${inputClass} ${edits[p.id] != null ? 'border-accent' : ''}`}
                        aria-label={`Preço de ${p.name}`}
                      />
                    </td>
                    <td className="w-36 py-2 pr-3">
                      {/* Preço final da loja: ao editar, o preço do produto vira (loja − personalização). */}
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={storeText[p.id] ?? (n > 0 ? (n + PERSONALIZATION_FEE).toFixed(2) : '')}
                        onChange={(e) => {
                          const text = e.target.value;
                          const store = toNumber(text);
                          setStoreText({ ...storeText, [p.id]: text });
                          setEdits({ ...edits, [p.id]: store > PERSONALIZATION_FEE ? (store - PERSONALIZATION_FEE).toFixed(2) : '0' });
                          setMessage('');
                        }}
                        className={`${inputClass} font-semibold ${storeText[p.id] != null ? 'border-accent' : ''}`}
                        aria-label={`Preço na loja de ${p.name}`}
                      />
                    </td>
                    <td className="py-2 pr-3 text-text-secondary">{p.reseller_price != null ? formatCurrency(Number(p.reseller_price)) : '—'}</td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => setOpenId(isOpen ? null : p.id)}
                        className="flex flex-col items-start text-left"
                        aria-expanded={isOpen}
                      >
                        <span className={`text-xs ${tiers.length ? 'text-text-primary' : 'text-text-secondary'}`}>{tierSummary(tiers)}</span>
                        <span className="text-xs font-semibold text-accent hover:underline">{isOpen ? 'Fechar' : 'Editar descontos'}</span>
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-border bg-bg">
                      <td colSpan={5} className="px-3 pb-4 pt-1">
                        <TierEditor
                          product={p}
                          unitPrice={n > 0 ? n + PERSONALIZATION_FEE : 0}
                          initial={tiers}
                          onSaved={(saved) => setTiersByProduct((m) => ({ ...m, [p.id]: saved }))}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-3">
        {message && <span className="text-sm text-text-secondary">{message}</span>}
        <Button type="button" onClick={handleSavePrices} disabled={saving || dirtyIds.length === 0}>
          {saving ? 'Salvando…' : `Salvar preços${dirtyIds.length ? ` (${dirtyIds.length})` : ''}`}
        </Button>
      </div>
    </section>
  );
}

/** Faixas de desconto de um produto: "a partir de X unidades, Y%". */
function TierEditor({ product, unitPrice, initial, onSaved }) {
  const [rows, setRows] = useState(() => initial.map((t) => ({ minQty: String(t.minQty), discountPct: String(t.discountPct) })));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const update = (i, key, value) => {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
    setMessage('');
  };

  const handleSave = async () => {
    const parsed = rows.map((r) => ({ minQty: Math.round(toNumber(r.minQty)), discountPct: toNumber(r.discountPct) }));
    if (parsed.some((t) => !(t.minQty >= 2) || !(t.discountPct > 0 && t.discountPct < 100))) {
      setMessage('Cada faixa precisa de quantidade a partir de 2 e desconto entre 0 e 100%.');
      return;
    }
    if (new Set(parsed.map((t) => t.minQty)).size !== parsed.length) {
      setMessage('Há duas faixas com a mesma quantidade.');
      return;
    }
    parsed.sort((a, b) => a.minQty - b.minQty);
    setSaving(true);
    const { error } = await savePriceTiers(product.id, parsed);
    setSaving(false);
    if (error) {
      setMessage('Não foi possível salvar.');
      return;
    }
    setRows(parsed.map((t) => ({ minQty: String(t.minQty), discountPct: String(t.discountPct) })));
    onSaved(parsed);
    setMessage('Descontos salvos!');
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-panel p-4">
      <p className="text-sm font-semibold">Descontos de atacado — {product.name}</p>

      {rows.length > 0 ? (
        <div className="grid grid-cols-[120px_120px_1fr_auto] items-center gap-2 text-sm">
          <span className="text-xs text-text-secondary">A partir de (un.)</span>
          <span className="text-xs text-text-secondary">Desconto (%)</span>
          <span className="text-xs text-text-secondary">Como o cliente vê</span>
          <span />
          {rows.map((r, i) => {
            const qty = Math.round(toNumber(r.minQty));
            const pct = toNumber(r.discountPct);
            const ok = qty >= 2 && pct > 0 && pct < 100 && unitPrice > 0;
            const unit = unitPrice * (1 - pct / 100);
            return (
              <Fragment key={i}>
                <input type="number" min="2" value={r.minQty} onChange={(e) => update(i, 'minQty', e.target.value)} className={inputClass} aria-label="A partir de quantas unidades" />
                <input type="number" min="0" max="99" step="0.5" value={r.discountPct} onChange={(e) => update(i, 'discountPct', e.target.value)} className={inputClass} aria-label="Desconto em %" />
                <span className="text-text-secondary">
                  {ok ? `${qty} unidades × ${formatCurrency(unit)} = ${formatCurrency(unit * qty)}` : '—'}
                </span>
                <button type="button" onClick={() => { setRows((rs) => rs.filter((_, idx) => idx !== i)); setMessage(''); }} className="text-xs font-semibold text-accent hover:underline">
                  Remover
                </button>
              </Fragment>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-text-secondary">Sem faixas: este produto não mostra o seletor de atacado na loja.</p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => setRows((rs) => [...rs, { minQty: '', discountPct: '' }])} className="text-sm font-semibold text-accent hover:underline">
          + Adicionar faixa
        </button>
        <div className="flex items-center gap-3">
          {message && <span className="text-sm text-text-secondary">{message}</span>}
          <Button type="button" onClick={handleSave} disabled={saving}>{saving ? 'Salvando…' : 'Salvar descontos'}</Button>
        </div>
      </div>
    </div>
  );
}
