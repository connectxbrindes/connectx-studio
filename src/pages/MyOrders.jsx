import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchMyOrders } from '../lib/api';
import { formatCurrency } from '../utils/price';
import Header from '../components/layout/Header';

const STATUS = {
  producing: { label: 'Em produção', className: 'bg-blue-100 text-blue-800' },
  pending: { label: 'Pendente', className: 'bg-amber-100 text-amber-800' },
  completed: { label: 'Concluído', className: 'bg-green-100 text-green-800' },
  canceled: { label: 'Cancelado', className: 'bg-red-100 text-red-800' },
};

// Ordem dos tiles de resumo/filtro no topo.
const TILES = [
  { value: 'all', label: 'Todos' },
  { value: 'producing', label: 'Em produção' },
  { value: 'pending', label: 'Pendente' },
  { value: 'completed', label: 'Concluído' },
  { value: 'canceled', label: 'Cancelado' },
];

const formatOrderNumber = (o) => `#${String(o.sequence_number).padStart(4, '0')}`;
const dayKey = (iso) => new Date(iso).toLocaleDateString('pt-BR');

// 'YYYY-MM-DD' no fuso local — pra casar com o valor do <input type="date">.
function isoDateKey(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const todayKey = isoDateKey(new Date());

function dayLabel(iso) {
  const key = dayKey(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (key === today.toLocaleDateString('pt-BR')) return 'Hoje';
  if (key === yesterday.toLocaleDateString('pt-BR')) return 'Ontem';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

const formatTime = (iso) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const productLine = (o) =>
  [o.product?.name, o.color?.name, o.size?.name, o.model?.name].filter(Boolean).join(' · ') || '—';

export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const searchRef = useRef(null);

  useEffect(() => {
    fetchMyOrders()
      .then(setOrders)
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Contagem por status pros tiles (sempre sobre o total, independe do filtro).
  const counts = useMemo(() => {
    const c = { all: orders.length, producing: 0, pending: 0, completed: 0, canceled: 0 };
    for (const o of orders) if (o.status in c) c[o.status] += 1;
    return c;
  }, [orders]);

  // Filtra por status + busca (cliente, nº, telefone, produto/modelo) e agrupa
  // por dia, preservando a ordem (mais recente primeiro) que já vem da query.
  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = orders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (dateFilter && isoDateKey(o.created_at) !== dateFilter) return false;
      if (!term) return true;
      const haystack = [
        o.customer_name,
        o.customer_contact,
        formatOrderNumber(o),
        o.sequence_number,
        productLine(o),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });

    const byDay = [];
    const index = new Map();
    for (const o of filtered) {
      const key = dayKey(o.created_at);
      if (!index.has(key)) {
        index.set(key, byDay.length);
        byDay.push({ key, label: dayLabel(o.created_at), orders: [] });
      }
      byDay[index.get(key)].orders.push(o);
    }
    return byDay;
  }, [orders, statusFilter, search, dateFilter]);

  const totalFiltered = groups.reduce((sum, g) => sum + g.orders.length, 0);

  return (
    <div className="min-h-screen bg-bg">
      <Header />
      <main className="mx-auto max-w-[1400px] px-6 py-10 sm:px-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Meus Pedidos</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Encontre o pedido pela busca ou pelo status, e clique pra ver a prévia.
            </p>
          </div>
          <Link to="/" className="text-sm font-medium text-accent hover:underline">
            Voltar pro Studio
          </Link>
        </div>

        {/* Tiles de resumo que também filtram */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {TILES.map((tile) => {
            const active = statusFilter === tile.value;
            return (
              <button
                key={tile.value}
                type="button"
                aria-pressed={active}
                onClick={() => setStatusFilter(tile.value)}
                className={`rounded-2xl border p-4 text-left transition-colors ${
                  active ? 'border-text-primary bg-text-primary text-white' : 'border-border bg-panel hover:border-text-primary'
                }`}
              >
                <span className="block text-2xl font-bold leading-none">{counts[tile.value] ?? 0}</span>
                <span className={`mt-1 block text-xs ${active ? 'text-white/80' : 'text-text-secondary'}`}>
                  {tile.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Busca + filtro por data */}
        <div className="mb-8 flex flex-col gap-3 sm:flex-row">
          <div className="flex flex-1 items-center gap-3 rounded-xl border border-border bg-panel px-4 py-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 text-text-secondary">
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" d="m20 20-3-3" />
            </svg>
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente, nº do pedido, telefone ou produto"
              className="w-full bg-transparent text-sm outline-none placeholder:text-text-secondary"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Limpar busca"
                className="text-text-secondary hover:text-text-primary"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-border bg-panel px-4 py-3">
            <span className="text-sm text-text-secondary">Data</span>
            <input
              type="date"
              value={dateFilter}
              max={todayKey}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-transparent text-sm outline-none"
            />
            <button
              type="button"
              onClick={() => setDateFilter(todayKey)}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                dateFilter === todayKey ? 'bg-text-primary text-white' : 'border border-border text-text-secondary'
              }`}
            >
              Hoje
            </button>
            {dateFilter && (
              <button
                type="button"
                onClick={() => setDateFilter('')}
                aria-label="Limpar data"
                className="text-text-secondary hover:text-text-primary"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-32 items-center justify-center text-text-secondary">Carregando…</div>
        ) : totalFiltered === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border text-text-secondary">
            {orders.length === 0
              ? 'Sua unidade ainda não fez nenhum pedido.'
              : 'Nenhum pedido encontrado com esses filtros.'}
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {groups.map((group) => (
              <section key={group.key}>
                <div className="mb-3 flex items-center gap-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
                    {group.label} · {group.orders.length} {group.orders.length === 1 ? 'pedido' : 'pedidos'}
                  </h2>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <div className="flex flex-col gap-3">
                  {group.orders.map((o) => {
                    const status = STATUS[o.status] || { label: o.status, className: 'bg-bg text-text-secondary' };
                    return (
                      <article
                        key={o.id}
                        className="flex flex-col gap-4 rounded-2xl border border-border bg-panel p-4 shadow-sm transition-shadow hover:shadow-md sm:flex-row sm:items-center"
                      >
                        {/* Prévia */}
                        <a
                          href={o.preview_image_url || undefined}
                          target="_blank"
                          rel="noreferrer"
                          className="flex h-24 w-24 flex-shrink-0 items-center justify-center self-center overflow-hidden rounded-xl border border-border bg-bg sm:self-auto"
                        >
                          {o.preview_image_url ? (
                            <img
                              src={o.preview_image_url}
                              alt={`Prévia do pedido ${formatOrderNumber(o)}`}
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <span className="px-1 text-center text-[10px] text-text-secondary">Sem prévia</span>
                          )}
                        </a>

                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <span className="text-lg font-bold">{formatOrderNumber(o)}</span>
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}
                            >
                              {status.label}
                            </span>
                          </div>
                          <p className="font-medium text-text-primary">{o.customer_name}</p>
                          <p className="truncate text-xs text-text-secondary">{productLine(o)}</p>
                        </div>

                        {/* Total + hora */}
                        <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-center">
                          <span className="text-lg font-semibold">{formatCurrency(Number(o.line_total))}</span>
                          <span className="text-xs text-text-secondary">
                            {group.label === 'Hoje' || group.label === 'Ontem' ? `${group.label}, ` : ''}
                            {formatTime(o.created_at)}
                          </span>
                        </div>

                        {/* Ação */}
                        {o.preview_image_url && (
                          <a
                            href={o.preview_image_url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-shrink-0 rounded-xl bg-text-primary px-4 py-2.5 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
                          >
                            Ver prévia
                          </a>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
