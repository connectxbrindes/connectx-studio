import { useEffect, useState } from 'react';
import { fetchAdminProducts } from '../../lib/api';
import {
  fetchTokenBatches,
  generateTokenBatch,
  setTokenBatchActive,
  fetchBatchTokens,
  findToken,
  setTokenStatus,
} from '../../lib/storeApi';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';

const STATUS_LABELS = { active: 'Disponível', used: 'Usado', inactive: 'Desativado' };
const STATUS_STYLES = {
  active: 'bg-green-100 text-green-700',
  used: 'bg-neutral-200 text-neutral-700',
  inactive: 'bg-red-100 text-red-700',
};

const formatDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

/** Exemplo do formato do código, pra pré-visualizar no formulário. */
const sampleCode = (prefix, length) =>
  `${(prefix || '').toUpperCase().replace(/[^A-Z0-9]/g, '')}${'X'.repeat(Math.max(0, Number(length) || 0))}`;

function downloadCsv(filename, rows) {
  const csv = rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const EMPTY_FORM = { name: '', productIds: [], quantity: 100, prefix: 'CX', length: 8 };

export default function AdminTokens() {
  const [batches, setBatches] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [busyBatchId, setBusyBatchId] = useState(null);

  const [search, setSearch] = useState('');
  const [searchResult, setSearchResult] = useState(undefined); // undefined = não buscou; null = não achou
  const [searching, setSearching] = useState(false);

  const load = async () => {
    setLoading(true);
    const [b, p] = await Promise.all([fetchTokenBatches(), fetchAdminProducts()]);
    setBatches(b);
    setProducts((p || []).filter((prod) => prod.status === 'active'));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const toggleProduct = (id) =>
    setForm((f) => ({
      ...f,
      productIds: f.productIds.includes(id) ? f.productIds.filter((x) => x !== id) : [...f.productIds, id],
    }));

  const handleGenerate = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim()) return setFormError('Dê um nome ao lote (ex: "Campanha Natal – Loja Centro").');
    if (form.productIds.length === 0) return setFormError('Escolha em qual produto o token será válido.');
    const quantity = Number(form.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) return setFormError('Quantidade de 1 a 10.000.');
    setGenerating(true);
    const { error } = await generateTokenBatch({
      name: form.name.trim(),
      productIds: form.productIds,
      quantity,
      prefix: form.prefix,
      length: Number(form.length),
    });
    setGenerating(false);
    if (error) return setFormError(error);
    setIsModalOpen(false);
    setForm(EMPTY_FORM);
    load();
  };

  const handleToggleBatch = async (batch) => {
    const action = batch.active ? 'desativar' : 'reativar';
    if (!window.confirm(`Deseja ${action} o lote "${batch.name}"? ${batch.active ? 'Os códigos não usados deixam de valer.' : ''}`)) return;
    setBusyBatchId(batch.id);
    await setTokenBatchActive(batch.id, !batch.active);
    setBusyBatchId(null);
    load();
  };

  const handleExport = async (batch) => {
    setBusyBatchId(batch.id);
    const { tokens, error } = await fetchBatchTokens(batch.id);
    setBusyBatchId(null);
    if (error) {
      window.alert('Não foi possível baixar os códigos.');
      return;
    }
    const slug = batch.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
    downloadCsv(`tokens-${slug}.csv`, [
      ['Código', 'Situação', 'Usado em', 'Pedido'],
      ...tokens.map((t) => [t.code, STATUS_LABELS[t.status] || t.status, formatDateTime(t.used_at), t.used_order_number || '']),
    ]);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!search.trim()) return;
    setSearching(true);
    setSearchResult(await findToken(search));
    setSearching(false);
  };

  const handleToggleToken = async (token) => {
    const next = token.status === 'active' ? 'inactive' : 'active';
    await setTokenStatus(token.id, next);
    setSearchResult(await findToken(token.code));
    load();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold">Tokens da campanha</h3>
          <p className="text-sm text-text-secondary">
            Códigos de uso único impressos nos cartões. Cada código dá 1 unidade grátis do produto do lote na loja
            virtual (/store) e libera 10% de desconto nos demais itens do pedido.
          </p>
        </div>
        <Button onClick={() => { setForm(EMPTY_FORM); setFormError(''); setIsModalOpen(true); }}>+ Gerar lote</Button>
      </div>

      <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-panel p-4">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Consultar um código
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ex: CX7KQ9M2PA"
            className="rounded-lg border border-border px-3 py-2 font-mono uppercase outline-none focus:border-text-primary"
          />
        </label>
        <Button type="submit" variant="secondary" disabled={searching}>{searching ? 'Buscando…' : 'Consultar'}</Button>
        {searchResult === null && <p className="w-full text-sm text-accent">Código não encontrado.</p>}
        {searchResult && (
          <div className="flex w-full flex-wrap items-center gap-3 rounded-lg bg-bg px-4 py-3 text-sm">
            <span className="font-mono font-bold">{searchResult.code}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[searchResult.status]}`}>
              {STATUS_LABELS[searchResult.status]}
            </span>
            <span className="text-text-secondary">Lote: {searchResult.batch?.name}{searchResult.batch && !searchResult.batch.active ? ' (lote desativado)' : ''}</span>
            {searchResult.status === 'used' && (
              <span className="text-text-secondary">
                Usado em {formatDateTime(searchResult.used_at)} · Pedido {searchResult.used_order_number}
              </span>
            )}
            {searchResult.status !== 'used' && (
              <button type="button" onClick={() => handleToggleToken(searchResult)} className="ml-auto font-semibold text-accent hover:underline">
                {searchResult.status === 'active' ? 'Desativar código' : 'Reativar código'}
              </button>
            )}
          </div>
        )}
      </form>

      <div className="overflow-x-auto rounded-xl border border-border bg-panel">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-bg text-xs uppercase text-text-secondary">
            <tr>
              <th className="px-4 py-3">Lote</th>
              <th className="px-4 py-3">Válido para</th>
              <th className="px-4 py-3 text-right">Gerados</th>
              <th className="px-4 py-3 text-right">Usados</th>
              <th className="px-4 py-3 text-right">Disponíveis</th>
              <th className="px-4 py-3">Situação</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-text-secondary">Carregando…</td></tr>
            ) : batches.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-text-secondary">Nenhum lote gerado ainda.</td></tr>
            ) : (
              batches.map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{b.name}</p>
                    <p className="text-xs text-text-secondary">
                      {formatDateTime(b.created_at)} · formato {sampleCode(b.prefix, b.code_length)}
                    </p>
                  </td>
                  <td className="px-4 py-3">{(b.product_names || []).join(', ') || '—'}</td>
                  <td className="px-4 py-3 text-right">{b.quantity}</td>
                  <td className="px-4 py-3 text-right">{b.used_count}</td>
                  <td className="px-4 py-3 text-right">{b.active ? b.active_count : 0}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${b.active ? STATUS_STYLES.active : STATUS_STYLES.inactive}`}>
                      {b.active ? 'Ativo' : 'Desativado'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button type="button" disabled={busyBatchId === b.id} onClick={() => handleExport(b)} className="mr-4 font-semibold text-text-primary hover:text-accent disabled:opacity-40">
                      Baixar códigos (CSV)
                    </button>
                    <button type="button" disabled={busyBatchId === b.id} onClick={() => handleToggleBatch(b)} className="font-semibold text-accent hover:underline disabled:opacity-40">
                      {b.active ? 'Desativar' : 'Reativar'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => !generating && setIsModalOpen(false)} title="Gerar lote de tokens">
        <form onSubmit={handleGenerate} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Nome do lote
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Campanha Natal – Loja Centro"
              className="rounded-lg border border-border px-3 py-2 outline-none focus:border-text-primary"
            />
          </label>

          <fieldset className="flex flex-col gap-2 text-sm">
            <legend className="mb-1">Válido para o produto</legend>
            <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-2">
              {products.map((p) => (
                <label key={p.id} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-bg">
                  <input type="checkbox" checked={form.productIds.includes(p.id)} onChange={() => toggleProduct(p.id)} />
                  {p.name}
                </label>
              ))}
            </div>
            <p className="text-xs text-text-secondary">
              O token só é aceito se o carrinho tiver um desses produtos. Produto novo (ex: chaveiro redondo) aparece aqui depois de cadastrado e ativo.
            </p>
          </fieldset>

          <div className="grid grid-cols-3 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Quantidade
              <input type="number" min={1} max={10000} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="rounded-lg border border-border px-3 py-2 outline-none focus:border-text-primary" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Prefixo
              <input maxLength={6} value={form.prefix} onChange={(e) => setForm({ ...form, prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} className="rounded-lg border border-border px-3 py-2 font-mono uppercase outline-none focus:border-text-primary" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Caracteres
              <select value={form.length} onChange={(e) => setForm({ ...form, length: e.target.value })} className="rounded-lg border border-border px-3 py-2 outline-none focus:border-text-primary">
                {[6, 8, 10, 12].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>
          <p className="text-xs text-text-secondary">
            Formato: <span className="font-mono font-semibold text-text-primary">{sampleCode(form.prefix, form.length)}</span> — letras e números
            sem caracteres confusos (sem 0/O e 1/I). Os códigos já nascem ativos (validados) e cada um vale uma única compra.
          </p>

          {formError && <p className="text-sm text-accent">{formError}</p>}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} disabled={generating}>Cancelar</Button>
            <Button type="submit" disabled={generating}>{generating ? 'Gerando…' : 'Gerar códigos'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
