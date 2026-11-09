import { useEffect, useRef, useState } from 'react';
import { Eye, ImagePlus, Plus, Trash2 } from 'lucide-react';
import Button from '../../../components/ui/Button';
import { NewsModal } from '../../../components/layout/NewsPopup';
import {
  deleteNews, fetchAdminNews, localDay, removeNewsImage, saveNews, uploadNewsImage,
} from '../../../lib/newsApi';

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,.jpg,.jpeg,.jfif,.png,.webp,.gif';
const MAX_MB = 5;

const fmt = (d) => (d ? d.split('-').reverse().join('/') : '');

function addDays(day, n) {
  const [y, m, d] = day.split('-').map(Number);
  return localDay(new Date(y, m - 1, d + n));
}

/** Situação da novidade hoje. */
function statusOf(n) {
  const today = localDay();
  if (!n.active) return { label: 'Desativada', cls: 'bg-neutral-200 text-neutral-700' };
  if (today < n.startDate) return { label: 'Agendada', cls: 'bg-blue-100 text-blue-700' };
  if (today > n.endDate) return { label: 'Encerrada', cls: 'bg-neutral-200 text-neutral-700' };
  return { label: 'No ar', cls: 'bg-green-100 text-green-700' };
}

const blank = () => ({
  id: null,
  title: '',
  body: '',
  imageUrl: '',
  storagePath: null,
  startDate: localDay(),
  endDate: addDays(localDay(), 6),
  showCollectionLinks: false,
  active: true,
});

/** Painel → Studio → Novidades: pop-up que os revendedores veem ao entrar no Studio. */
export default function StudioNewsTab() {
  const [list, setList] = useState(null);
  const [form, setForm] = useState(null);

  const load = async (selectId) => {
    const items = await fetchAdminNews();
    setList(items);
    const pick = items.find((n) => n.id === selectId) || items[0];
    setForm(pick ? { ...pick } : blank());
  };

  useEffect(() => { load(); }, []);

  if (!list) return <div className="flex h-40 items-center justify-center text-text-secondary">Carregando…</div>;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-secondary">
        Pop-up que aparece para os <strong>revendedores</strong> ao entrar no Studio, <strong>uma vez por dia</strong>, entre a data de início e a data de fim.
        Se duas novidades estiverem no ar ao mesmo tempo, aparece a de início mais recente.
      </p>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-panel p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">Novidades</h3>
            <Button onClick={() => setForm(blank())} aria-label="Nova novidade"><Plus className="mr-1 inline h-4 w-4" />Nova</Button>
          </div>
          {list.length === 0 ? (
            <p className="text-sm text-text-secondary">Nenhuma novidade cadastrada.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {list.map((n) => {
                const st = statusOf(n);
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => setForm({ ...n })}
                      className={`flex w-full flex-col gap-1 rounded-lg px-3 py-2 text-left text-sm ${form?.id === n.id ? 'bg-accent/10' : 'hover:bg-bg'}`}
                    >
                      <span className={`truncate ${form?.id === n.id ? 'font-semibold text-accent' : ''}`}>{n.title || 'Sem título'}</span>
                      <span className="flex items-center gap-2 text-xs text-text-secondary">
                        <span className={`rounded-full px-2 py-0.5 font-semibold ${st.cls}`}>{st.label}</span>
                        {fmt(n.startDate)} a {fmt(n.endDate)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {form && (
          <NewsEditor
            key={form.id || 'new'}
            initial={form}
            onSaved={(n) => load(n.id)}
            onDeleted={() => load()}
          />
        )}
      </div>
    </div>
  );
}

function NewsEditor({ initial, onSaved, onDeleted }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInput = useRef(null);
  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setMessage(''); };

  const datesOk = form.startDate && form.endDate && form.endDate >= form.startDate;
  const canSave = datesOk && (form.title.trim() || form.imageUrl) && !saving && !uploading;

  const upload = async (file) => {
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) { setMessage(`A imagem passa de ${MAX_MB} MB.`); return; }
    setUploading(true);
    const { url, path, error } = await uploadNewsImage(file);
    setUploading(false);
    if (error) { setMessage(`Não foi possível enviar a imagem${error.message ? `: ${error.message}` : ''}.`); return; }
    // Imagem enviada nesta edição e ainda não salva: apaga ao trocar de novo.
    if (form.storagePath && form.storagePath !== initial.storagePath) removeNewsImage(form.storagePath);
    set({ imageUrl: url, storagePath: path });
  };

  const save = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    const { news, error } = await saveNews(form);
    setSaving(false);
    if (error) { setMessage('Não foi possível salvar. Confira se seu usuário tem acesso ao Studio.'); return; }
    if (initial.storagePath && initial.storagePath !== form.storagePath) removeNewsImage(initial.storagePath);
    onSaved(news);
  };

  const remove = async () => {
    const { error } = await deleteNews(initial);
    if (error) { setMessage('Não foi possível excluir.'); return; }
    onDeleted();
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-4 rounded-xl border border-border bg-panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-bold">{form.id ? 'Editar novidade' : 'Nova novidade'}</h3>
        <Button type="button" variant="secondary" onClick={() => setPreview(true)}>
          <Eye className="mr-1.5 inline h-4 w-4" />Ver prévia
        </Button>
      </div>

      <div>
        <p className="mb-1 text-sm font-semibold">Imagem de divulgação</p>
        <p className="mb-2 text-xs text-text-secondary">
          Tamanho ideal: <strong>1200 × 750 px</strong> (horizontal, 16:10). JPG ou WEBP, até {MAX_MB} MB. Deixe uns 60 px de folga nas bordas.
        </p>
        <input ref={fileInput} type="file" accept={ACCEPT} hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files?.[0]); }}
          className="group relative flex aspect-[16/10] w-full max-w-[480px] items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-border bg-bg text-sm text-text-secondary hover:border-accent hover:text-accent disabled:opacity-60"
        >
          {form.imageUrl ? (
            <>
              <img src={form.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <span className="relative rounded-lg bg-white/90 px-3 py-1.5 font-semibold text-text-primary opacity-0 shadow group-hover:opacity-100">Trocar imagem</span>
            </>
          ) : (
            <span className="flex flex-col items-center gap-2">
              <ImagePlus className="h-7 w-7" />
              {uploading ? 'Enviando…' : 'Escolher imagem — ou arraste aqui'}
            </span>
          )}
          {uploading && form.imageUrl && <span className="absolute inset-0 flex items-center justify-center bg-white/70 font-semibold">Enviando…</span>}
        </button>
        {form.imageUrl && (
          <button type="button" onClick={() => set({ imageUrl: '', storagePath: null })} className="mt-1 text-xs font-semibold text-red-600">
            Remover imagem
          </button>
        )}
      </div>

      <label className="flex flex-col gap-1 text-sm font-semibold">
        Título
        <input
          value={form.title}
          onChange={(e) => set({ title: e.target.value })}
          maxLength={80}
          placeholder="Ex: Novidade: Coleções"
          className="rounded-md border border-border px-3 py-2 font-normal outline-none focus:border-text-primary"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-semibold">
        Legenda
        <textarea
          value={form.body}
          onChange={(e) => set({ body: e.target.value })}
          rows={4}
          maxLength={600}
          placeholder="Explique a novidade e onde encontrar."
          className="rounded-md border border-border px-3 py-2 font-normal outline-none focus:border-text-primary"
        />
        <span className="text-xs font-normal text-text-secondary">Para destacar em negrito, coloque entre dois asteriscos: **assim**.</span>
      </label>

      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Exibir a partir de
          <input type="date" value={form.startDate} onChange={(e) => set({ startDate: e.target.value })} className="rounded-md border border-border px-3 py-2 font-normal outline-none focus:border-text-primary" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Exibir até (inclusive)
          <input type="date" value={form.endDate} min={form.startDate} onChange={(e) => set({ endDate: e.target.value })} className="rounded-md border border-border px-3 py-2 font-normal outline-none focus:border-text-primary" />
        </label>
      </div>
      {!datesOk && <p className="-mt-2 text-xs text-red-600">A data final precisa ser igual ou depois da data inicial.</p>}

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.showCollectionLinks} onChange={(e) => set({ showCollectionLinks: e.target.checked })} className="h-4 w-4" />
          Mostrar os links de peças para redes sociais das coleções
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.active} onChange={(e) => set({ active: e.target.checked })} className="h-4 w-4" />
          Ativa (desmarque para tirar do ar sem apagar)
        </label>
      </div>

      {message && <p className="text-sm text-red-600">{message}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        {form.id ? (
          confirmDelete ? (
            <span className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              Excluir esta novidade? Não dá para desfazer.
              <button type="button" onClick={remove} className="rounded-md bg-red-600 px-3 py-1 font-semibold text-white">Excluir</button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="font-semibold">Cancelar</button>
            </span>
          ) : (
            <Button type="button" variant="secondary" onClick={() => setConfirmDelete(true)} className="text-red-600">
              <Trash2 className="mr-1.5 inline h-4 w-4" />Excluir
            </Button>
          )
        ) : <span />}
        <Button type="submit" disabled={!canSave}>{saving ? 'Salvando…' : 'Salvar'}</Button>
      </div>

      {preview && <NewsModal news={form} onClose={() => setPreview(false)} />}
    </form>
  );
}
