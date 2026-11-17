import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchMyTokens } from '../lib/api';
import Header from '../components/layout/Header';

const STATUS = {
  active: { label: 'Disponível', className: 'bg-green-100 text-green-800' },
  used: { label: 'Usado', className: 'bg-neutral-200 text-neutral-700' },
  inactive: { label: 'Desativado', className: 'bg-red-100 text-red-700' },
};
const FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Disponíveis' },
  { value: 'used', label: 'Usados' },
];

const formatDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';

/** Status efetivo: código de lote desativado não vale mais. */
const statusOf = (t) => (t.status === 'active' && !t.batch_active ? 'inactive' : t.status);

/** Studio — códigos da campanha que o Painel vinculou à unidade. */
export default function MyTokens() {
  const [tokens, setTokens] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    fetchMyTokens()
      .then(setTokens)
      .finally(() => setIsLoading(false));
  }, []);

  const counts = useMemo(() => ({
    all: tokens.length,
    active: tokens.filter((t) => statusOf(t) === 'active').length,
    used: tokens.filter((t) => statusOf(t) === 'used').length,
  }), [tokens]);

  // Agrupa por campanha (lote), mantendo a ordem do servidor (mais recente primeiro).
  const groups = useMemo(() => {
    const byBatch = new Map();
    for (const t of tokens) {
      if (filter !== 'all' && statusOf(t) !== filter) continue;
      if (!byBatch.has(t.batch_name)) byBatch.set(t.batch_name, { name: t.batch_name, products: t.product_names || [], items: [] });
      byBatch.get(t.batch_name).items.push(t);
    }
    return [...byBatch.values()];
  }, [tokens, filter]);

  const copy = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(''), 1500);
    } catch {
      // Sem permissão de área de transferência: o código continua visível na tela.
    }
  };

  return (
    <div className="min-h-screen bg-bg">
      <Header />
      <main className="mx-auto max-w-[900px] px-6 py-10 sm:px-10">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Meus códigos</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Códigos da campanha entregues à sua unidade. Cada código vale uma única compra na loja virtual.
            </p>
          </div>
          <Link to="/" className="whitespace-nowrap text-sm font-medium text-accent hover:underline">
            Voltar pro Studio
          </Link>
        </div>

        {!isLoading && tokens.length > 0 && (
          <div className="mb-6 grid grid-cols-3 gap-3">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                aria-pressed={filter === f.value}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  filter === f.value ? 'border-text-primary bg-panel' : 'border-border bg-panel/60 hover:border-text-primary'
                }`}
              >
                <span className="block text-2xl font-bold">{counts[f.value]}</span>
                <span className="text-xs text-text-secondary">{f.label}</span>
              </button>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="flex h-32 items-center justify-center text-text-secondary">Carregando…</div>
        ) : tokens.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border px-6 text-center text-text-secondary">
            Nenhum código foi vinculado à sua unidade ainda.
          </div>
        ) : groups.length === 0 ? (
          <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border text-text-secondary">
            Nenhum código neste filtro.
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {groups.map((g) => (
              <section key={g.name} className="overflow-hidden rounded-xl border border-border bg-panel">
                <header className="border-b border-border bg-bg px-4 py-3">
                  <h2 className="font-semibold">{g.name}</h2>
                  {g.products.length > 0 && <p className="text-xs text-text-secondary">Válido para: {g.products.join(', ')}</p>}
                </header>
                <ul className="divide-y divide-border">
                  {g.items.map((t) => {
                    const st = STATUS[statusOf(t)] || STATUS.inactive;
                    return (
                      <li key={t.code} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                        <span className="font-mono text-base font-bold tracking-wider">{t.code}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st.className}`}>{st.label}</span>
                        {t.status === 'used' && (
                          <span className="text-xs text-text-secondary">
                            {formatDateTime(t.used_at)}{t.used_order_number ? ` · Pedido ${t.used_order_number}` : ''}
                          </span>
                        )}
                        {statusOf(t) === 'active' && (
                          <button type="button" onClick={() => copy(t.code)} className="ml-auto text-xs font-semibold text-accent hover:underline">
                            {copied === t.code ? 'Copiado!' : 'Copiar'}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
