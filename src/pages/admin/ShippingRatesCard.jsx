import { useEffect, useState } from 'react';
import { fetchShippingRates, saveShippingRates } from '../../lib/storeApi';
import Button from '../../components/ui/Button';

const cellClass = 'w-full min-w-[72px] rounded-md border border-border px-2 py-1.5 text-sm outline-none focus:border-text-primary';

const FIELDS = [
  ['pac_price', 'até 1 kg (R$)', '0.01'],
  ['pac_extra_kg', 'kg adicional (R$)', '0.01'],
  ['pac_days', 'prazo (dias úteis)', '1'],
  ['sedex_price', 'até 1 kg (R$)', '0.01'],
  ['sedex_extra_kg', 'kg adicional (R$)', '0.01'],
  ['sedex_days', 'prazo (dias úteis)', '1'],
];
const INT_FIELDS = new Set(['pac_days', 'sedex_days']);
const NOT_NULL = new Set(['pac_extra_kg', 'sedex_extra_kg']);

const toValue = (key, raw) => {
  if (raw === '' || raw == null) return NOT_NULL.has(key) ? 0 : null;
  const n = Number(String(raw).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return NOT_NULL.has(key) ? 0 : null;
  return INT_FIELDS.has(key) ? Math.round(n) : n;
};

/** Tabela de frete Correios por estado: a equipe preenche com o preço de
 * balcão dos Correios. Estado sem preço = aquele serviço não aparece. */
export default function ShippingRatesCard() {
  const [rows, setRows] = useState(null);
  const [dirty, setDirty] = useState(new Set());
  const [fillAll, setFillAll] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchShippingRates().then(setRows);
  }, []);

  if (!rows) return null;

  const update = (uf, key, value) => {
    setRows((rs) => rs.map((r) => (r.uf === uf ? { ...r, [key]: value } : r)));
    setDirty((d) => new Set(d).add(uf));
    setMessage('');
  };

  const applyToAll = () => {
    const keys = Object.keys(fillAll).filter((k) => fillAll[k] !== '');
    if (keys.length === 0) return;
    setRows((rs) => rs.map((r) => ({ ...r, ...Object.fromEntries(keys.map((k) => [k, fillAll[k]])) })));
    setDirty(new Set(rows.map((r) => r.uf)));
    setMessage('Aplicado a todos os estados. Clique em Salvar.');
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = rows
      .filter((r) => dirty.has(r.uf))
      .map((r) => ({ uf: r.uf, ...Object.fromEntries(FIELDS.map(([k]) => [k, toValue(k, r[k])])) }));
    const { error } = await saveShippingRates(payload);
    setSaving(false);
    if (error) {
      setMessage('Não foi possível salvar.');
      return;
    }
    setDirty(new Set());
    setMessage('Salvo!');
  };

  const filled = rows.filter((r) => r.pac_price != null || r.sedex_price != null).length;

  return (
    <details className="group rounded-xl border border-border bg-panel p-5">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
        <span>
          <span className="text-lg font-bold">Tabela de frete (Correios)</span>
          <span className="block text-xs text-text-secondary">
            {filled} de {rows.length} estados com preço · clique para abrir
          </span>
        </span>
        <span className="text-sm text-text-secondary transition-transform group-open:rotate-180" aria-hidden="true">▾</span>
      </summary>

      <div className="mt-4 flex flex-col gap-4">
        <p className="text-sm text-text-secondary">
          Preencha com o preço de balcão dos Correios saindo da sua cidade (simulador em correios.com.br) para
          cada estado de destino. O frete do carrinho é: <strong>valor até 1 kg + valor por kg adicional</strong>, usando o
          peso dos produtos já embalados (cadastro do produto). Deixe o preço em branco para não oferecer o serviço
          naquele estado.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-x-1 border-spacing-y-1 text-left text-sm">
            <thead>
              <tr className="text-xs text-text-secondary">
                <th rowSpan={2} className="px-1 align-bottom">UF</th>
                <th colSpan={3} className="px-1 text-center font-bold text-text-primary">PAC</th>
                <th colSpan={3} className="px-1 text-center font-bold text-text-primary">SEDEX</th>
              </tr>
              <tr className="text-xs text-text-secondary">
                {FIELDS.map(([key, label]) => <th key={key} className="px-1 font-medium">{label}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr className="bg-bg">
                <td className="rounded-l-md px-2 text-xs font-semibold">Todos</td>
                {FIELDS.map(([key, , step]) => (
                  <td key={key}>
                    <input type="number" min="0" step={step} value={fillAll[key] ?? ''} onChange={(e) => setFillAll({ ...fillAll, [key]: e.target.value })} className={`${cellClass} bg-panel`} aria-label={`Preencher ${key} em todos os estados`} />
                  </td>
                ))}
                <td className="rounded-r-md pl-1">
                  <button type="button" onClick={applyToAll} className="whitespace-nowrap text-xs font-semibold text-accent hover:underline">Aplicar a todos</button>
                </td>
              </tr>
              {rows.map((r) => (
                <tr key={r.uf}>
                  <td className="px-2 font-mono font-semibold">{r.uf}</td>
                  {FIELDS.map(([key, , step]) => (
                    <td key={key}>
                      <input type="number" min="0" step={step} value={r[key] ?? ''} onChange={(e) => update(r.uf, key, e.target.value)} className={cellClass} aria-label={`${r.uf} ${key}`} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-end gap-3">
          {message && <span className="text-sm text-text-secondary">{message}</span>}
          <Button type="button" onClick={handleSave} disabled={saving || dirty.size === 0}>{saving ? 'Salvando…' : 'Salvar tabela'}</Button>
        </div>
      </div>
    </details>
  );
}
