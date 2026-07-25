import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchMyOrders } from '../lib/api';
import { formatCurrency } from '../utils/price';
import DataTable from '../components/admin/DataTable';
import Header from '../components/layout/Header';

const STATUS_LABELS = {
  pending: { label: 'Pendente', className: 'bg-amber-100 text-amber-800' },
  producing: { label: 'Em produção', className: 'bg-blue-100 text-blue-800' },
  completed: { label: 'Concluído', className: 'bg-green-100 text-green-800' },
  canceled: { label: 'Cancelado', className: 'bg-red-100 text-red-800' },
};

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchMyOrders()
      .then(setOrders)
      .finally(() => setIsLoading(false));
  }, []);

  const columns = [
    {
      key: 'order_number',
      label: 'Pedido',
      render: (o) => (
        <span className="font-semibold" title={o.order_number}>
          #{String(o.sequence_number).padStart(4, '0')}
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
    {
      key: 'status',
      label: 'Status',
      render: (o) => {
        const status = STATUS_LABELS[o.status] || { label: o.status, className: 'bg-bg text-text-secondary' };
        return (
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}>
            {status.label}
          </span>
        );
      },
    },
    { key: 'created_at', label: 'Data', render: (o) => formatDate(o.created_at) },
  ];

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

        {isLoading ? (
          <div className="flex h-32 items-center justify-center text-text-secondary">Carregando…</div>
        ) : (
          <DataTable
            columns={columns}
            rows={orders}
            getRowId={(o) => o.id}
            emptyMessage="Sua unidade ainda não fez nenhum pedido."
          />
        )}
      </main>
    </div>
  );
}
