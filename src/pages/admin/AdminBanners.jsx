import { useEffect, useRef, useState } from 'react';
import { fetchAdminProducts } from '../../lib/api';
import { deleteBanner, fetchAdminBanners, reorderBanners, saveBanner, uploadBannerImage } from '../../lib/storeApi';
import BannerSlide, { BANNER_THEMES, bannerToSlide } from '../../components/store/BannerSlide';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';

const inputClass = 'w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-text-primary';

const EMPTY = {
  layout: 'image',
  title: '',
  eyebrow: '',
  text: '',
  cta_label: '',
  link: '',
  image_url: '',
  mobile_image_url: '',
  theme: 'coral',
  active: true,
  starts_at: '',
  ends_at: '',
};

// <input type="datetime-local"> trabalha com horário local sem fuso.
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);
const fmt = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '');

function bannerStatus(b) {
  const now = Date.now();
  if (!b.active) return ['Desativado', 'bg-neutral-200 text-neutral-700'];
  if (b.starts_at && new Date(b.starts_at).getTime() > now) return ['Agendado', 'bg-amber-100 text-amber-700'];
  if (b.ends_at && new Date(b.ends_at).getTime() <= now) return ['Encerrado', 'bg-neutral-200 text-neutral-700'];
  return ['No ar', 'bg-green-100 text-green-700'];
}

function UploadField({ label, hint, value, onChange }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const handle = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    const { url, error: err } = await uploadBannerImage(file);
    setBusy(false);
    if (err) return setError('Falha no envio da imagem.');
    onChange(url);
  };
  return (
    <div className="flex flex-col gap-1 text-sm">
      <span>{label}</span>
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-28 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-bg">
          {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <span className="text-xs text-text-secondary">Sem imagem</span>}
        </div>
        <div className="flex flex-col gap-1">
          <button type="button" onClick={() => ref.current.click()} disabled={busy} className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium hover:border-text-primary disabled:opacity-50">
            {busy ? 'Enviando…' : value ? 'Trocar imagem' : 'Enviar imagem'}
          </button>
          {value && (
            <button type="button" onClick={() => onChange('')} className="text-left text-xs text-accent hover:underline">
              Remover
            </button>
          )}
        </div>
        <input ref={ref} type="file" accept="image/*" onChange={handle} className="hidden" aria-hidden="true" />
      </div>
      {hint && <p className="text-xs text-text-secondary">{hint}</p>}
      {error && <p className="text-xs text-accent">{error}</p>}
    </div>
  );
}

export default function AdminBanners() {
  const [banners, setBanners] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setLoading(true);
    const [b, p] = await Promise.all([fetchAdminBanners(), fetchAdminProducts()]);
    setBanners(b);
    setProducts((p || []).filter((x) => x.status === 'active'));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // Sugestões de link: páginas da loja.
  const categories = [...new Map(products.filter((p) => p.category).map((p) => [p.category.id, p.category])).values()];
  const linkOptions = [
    ['/store', 'Início da loja'],
    ['#produtos', 'Lista de produtos (na própria página)'],
    ['/store/campanha', 'Resgatar brinde (campanha)'],
    ...categories.map((c) => [c.slug ? `/store/c/${c.slug}` : `/store/busca?q=${encodeURIComponent(c.name)}`, `Categoria: ${c.name}`]),
    ...products.map((p) => [`/store/p/${p.slug}`, `Produto: ${p.name.trim()}`]),
  ];

  const openNew = () => {
    setEditingId(null);
    setForm(EMPTY);
    setError('');
    setIsOpen(true);
  };

  const openEdit = (b) => {
    setEditingId(b.id);
    setForm({
      ...EMPTY,
      ...Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v ?? ''])),
      active: b.active,
      starts_at: toLocalInput(b.starts_at),
      ends_at: toLocalInput(b.ends_at),
    });
    setError('');
    setIsOpen(true);
  };

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    if (form.layout === 'image' && !form.image_url) return setError('Envie a imagem do banner.');
    if (form.layout === 'product' && !form.title.trim()) return setError('Escreva o título do banner.');
    if (form.starts_at && form.ends_at && new Date(form.ends_at) <= new Date(form.starts_at)) {
      return setError('O fim precisa ser depois do início.');
    }
    setSaving(true);
    const payload = {
      layout: form.layout,
      title: form.title.trim() || null,
      eyebrow: form.eyebrow.trim() || null,
      text: form.text.trim() || null,
      cta_label: form.cta_label.trim() || null,
      link: form.link.trim() || null,
      image_url: form.image_url || null,
      mobile_image_url: form.layout === 'image' ? form.mobile_image_url || null : null,
      theme: form.theme,
      active: Boolean(form.active),
      starts_at: fromLocalInput(form.starts_at),
      ends_at: fromLocalInput(form.ends_at),
      ...(editingId ? {} : { sort_order: banners.length }),
    };
    const { error: err } = await saveBanner(editingId, payload);
    setSaving(false);
    if (err) return setError('Não foi possível salvar o banner.');
    setIsOpen(false);
    load();
  };

  const toggleActive = async (b) => {
    setBusyId(b.id);
    await saveBanner(b.id, { active: !b.active });
    setBusyId(null);
    load();
  };

  const remove = async (b) => {
    if (!window.confirm('Excluir este banner? Esta ação não pode ser desfeita.')) return;
    setBusyId(b.id);
    await deleteBanner(b.id);
    setBusyId(null);
    load();
  };

  const move = async (index, delta) => {
    const next = [...banners];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setBanners(next);
    await reorderBanners(next.map((b) => b.id));
  };

  const previewSlide = bannerToSlide({ ...form, id: 'preview' });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Banners da loja</h2>
          <p className="text-sm text-text-secondary">
            Destaques rotativos do topo da vitrine (/store), na ordem abaixo. Sem nenhum banner no ar, a loja mostra destaques automáticos dos produtos.
          </p>
        </div>
        <Button onClick={openNew}>+ Novo banner</Button>
      </div>

      {loading ? (
        <p className="py-10 text-center text-text-secondary">Carregando…</p>
      ) : banners.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-panel p-10 text-center text-text-secondary">
          Nenhum banner cadastrado ainda.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {banners.map((b, i) => {
            const [label, style] = bannerStatus(b);
            return (
              <li key={b.id} className="flex flex-col gap-4 rounded-xl border border-border bg-panel p-4 sm:flex-row sm:items-center">
                <div className="flex flex-col gap-1">
                  <button type="button" aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)} className="rounded border border-border px-2 text-sm disabled:opacity-30">▲</button>
                  <button type="button" aria-label="Descer" disabled={i === banners.length - 1} onClick={() => move(i, 1)} className="rounded border border-border px-2 text-sm disabled:opacity-30">▼</button>
                </div>
                <div className="w-full overflow-hidden rounded-lg sm:w-72">
                  <div className="pointer-events-none origin-top-left scale-[0.38]" style={{ width: '263%' }}>
                    <BannerSlide slide={bannerToSlide(b)} active={false} />
                  </div>
                </div>
                <div className="flex-1 text-sm">
                  <div className="mb-1 flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${style}`}>{label}</span>
                    <span className="text-xs text-text-secondary">{b.layout === 'image' ? 'Banner pronto (imagem)' : 'Texto + foto'}</span>
                  </div>
                  <p className="font-semibold">{b.title || '(sem título)'}</p>
                  {b.link && <p className="truncate text-xs text-text-secondary">Link: {b.link}</p>}
                  {(b.starts_at || b.ends_at) && (
                    <p className="text-xs text-text-secondary">
                      {b.starts_at ? `De ${fmt(b.starts_at)} ` : ''}{b.ends_at ? `até ${fmt(b.ends_at)}` : ''}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-3 text-sm font-semibold">
                  <button type="button" onClick={() => openEdit(b)} className="hover:text-accent">Editar</button>
                  <button type="button" disabled={busyId === b.id} onClick={() => toggleActive(b)} className="text-accent hover:underline disabled:opacity-40">
                    {b.active ? 'Desativar' : 'Ativar'}
                  </button>
                  <button type="button" disabled={busyId === b.id} onClick={() => remove(b)} className="text-red-500 hover:underline disabled:opacity-40">Excluir</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal isOpen={isOpen} onClose={() => !saving && setIsOpen(false)} title={editingId ? 'Editar banner' : 'Novo banner'} maxWidthClass="max-w-4xl">
        <form onSubmit={handleSave} className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-bg p-1 text-sm font-semibold">
            {[
              ['image', 'Banner pronto (imagem)'],
              ['product', 'Texto + foto do produto'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setForm({ ...form, layout: value })}
                className={`rounded-md py-2 ${form.layout === value ? 'bg-panel shadow-sm' : 'text-text-secondary'}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">Prévia</p>
            <div className="overflow-hidden rounded-2xl border border-border">
              {form.layout === 'image' && !form.image_url ? (
                <div className="flex aspect-[3/1] items-center justify-center bg-bg text-sm text-text-secondary">Envie a imagem para ver a prévia</div>
              ) : (
                <div className="pointer-events-none">
                  <BannerSlide slide={previewSlide} active={false} />
                </div>
              )}
            </div>
          </div>

          {form.layout === 'image' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <UploadField
                label="Imagem para computador *"
                hint="Proporção 3:1 — recomendado 1800 × 600 px."
                value={form.image_url}
                onChange={(url) => setForm((f) => ({ ...f, image_url: url }))}
              />
              <UploadField
                label="Imagem para celular (opcional)"
                hint="Quadrada — recomendado 1000 × 1000 px. Sem ela, o celular usa a de computador."
                value={form.mobile_image_url}
                onChange={(url) => setForm((f) => ({ ...f, mobile_image_url: url }))}
              />
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                Descrição curta (para acessibilidade)
                <input value={form.title} onChange={set('title')} placeholder="Ex: Black Friday — 20% em garrafas" className={inputClass} />
              </label>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                Chamada pequena (acima do título)
                <input value={form.eyebrow} onChange={set('eyebrow')} placeholder="Ex: Oferta da semana" className={inputClass} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Cor do fundo
                <select value={form.theme} onChange={set('theme')} className={inputClass}>
                  {Object.entries(BANNER_THEMES).map(([value, t]) => (
                    <option key={value} value={value}>{t.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                Título *
                <input value={form.title} onChange={set('title')} placeholder="Ex: Copo térmico com a sua foto" className={inputClass} />
              </label>
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                Texto
                <textarea rows={2} value={form.text} onChange={set('text')} placeholder="Uma frase curta de apoio" className={`${inputClass} resize-none`} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Texto do botão
                <input value={form.cta_label} onChange={set('cta_label')} placeholder="Ex: Personalizar agora" className={inputClass} />
              </label>
              <UploadField
                label="Foto do produto"
                hint="Aparece dentro de um círculo branco. Fundo branco ou transparente."
                value={form.image_url}
                onChange={(url) => setForm((f) => ({ ...f, image_url: url }))}
              />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              Ao clicar, abrir
              <select
                value={linkOptions.some(([v]) => v === form.link) ? form.link : form.link ? '__custom' : ''}
                onChange={(e) => e.target.value !== '__custom' && setForm({ ...form, link: e.target.value })}
                className={inputClass}
              >
                <option value="">Nada (banner sem link)</option>
                {linkOptions.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
                <option value="__custom">Outro endereço (digitar abaixo)</option>
              </select>
              <input value={form.link} onChange={set('link')} placeholder="/store/p/... ou https://..." className={`${inputClass} mt-1`} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                Início (opcional)
                <input type="datetime-local" value={form.starts_at} onChange={set('starts_at')} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Fim (opcional)
                <input type="datetime-local" value={form.ends_at} onChange={set('ends_at')} className={inputClass} />
              </label>
              <p className="col-span-2 -mt-2 text-xs text-text-secondary">Com datas, o banner entra e sai do ar sozinho.</p>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={Boolean(form.active)} onChange={set('active')} />
            Banner ativo
          </label>

          {error && <p className="text-sm text-accent">{error}</p>}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar banner'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
