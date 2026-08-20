import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { fetchOrders, updateOrderStatus, fetchProductionReport, fetchCategories, fetchAllBrandModels } from '../../lib/api';
import { shouldNotifyStatus, notifyOrderStatus } from '../../lib/whatsapp';
import { formatCurrency } from '../../utils/price';
import DataTable from '../../components/admin/DataTable';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';

const orderCategory = (o) => o.product?.category || o.product?.subcategory?.category || null;
const todayLocal = () => new Date().toLocaleDateString('en-CA'); // yyyy-mm-dd (local)
// 'yyyy-mm-dd' no fuso local — pra casar com o <input type="date">.
const dateKeyLocal = (iso) => new Date(iso).toLocaleDateString('en-CA');

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendente' },
  { value: 'producing', label: 'Em produção' },
  { value: 'completed', label: 'Concluído' },
  { value: 'canceled', label: 'Cancelado' },
];

const STATUS_LABELS = Object.fromEntries(STATUS_OPTIONS.map((o) => [o.value, o.label]));

// Ordem dos botões de filtro da lista (independente do dropdown de status).
const STATUS_FILTERS = [
  { value: 'producing', label: 'Em produção' },
  { value: 'completed', label: 'Concluído' },
  { value: 'pending', label: 'Pendente' },
  { value: 'canceled', label: 'Cancelado' },
  { value: 'all', label: 'Todos' },
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
  const [statusFilter, setStatusFilter] = useState('producing'); // padrão: Em produção
  const [resellerFilter, setResellerFilter] = useState('all');
  const [modelFilter, setModelFilter] = useState('all');
  const [allModels, setAllModels] = useState([]);
  const [dateFilter, setDateFilter] = useState('');
  const [notice, setNotice] = useState('');

  // Relatório de produção (itens concluídos por intervalo + categoria).
  const [reportOpen, setReportOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const [repFrom, setRepFrom] = useState(todayLocal());
  const [repTo, setRepTo] = useState(todayLocal());
  const [repCategory, setRepCategory] = useState('all');
  const [repStatus, setRepStatus] = useState('completed');
  const [repRows, setRepRows] = useState(null); // null = ainda não gerou
  const [repLoading, setRepLoading] = useState(false);

  // Modal de cancelamento (pede o motivo ao mudar status para Cancelado).
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReasonInput, setCancelReasonInput] = useState('');
  const [cancelSaving, setCancelSaving] = useState(false);

  const confirmCancel = async () => {
    if (!cancelTarget || !cancelReasonInput.trim()) return;
    setCancelSaving(true);
    await handleStatusChange(cancelTarget, 'canceled', cancelReasonInput);
    setCancelSaving(false);
    setCancelTarget(null);
    setCancelReasonInput('');
  };

  const loadData = async () => {
    setIsLoading(true);
    setOrders(await fetchOrders());
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
    fetchCategories().then(setCategories);
    fetchAllBrandModels().then(setAllModels);
  }, []);

  const generateReport = async () => {
    if (!repFrom || !repTo) return;
    setRepLoading(true);
    const fromISO = new Date(`${repFrom}T00:00:00`).toISOString();
    const toISO = new Date(`${repTo}T23:59:59.999`).toISOString();
    const rows = await fetchProductionReport(fromISO, toISO, repStatus);
    const filtered =
      repCategory === 'all' ? rows : rows.filter((o) => orderCategory(o)?.id === repCategory);
    setRepRows(filtered);
    setRepLoading(false);
  };

  const exportReport = () => {
    if (!repRows || repRows.length === 0) return;
    const data = repRows.map((o) => ({
      Pedido: formatOrderNumber(o),
      Data: formatDate(o.created_at),
      Categoria: orderCategory(o)?.name || '—',
      Produto: o.product?.name || '—',
      Modelo: o.model?.name || '',
      Cor: o.color?.name || '',
      Tamanho: o.size?.name || '',
      Qtd: o.quantity,
      Status: STATUS_LABELS[o.status] || o.status,
      Cliente: o.customer_name || '',
      Unidade: o.reseller?.short_name || o.reseller_name || '',
      Observação: o.customer_note || '',
      'Motivo Cancelamento': o.cancel_reason || '',
      Total: Number(o.line_total || 0),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = Object.keys(data[0]).map((k) => ({
      wch: Math.min(Math.max(k.length, ...data.map((r) => String(r[k] ?? '').length)) + 2, 40),
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Produção');
    XLSX.writeFile(wb, `relatorio_producao_${repFrom}_a_${repTo}.xlsx`);
  };

  const handleStatusChange = async (order, status, cancelReason) => {
    const novoMotivo = status === 'canceled' ? (cancelReason || '').trim() || null : null;
    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, status, cancel_reason: novoMotivo } : o))
    );
    await updateOrderStatus(order.id, status, cancelReason);

    if (!shouldNotifyStatus(status)) return;

    const { sent, reason } = await notifyOrderStatus(order.id);
    const unidade = order.reseller_name || 'a unidade';

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
    new Map(
      orders.filter((o) => o.reseller_id).map((o) => [o.reseller_id, { id: o.reseller_id, name: o.reseller_name || '—' }])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  // Todos os modelos cadastrados, rotulados "MARCA · Modelo".
  const modelOptions = [...allModels]
    .sort(
      (a, b) =>
        (a.brand?.name || '').localeCompare(b.brand?.name || '') ||
        (a.name || '').localeCompare(b.name || '')
    )
    .map((m) => ({
      id: m.id,
      label: `${m.brand?.name ? `${m.brand.name} · ` : ''}${(m.name || '').trim()}`,
    }));

  const visibleOrders = orders
    .filter((o) => statusFilter === 'all' || o.status === statusFilter)
    .filter((o) => resellerFilter === 'all' || o.reseller_id === resellerFilter)
    .filter((o) => modelFilter === 'all' || o.model?.id === modelFilter)
    .filter((o) => !dateFilter || dateKeyLocal(o.created_at) === dateFilter);

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
              className="h-14 w-14 rounded-lg border border-border object-contain"
            />
          </a>
        ) : (
          '—'
        ),
    },
    {
      key: 'art',
      label: 'Arte',
      render: (o) =>
        o.art_image_url ? (
          <a href={o.art_image_url} target="_blank" rel="noreferrer" download>
            <img
              src={o.art_image_url}
              alt={`Arte do pedido ${formatOrderNumber(o)}`}
              title="Arte montada (sem mockup) — clique para abrir/baixar"
              className="h-14 w-14 rounded-lg border border-border bg-[repeating-conic-gradient(#e5e5e5_0_25%,#fff_0_50%)] bg-[length:12px_12px] object-contain"
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
      key: 'reseller',
      label: 'Unidade',
      // Mostra o apelido (nome curto) da unidade; se não houver, cai no nome
      // completo. O nome completo fica sempre no tooltip.
      render: (o) => (
        <span className="font-medium text-text-primary" title={o.reseller?.name || o.reseller_name || ''}>
          {o.reseller?.short_name || o.reseller_name || '—'}
        </span>
      ),
    },
    {
      key: 'product',
      label: 'Produto',
      render: (o) =>
        [o.product?.name, o.color?.name, o.size?.name, o.model?.name].filter(Boolean).join(' · ') || '—',
    },
    { key: 'quantity', label: 'Qtd', render: (o) => o.quantity },
    {
      key: 'customer_note',
      label: 'Observação',
      render: (o) =>
        o.customer_note ? (
          <span
            title={o.customer_note}
            className="block max-w-[16rem] whitespace-pre-wrap break-words rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-800"
          >
            {o.customer_note}
          </span>
        ) : (
          <span className="text-text-secondary">—</span>
        ),
    },
    { key: 'line_total', label: 'Total', render: (o) => formatCurrency(Number(o.line_total)) },
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
          onChange={(e) => {
            const v = e.target.value;
            if (v === 'canceled') {
              // Pede o motivo antes de cancelar (não aplica direto).
              setCancelReasonInput('');
              setCancelTarget(o);
            } else {
              handleStatusChange(o, v);
            }
          }}
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
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">Gestão de Pedidos</h2>
          <Button variant="secondary" onClick={() => setReportOpen(true)}>
            📋 Relatório de Produção
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((option) => (
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

          <select
            value={modelFilter}
            onChange={(e) => setModelFilter(e.target.value)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm outline-none focus:border-text-primary"
          >
            <option value="all">Todos os modelos</option>
            {modelOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="rounded-lg border border-border px-3 py-1.5 text-sm outline-none focus:border-text-primary"
            />
            {dateFilter && (
              <button
                type="button"
                onClick={() => setDateFilter('')}
                aria-label="Limpar data"
                title="Limpar data"
                className="rounded-lg border border-border px-2 py-1.5 text-sm text-text-secondary hover:text-text-primary"
              >
                ✕
              </button>
            )}
          </div>
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

      <Modal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Relatório de Produção"
        maxWidthClass="max-w-5xl"
      >
        {/* Filtros */}
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text-secondary">De</span>
            <input
              type="date"
              value={repFrom}
              onChange={(e) => setRepFrom(e.target.value)}
              className="rounded-lg border border-border bg-bg px-3 py-2 outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text-secondary">Até</span>
            <input
              type="date"
              value={repTo}
              onChange={(e) => setRepTo(e.target.value)}
              className="rounded-lg border border-border bg-bg px-3 py-2 outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text-secondary">Categoria</span>
            <select
              value={repCategory}
              onChange={(e) => setRepCategory(e.target.value)}
              className="rounded-lg border border-border bg-bg px-3 py-2 outline-none focus:border-accent"
            >
              <option value="all">Todas as categorias</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text-secondary">Status</span>
            <select
              value={repStatus}
              onChange={(e) => setRepStatus(e.target.value)}
              className="rounded-lg border border-border bg-bg px-3 py-2 outline-none focus:border-accent"
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <Button onClick={generateReport} disabled={repLoading}>
            {repLoading ? 'Gerando…' : 'Gerar relatório'}
          </Button>
        </div>

        {/* Resultado */}
        <div className="mt-6">
          {repRows === null ? (
            <p className="text-sm text-text-secondary">
              Escolha o período e a categoria e clique em “Gerar relatório”.
            </p>
          ) : repRows.length === 0 ? (
            <p className="text-sm text-text-secondary">
              Nenhum item concluído nesse período/categoria.
            </p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-text-secondary">
                  <span className="font-semibold text-text-primary">{repRows.length}</span> itens ·{' '}
                  <span className="font-semibold text-text-primary">
                    {repRows.reduce((s, o) => s + (o.quantity || 0), 0)}
                  </span>{' '}
                  un ·{' '}
                  <span className="font-semibold text-text-primary">
                    {formatCurrency(repRows.reduce((s, o) => s + Number(o.line_total || 0), 0))}
                  </span>
                </p>
                <Button variant="secondary" onClick={exportReport}>
                  📊 Exportar Excel
                </Button>
              </div>

              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-bg text-text-secondary border-b border-border">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Pedido</th>
                      <th className="px-3 py-2 font-semibold">Data</th>
                      <th className="px-3 py-2 font-semibold">Categoria</th>
                      <th className="px-3 py-2 font-semibold">Produto</th>
                      <th className="px-3 py-2 font-semibold">Variação</th>
                      <th className="px-3 py-2 font-semibold text-center">Qtd</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                      <th className="px-3 py-2 font-semibold">Cliente</th>
                      <th className="px-3 py-2 font-semibold">Revendedor</th>
                      <th className="px-3 py-2 font-semibold">Observação</th>
                      <th className="px-3 py-2 font-semibold">Motivo Cancel.</th>
                      <th className="px-3 py-2 font-semibold text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {repRows.map((o, i) => (
                      <tr key={`${o.sequence_number}-${i}`}>
                        <td className="whitespace-nowrap px-3 py-2 font-medium">{formatOrderNumber(o)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-text-secondary">{formatDate(o.created_at)}</td>
                        <td className="px-3 py-2 text-text-secondary">{orderCategory(o)?.name || '—'}</td>
                        <td className="px-3 py-2">{o.product?.name || '—'}</td>
                        <td className="px-3 py-2 text-text-secondary">
                          {[o.model?.name, o.color?.name, o.size?.name].filter(Boolean).join(' · ') || '—'}
                        </td>
                        <td className="px-3 py-2 text-center">{o.quantity}</td>
                        <td className="px-3 py-2 text-text-secondary">{STATUS_LABELS[o.status] || o.status}</td>
                        <td className="px-3 py-2 text-text-secondary">{o.customer_name || '—'}</td>
                        <td className="px-3 py-2 text-text-secondary">{o.reseller_name || '—'}</td>
                        <td className="max-w-[220px] px-3 py-2 text-text-secondary">{o.customer_note || '—'}</td>
                        <td className="max-w-[220px] px-3 py-2 text-text-secondary">{o.cancel_reason || '—'}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">{formatCurrency(Number(o.line_total || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title="Cancelar pedido"
      >
        <p className="mb-3 text-sm text-text-secondary">
          Pedido <span className="font-semibold text-text-primary">{cancelTarget ? formatOrderNumber(cancelTarget) : ''}</span> — informe o motivo do cancelamento.
        </p>
        <textarea
          value={cancelReasonInput}
          onChange={(e) => setCancelReasonInput(e.target.value)}
          rows={3}
          autoFocus
          placeholder="Ex: cliente desistiu, erro na arte, produto sem estoque…"
          className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        />
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setCancelTarget(null)}>
            Voltar
          </Button>
          <Button onClick={confirmCancel} disabled={cancelSaving || !cancelReasonInput.trim()}>
            {cancelSaving ? 'Cancelando…' : 'Confirmar cancelamento'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
