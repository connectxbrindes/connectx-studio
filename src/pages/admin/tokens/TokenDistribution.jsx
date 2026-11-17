import { useEffect, useMemo, useState } from 'react';
import { fetchResellers } from '../../../lib/api';
import { assignTokens, fetchBatchTokens, releaseTokens } from '../../../lib/storeApi';
import Button from '../../../components/ui/Button';

/** Distribuição dos códigos de um lote entre os revendedores (Painel → Tokens). */
export default function TokenDistribution({ batch, onChanged, onDownload }) {
  const [tokens, setTokens] = useState(null);
  const [resellers, setResellers] = useState([]);
  const [resellerName, setResellerName] = useState('');
  const [quantity, setQuantity] = useState(10);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const loadTokens = async () => {
    const { tokens: t } = await fetchBatchTokens(batch.id);
    setTokens(t);
  };

  useEffect(() => {
    loadTokens();
    fetchResellers().then((r) => setResellers((r || []).filter((x) => x.status !== 'inactive')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch.id]);

  const free = useMemo(() => (tokens || []).filter((t) => !t.reseller_id && t.status === 'active').length, [tokens]);

  const groups = useMemo(() => {
    const byReseller = new Map();
    for (const t of tokens || []) {
      if (!t.reseller_id) continue;
      const g = byReseller.get(t.reseller_id) || { id: t.reseller_id, name: t.reseller?.name || '—', total: 0, used: 0, available: 0 };
      g.total += 1;
      if (t.status === 'used') g.used += 1;
      if (t.status === 'active') g.available += 1;
      byReseller.set(t.reseller_id, g);
    }
    return [...byReseller.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [tokens]);

  const handleAssign = async (e) => {
    e.preventDefault();
    setMessage('');
    const reseller = resellers.find((r) => r.name.trim().toLowerCase() === resellerName.trim().toLowerCase());
    if (!reseller) return setMessage('Escolha um revendedor da lista.');
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1) return setMessage('Informe uma quantidade maior que zero.');
    if (qty > free) return setMessage(`Só há ${free} código(s) livre(s) neste lote.`);
    setBusy(true);
    const { error, count } = await assignTokens(batch.id, reseller.id, qty);
    setBusy(false);
    if (error) return setMessage(error);
    setMessage(`${count} código(s) vinculado(s) a ${reseller.name}.`);
    setResellerName('');
    await loadTokens();
    onChanged?.();
  };

  const handleRelease = async (g) => {
    if (!window.confirm(`Remover de ${g.name} os ${g.available} código(s) ainda não usados? Eles voltam a ficar livres no lote.`)) return;
    setBusy(true);
    const { error, count } = await releaseTokens(batch.id, g.id);
    setBusy(false);
    setMessage(error || `${count} código(s) voltaram a ficar livres.`);
    await loadTokens();
    onChanged?.();
  };

  if (!tokens) return <p className="py-6 text-center text-sm text-text-secondary">Carregando códigos…</p>;

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-text-secondary">
        <strong className="text-text-primary">{free}</strong> código(s) livre(s) de {tokens.length}. Cada revendedor vê os
        códigos dele no Studio, em <strong>Meus códigos</strong>.
      </p>

      <form onSubmit={handleAssign} className="flex flex-wrap items-end gap-3 rounded-lg bg-bg p-3">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-sm">
          Revendedor
          <input
            list="token-resellers"
            value={resellerName}
            onChange={(e) => setResellerName(e.target.value)}
            placeholder="Digite para buscar…"
            className="rounded-lg border border-border bg-white px-3 py-2 outline-none focus:border-text-primary"
          />
          <datalist id="token-resellers">
            {resellers.map((r) => <option key={r.id} value={r.name} />)}
          </datalist>
        </label>
        <label className="flex w-28 flex-col gap-1 text-sm">
          Quantidade
          <input
            type="number"
            min={1}
            max={free || 1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="rounded-lg border border-border bg-white px-3 py-2 outline-none focus:border-text-primary"
          />
        </label>
        <Button type="submit" disabled={busy || free === 0}>{busy ? 'Salvando…' : 'Vincular códigos'}</Button>
      </form>
      {message && <p className="-mt-2 text-sm text-text-secondary">{message}</p>}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-bg text-xs uppercase text-text-secondary">
            <tr>
              <th className="px-3 py-2">Revendedor</th>
              <th className="px-3 py-2 text-right">Códigos</th>
              <th className="px-3 py-2 text-right">Usados</th>
              <th className="px-3 py-2 text-right">Disponíveis</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {groups.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-text-secondary">Nenhum código vinculado ainda.</td></tr>
            ) : (
              groups.map((g) => (
                <tr key={g.id}>
                  <td className="px-3 py-2 font-medium">{g.name}</td>
                  <td className="px-3 py-2 text-right">{g.total}</td>
                  <td className="px-3 py-2 text-right">{g.used}</td>
                  <td className="px-3 py-2 text-right">{g.available}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onDownload(tokens.filter((t) => t.reseller_id === g.id), g.name)}
                      className="mr-3 font-semibold text-text-primary hover:text-accent"
                    >
                      Baixar
                    </button>
                    {g.available > 0 && (
                      <button type="button" disabled={busy} onClick={() => handleRelease(g)} className="font-semibold text-accent hover:underline disabled:opacity-40">
                        Remover não usados
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
