import { Fragment, useEffect, useState } from 'react';
import { fetchAdminProducts } from '../../../lib/api';
import { fetchPriceTiers, savePriceTiers, saveStoreProduct } from '../../../lib/storeApi';
import { formatCurrency, PERSONALIZATION_FEE, tierUnitPrice } from '../../../utils/price';
import Button from '../../../components/ui/Button';

const inputClass = 'w-full rounded-md border border-border px-2 py-1.5 text-sm outline-none focus:border-text-primary';
const toNumber = (v) => Number(String(v).replace(',', '.'));

/** Preço final na loja: o cadastrado no Painel, ou a regra antiga (produto + personalização). */
const currentStorePrice = (p) =>
  p.store_price != null ? Number(p.store_price) : p.base_price != null ? Number(p.base_price) + PERSONALIZATION_FEE : null;

const tierSummary = (tiers, unitPrice) =>
  tiers.length
    ? tiers.map((t) => `${t.minQty}+ un. ${formatCurrency(tierUnitPrice(t, unitPrice || 0))}`).join(' · ')
    : 'Sem desconto de atacado';

/** Preço final e preços de atacado de cada produto da loja. */
export default function StorePricesTab() {
  const [products, setProducts] = useState(null);
  const [tiersByProduct, setTiersByProduct] = useState({});
  const [edits, setEdits] = useState({});
  const [minEdits, setMinEdits] = useState({});
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

  const dirtyIds = [...new Set([...Object.keys(edits), ...Object.keys(minEdits)])];

  /** Campos alterados de um produto. Pedido mínimo vazio = 1 (sem mínimo). */
  const changesFor = (id) => {
    const fields = {};
    if (edits[id] != null) fields.store_price = toNumber(edits[id]);
    if (minEdits[id] != null) fields.store_min_qty = String(minEdits[id]).trim() === '' ? null : Math.round(toNumber(minEdits[id]));
    return fields;
  };

  const handleSavePrices = async () => {
    const changes = dirtyIds.map((id) => [id, changesFor(id)]);
    if (changes.some(([, f]) => 'store_price' in f && !(f.store_price > 0))) {
      setMessage('Preço precisa ser maior que zero.');
      return;
    }
    if (changes.some(([, f]) => f.store_min_qty != null && !(f.store_min_qty >= 1))) {
      setMessage('Pedido mínimo precisa ser 1 ou mais.');
      return;
    }
    setSaving(true);
    const results = await Promise.all(changes.map(([id, f]) => saveStoreProduct(id, f)));
    setSaving(false);
    if (results.some((r) => r.error)) {
      setMessage('Não foi possível salvar. Confira se seu usuário tem acesso a Produtos.');
      return;
    }
    const byId = Object.fromEntries(changes);
    setProducts((ps) => ps.map((p) => (byId[p.id] ? { ...p, ...byId[p.id] } : p)));
    setEdits({});
    setMinEdits({});
    setMessage('Alterações salvas!');
  };

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-panel p-5">
      <div>
        <h3 className="text-lg font-bold">Preços e descontos de atacado</h3>
        <p className="text-sm text-text-secondary">
          <strong>Preço na loja</strong> é o valor final que o cliente paga por unidade, já com a personalização.
          Em <strong>Descontos</strong> você define, para cada produto, o preço por unidade a partir de uma quantidade.
          Aparece na página do produto como “10 unidades × R$ …”.
          <strong> Pedido mínimo</strong> vale só para a loja; em branco, usa o do cadastro do produto.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-text-secondary">
              <th className="py-2 pr-3 font-medium">Produto</th>
              <th className="py-2 pr-3 font-medium">Preço na loja (R$)</th>
              <th className="py-2 pr-3 font-medium">Pedido mínimo (un.)</th>
              <th className="py-2 pr-3 font-medium">Revendedor</th>
              <th className="py-2 font-medium">Descontos de atacado</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const saved = currentStorePrice(p);
              const value = edits[p.id] ?? (saved != null ? saved.toFixed(2) : '');
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
                        onChange={(e) => { setEdits({ ...edits, [p.id]: e.target.value }); setMessage(''); }}
                        className={`${inputClass} font-semibold ${edits[p.id] != null ? 'border-accent' : ''}`}
                        aria-label={`Preço na loja de ${p.name}`}
                      />
                    </td>
                    <td className="w-28 py-2 pr-3">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={minEdits[p.id] ?? (p.store_min_qty ?? '')}
                        placeholder={String(p.min_order_qty > 0 ? p.min_order_qty : 1)}
                        onChange={(e) => { setMinEdits({ ...minEdits, [p.id]: e.target.value }); setMessage(''); }}
                        className={`${inputClass} ${minEdits[p.id] != null ? 'border-accent' : ''}`}
                        aria-label={`Pedido mínimo na loja de ${p.name}`}
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
                        <span className={`text-xs ${tiers.length ? 'text-text-primary' : 'text-text-secondary'}`}>{tierSummary(tiers, saved)}</span>
                        <span className="text-xs font-semibold text-accent hover:underline">{isOpen ? 'Fechar' : 'Editar descontos'}</span>
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-border bg-bg">
                      <td colSpan={5} className="px-3 pb-4 pt-1">
                        <TierEditor
                          product={p}
                          unitPrice={n > 0 ? n : 0}
                          initial={tiers}
                          onSaved={(savedTiers) => setTiersByProduct((m) => ({ ...m, [p.id]: savedTiers }))}
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
          {saving ? 'Salvando…' : `Salvar alterações${dirtyIds.length ? ` (${dirtyIds.length})` : ''}`}
        </Button>
      </div>
    </section>
  );
}

/** Faixas de atacado de um produto: "a partir de X unidades, R$ Y cada". */
function TierEditor({ product, unitPrice, initial, onSaved }) {
  const [rows, setRows] = useState(() =>
    initial.map((t) => ({ minQty: String(t.minQty), unitPrice: tierUnitPrice(t, unitPrice).toFixed(2) })),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const update = (i, key, value) => {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
    setMessage('');
  };

  const handleSave = async () => {
    const parsed = rows.map((r) => ({ minQty: Math.round(toNumber(r.minQty)), unitPrice: Math.round(toNumber(r.unitPrice) * 100) / 100 }));
    if (parsed.some((t) => !(t.minQty >= 2) || !(t.unitPrice > 0))) {
      setMessage('Cada faixa precisa de quantidade a partir de 2 e preço maior que zero.');
      return;
    }
    if (unitPrice > 0 && parsed.some((t) => t.unitPrice >= unitPrice)) {
      setMessage(`O preço da faixa precisa ser menor que o preço na loja (${formatCurrency(unitPrice)}).`);
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
    setRows(parsed.map((t) => ({ minQty: String(t.minQty), unitPrice: t.unitPrice.toFixed(2) })));
    onSaved(parsed.map((t) => ({ ...t, productId: product.id, discountPct: null })));
    setMessage('Descontos salvos!');
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-panel p-4">
      <p className="text-sm font-semibold">
        Descontos de atacado — {product.name}
        {unitPrice > 0 && <span className="font-normal text-text-secondary"> (preço na loja: {formatCurrency(unitPrice)} cada)</span>}
      </p>

      {rows.length > 0 ? (
        <div className="grid grid-cols-[120px_140px_1fr_auto] items-center gap-2 text-sm">
          <span className="text-xs text-text-secondary">A partir de (un.)</span>
          <span className="text-xs text-text-secondary">Preço por unidade (R$)</span>
          <span className="text-xs text-text-secondary">Como o cliente vê</span>
          <span />
          {rows.map((r, i) => {
            const qty = Math.round(toNumber(r.minQty));
            const unit = toNumber(r.unitPrice);
            const ok = qty >= 2 && unit > 0;
            const pct = unitPrice > 0 ? (1 - unit / unitPrice) * 100 : 0;
            return (
              <Fragment key={i}>
                <input type="number" min="2" value={r.minQty} onChange={(e) => update(i, 'minQty', e.target.value)} className={inputClass} aria-label="A partir de quantas unidades" />
                <input type="number" min="0" step="0.01" value={r.unitPrice} onChange={(e) => update(i, 'unitPrice', e.target.value)} className={inputClass} aria-label="Preço por unidade em R$" />
                <span className="text-text-secondary">
                  {ok ? `${qty} unidades × ${formatCurrency(unit)} = ${formatCurrency(unit * qty)}${pct > 0 ? ` (${+pct.toFixed(1)}% off)` : ''}` : '—'}
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
        <button type="button" onClick={() => setRows((rs) => [...rs, { minQty: '', unitPrice: '' }])} className="text-sm font-semibold text-accent hover:underline">
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
