import { useEffect, useMemo, useState } from 'react';
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

const STATUS_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'producing', label: 'Em produção' },
  { value: 'pending', label: 'Pendente' },
  { value: 'completed', label: 'Concluído' },
  { value: 'canceled', label: 'Cancelado' },
];

const formatOrderNumber = (o) => `#${String(o.sequence_number).padStart(4, '0')}`;

const dayKey = (iso) => new Date(iso).toLocaleDateString('pt-BR');

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

export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchMyOrders()
      .then(setOrders)
      .finally(() => setIsLoading(false));
  }, []);

  // Filtra por status + busca (cliente ou número do pedido) e agrupa por dia,
  // preservando a ordem (mais recente primeiro) que já vem da query.
  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = orders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (!term) return true;
      const haystack = `${o.customer_name} ${formatOrderNumber(o)} ${o.sequence_number}`.toLowerCase();
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
  }, [orders, statusFilter, search]);

  const totalFiltered = groups.reduce((sum, g) => sum + g.orders.length, 0);

  return (
    <div className="min-h-screen bg-bg">
      <Header />
      <main className="mx-auto max-w-[1400px] px-6 py-10 sm:px-10">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Meus Pedidos</h1>
          <Link to="/" className="text-sm font-medium text-accent hover:underline">
            Voltar pro Studio
          </Link>
        </div>

        {/* Filtros */}
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setStatusFilter(f.value)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  statusFilter === f.value ? 'border-text-primary bg-text-primary text-white' : 'border-border'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente ou nº do pedido"
            className="w-full rounded-lg border border-border bg-panel px-4 py-2 text-sm outline-none transition-colors focus:border-text-primary sm:w-72"
          />
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
                    {group.label}
                  </h2>
                  <span className="text-xs text-text-secondary">
                    {group.orders.length} {group.orders.length === 1 ? 'pedido' : 'pedidos'}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {group.orders.map((o) => {
                    const status = STATUS[o.status] || { label: o.status, className: 'bg-bg text-text-secondary' };
                    return (
                      <div
                        key={o.id}
                        className="flex flex-col overflow-hidden rounded-xl border border-border bg-panel shadow-sm transition-shadow hover:shadow-md"
                      >
                        <a
                          href={o.preview_image_url || undefined}
                          target="_blank"
                          rel="noreferrer"
                          className="flex h-44 items-center justify-center bg-bg"
                        >
                          {o.preview_image_url ? (
                            <img
                              src={o.preview_image_url}
                              alt={`Prévia do pedido ${formatOrderNumber(o)}`}
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <span className="text-xs text-text-secondary">Sem prévia</span>
                          )}
                        </a>

                        <div className="flex flex-1 flex-col gap-2 p-4">
                          <div className="flex items-center justify-between">
                            <span className="font-bold">{formatOrderNumber(o)}</span>
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}
                            >
                              {status.label}
                            </span>
                          </div>

                          <p className="font-medium text-text-primary">{o.customer_name}</p>
                          <p className="text-xs text-text-secondary">
                            {[o.product?.name, o.color?.name, o.size?.name, o.model?.name]
                              .filter(Boolean)
                              .join(' · ') || '—'}
                          </p>

                          <div className="mt-auto flex items-center justify-between pt-2 text-sm">
                            <span className="font-semibold">{formatCurrency(Number(o.line_total))}</span>
                            <span className="text-text-secondary">{formatTime(o.created_at)}</span>
                          </div>
                        </div>
                      </div>
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
