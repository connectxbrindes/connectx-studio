import { useEffect, useState } from 'react';
import { fetchOrders, updateOrderStatus } from '../../lib/api';
import { shouldNotifyStatus, notifyOrderStatus } from '../../lib/whatsapp';
import { formatCurrency } from '../../utils/price';
import DataTable from '../../components/admin/DataTable';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendente' },
  { value: 'producing', label: 'Em produção' },
  { value: 'completed', label: 'Concluído' },
  { value: 'canceled', label: 'Cancelado' },
];

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatOrderNumber(order) {
  return `#${String(order.sequence_number).padStart(4, '0')}`;
}

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [resellerFilter, setResellerFilter] = useState('all');
  const [notice, setNotice] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    setOrders(await fetchOrders());
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStatusChange = async (order, status) => {
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status } : o)));
    await updateOrderStatus(order.id, status);

    if (!shouldNotifyStatus(status)) return;

    const { sent, reason } = await notifyOrderStatus(order.id);
    const unidade = order.reseller?.name || 'a unidade';

    if (sent) {
      setNotice(`Status atualizado e ${unidade} foi notificada no WhatsApp.`);
    } else if (reason === 'no_phone') {
      setNotice(`Status atualizado, mas "${unidade}" não tem telefone cadastrado — nenhuma notificação foi enviada.`);
    } else if (reason === 'not_configured') {
      setNotice('Status atualizado. A notificação por WhatsApp ainda não está configurada (aguardando a conta da Meta).');
    } else {
      setNotice('Status atualizado, mas houve um erro ao enviar a notificação por WhatsApp.');
    }
  };

  const resellerOptions = Array.from(
    new Map(orders.filter((o) => o.reseller).map((o) => [o.reseller.id, o.reseller])).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  const visibleOrders = orders
    .filter((o) => statusFilter === 'all' || o.status === statusFilter)
    .filter((o) => resellerFilter === 'all' || o.reseller?.id === resellerFilter);

  const columns = [
    {
      key: 'preview',
      label: 'Prévia',
      render: (o) =>
        o.preview_image_url ? (
          <a href={o.preview_image_url} target="_blank" rel="noreferrer">
            <img
              src={o.preview_image_url}
              alt={`Prévia do pedido ${formatOrderNumber(o)}`}
              className="h-14 w-14 rounded-lg border border-border object-cover"
            />
          </a>
        ) : (
          '—'
        ),
    },
    {
      key: 'order_number',
      label: 'Pedido',
      render: (o) => (
        <span className="font-semibold" title={o.order_number}>
          {formatOrderNumber(o)}
        </span>
      ),
    },
    { key: 'customer_name', label: 'Cliente', render: (o) => o.customer_name },
    {
      key: 'product',
      label: 'Produto',
      render: (o) =>
        [o.product?.name, o.color?.name, o.size?.name, o.model?.name].filter(Boolean).join(' · ') || '—',
    },
    { key: 'quantity', label: 'Qtd', render: (o) => o.quantity },
    { key: 'line_total', label: 'Total', render: (o) => formatCurrency(Number(o.line_total)) },
    { key: 'reseller', label: 'Revendedor', render: (o) => o.reseller?.name || '—' },
    {
      key: 'files',
      label: 'Arquivos',
      render: (o) =>
        o.original_files_zip_url ? (
          <a href={o.original_files_zip_url} className="font-medium text-accent hover:underline" download>
            Baixar .zip
          </a>
        ) : (
          '—'
        ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (o) => (
        <select
          value={o.status}
          onChange={(e) => handleStatusChange(o, e.target.value)}
          className="rounded-lg border border-border px-2 py-1 text-sm outline-none focus:border-text-primary"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ),
    },
    { key: 'created_at', label: 'Data', render: (o) => formatDate(o.created_at) },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">Gestão de Pedidos</h2>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === 'all' ? 'border-text-primary bg-text-primary text-white' : 'border-border'
              }`}
            >
              Todos
            </button>
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatusFilter(option.value)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  statusFilter === option.value ? 'border-text-primary bg-text-primary text-white' : 'border-border'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <select
            value={resellerFilter}
            onChange={(e) => setResellerFilter(e.target.value)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm outline-none focus:border-text-primary"
          >
            <option value="all">Todas as unidades</option>
            {resellerOptions.map((reseller) => (
              <option key={reseller.id} value={reseller.id}>
                {reseller.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {notice && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} className="font-medium hover:underline">
            Fechar
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex h-32 items-center justify-center text-text-secondary">Carregando…</div>
      ) : (
        <DataTable
          columns={columns}
          rows={visibleOrders}
          getRowId={(o) => o.id}
          emptyMessage="Nenhum pedido encontrado com esses filtros."
        />
      )}
    </div>
  );
}
