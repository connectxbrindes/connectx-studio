import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Eye, EyeOff, ImagePlus, Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  addCollectionImage, createCollection, deleteCollection, deleteCollectionImage, fetchAdminCollections, updateCollection,
} from '../../../lib/collectionsApi';
import Button from '../../../components/ui/Button';
import { fetchCategories } from '../../../lib/api';

const ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml,image/gif,.jpg,.jpeg,.jfif,.png,.webp,.svg,.gif';
const MAX_MB = 15;

/** Painel → Studio → Coleções: grupos de artes prontas que aparecem no
 * botão "Coleções" do passo Personalizar. */
export default function StudioCollectionsTab() {
  const [collections, setCollections] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [newName, setNewName] = useState('');
  const [message, setMessage] = useState('');
  const [categories, setCategories] = useState([]);

  useEffect(() => { fetchCategories().then(setCategories); }, []);

  const load = async () => {
    const list = await fetchAdminCollections();
    setCollections(list);
    setSelectedId((id) => (list.some((c) => c.id === id) ? id : list[0]?.id || null));
  };

  useEffect(() => { load(); }, []);

  if (!collections) {
    return <div className="flex h-40 items-center justify-center text-text-secondary">Carregando…</div>;
  }

  const selected = collections.find((c) => c.id === selectedId);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const { collection, error } = await createCollection(newName, collections.length);
    if (error) {
      setMessage('Não foi possível criar a coleção. Confira se seu usuário tem acesso ao Studio.');
      return;
    }
    setNewName('');
    setMessage('');
    setCollections((cs) => [...cs, collection]);
    setSelectedId(collection.id);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-secondary">
        Artes prontas que o cliente escolhe no passo <strong>Personalizar</strong> pelo botão <strong>Coleções</strong>.
        A imagem escolhida entra no produto e pode ser movida e redimensionada. Coleções ocultas ou sem imagens não aparecem no Studio.
      </p>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-panel p-4">
          <h3 className="font-bold">Coleções</h3>
          <form onSubmit={handleCreate} className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex: Dia das Mães"
              maxLength={60}
              aria-label="Nome da nova coleção"
              className="min-w-0 flex-1 rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-text-primary"
            />
            <Button type="submit" disabled={!newName.trim()} aria-label="Criar coleção"><Plus className="h-4 w-4" /></Button>
          </form>
          {message && <p className="text-xs text-red-600">{message}</p>}
          {collections.length === 0 ? (
            <p className="text-sm text-text-secondary">Nenhuma coleção ainda. Crie a primeira acima.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {collections.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm ${c.id === selectedId ? 'bg-accent/10 font-semibold text-accent' : 'hover:bg-bg'}`}
                  >
                    <span className="truncate">{c.name}</span>
                    <span className="flex flex-shrink-0 items-center gap-1.5 text-xs text-text-secondary">
                      {!c.active && <EyeOff className="h-3.5 w-3.5" aria-label="Oculta" />}
                      {c.images.length}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {selected ? (
          <CollectionEditor
            key={selected.id}
            collection={selected}
            categories={categories}
            onChange={(next) => setCollections((cs) => cs.map((c) => (c.id === next.id ? next : c)))}
            onDeleted={() => { setCollections((cs) => cs.filter((c) => c.id !== selected.id)); setSelectedId(null); }}
          />
        ) : (
          <section className="flex min-h-[240px] items-center justify-center rounded-xl border border-dashed border-border text-sm text-text-secondary">
            Crie ou escolha uma coleção para adicionar imagens.
          </section>
        )}
      </div>
    </div>
  );
}

/** Em quais categorias a coleção aparece (nenhuma marcada = todas). */
function CategoryPicker({ collection, categories, onChange }) {
  const [saving, setSaving] = useState(false);
  const selected = new Set(collection.categoryIds);
  const toggle = async (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    const categoryIds = [...next];
    setSaving(true);
    const { error } = await updateCollection(collection.id, { categoryIds });
    setSaving(false);
    if (!error) onChange({ ...collection, categoryIds });
  };
  return (
    <div className="rounded-lg border border-border bg-bg p-3">
      <p className="text-sm font-semibold">
        Aparece nas categorias {saving && <span className="font-normal text-text-secondary">· salvando…</span>}
      </p>
      <p className="mb-2 text-xs text-text-secondary">
        {selected.size === 0
          ? 'Nenhuma marcada: aparece em todas as categorias (nos produtos que permitem coleções).'
          : 'Só aparece nos produtos destas categorias.'}
      </p>
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <label
            key={c.id}
            className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${selected.has(c.id) ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-panel'}`}
          >
            <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="h-3.5 w-3.5" />
            {c.name}
          </label>
        ))}
      </div>
    </div>
  );
}

/** Link das peças de divulgação (ex: pasta no Google Drive). */
function PromoLinkField({ collection, onChange }) {
  const [url, setUrl] = useState(collection.promoUrl);
  const [status, setStatus] = useState('');
  const dirty = url.trim() !== collection.promoUrl;
  const valid = !url.trim() || /^https?:\/\/\S+\.\S+/i.test(url.trim());

  const save = async (e) => {
    e.preventDefault();
    if (!valid) return;
    setStatus('Salvando…');
    const { error } = await updateCollection(collection.id, { promoUrl: url });
    if (error) { setStatus('Não foi possível salvar.'); return; }
    onChange({ ...collection, promoUrl: url.trim() });
    setStatus('Salvo');
  };

  return (
    <form onSubmit={save} className="rounded-lg border border-border bg-bg p-3">
      <p className="text-sm font-semibold">
        Peças de divulgação {status && <span className="font-normal text-text-secondary">· {status}</span>}
      </p>
      <p className="mb-2 text-xs text-text-secondary">
        Cole o link compartilhado (Google Drive, Canva, etc.). Aparece como botão dentro da pasta da coleção no Studio. Deixe vazio para não mostrar.
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setStatus(''); }}
          placeholder="https://drive.google.com/…"
          aria-label="Link das peças de divulgação"
          className={`min-w-0 flex-1 rounded-md border px-3 py-2 text-sm outline-none focus:border-text-primary ${valid ? 'border-border' : 'border-red-400'}`}
        />
        <Button type="submit" disabled={!dirty || !valid}>Salvar link</Button>
        {collection.promoUrl && (
          <a href={collection.promoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-md px-2 text-sm font-semibold text-accent hover:underline">
            <ExternalLink className="h-4 w-4" />Abrir
          </a>
        )}
      </div>
      {!valid && <p className="mt-1 text-xs text-red-600">O link precisa começar com https://</p>}
    </form>
  );
}

function CollectionEditor({ collection, categories, onChange, onDeleted }) {
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(collection.name);
  const [uploading, setUploading] = useState(null);
  const [message, setMessage] = useState('');
  const [dragging, setDragging] = useState(false);
  // Confirmação na própria tela (caixas do navegador podem ser bloqueadas).
  const [confirmImageId, setConfirmImageId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInput = useRef(null);

  const saveName = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const { error } = await updateCollection(collection.id, { name });
    if (error) { setMessage('Não foi possível renomear.'); return; }
    onChange({ ...collection, name: name.trim() });
    setEditingName(false);
  };

  const toggleActive = async () => {
    const { error } = await updateCollection(collection.id, { active: !collection.active });
    if (error) { setMessage('Não foi possível alterar.'); return; }
    onChange({ ...collection, active: !collection.active });
  };

  const upload = async (fileList) => {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith('image/') || /\.(jfif|jpe?g|png|webp|svg|gif)$/i.test(f.name));
    const tooBig = files.filter((f) => f.size > MAX_MB * 1024 * 1024);
    const ok = files.filter((f) => f.size <= MAX_MB * 1024 * 1024);
    setMessage(tooBig.length ? `${tooBig.length} imagem(ns) acima de ${MAX_MB} MB ficaram de fora.` : '');
    let images = collection.images;
    for (let i = 0; i < ok.length; i += 1) {
      setUploading(`Enviando ${i + 1} de ${ok.length}…`);
      const { image, error } = await addCollectionImage(collection.id, ok[i], images.length);
      if (error) {
        setMessage(`Não foi possível enviar ${ok[i].name}${error.message ? `: ${error.message}` : ''}.`);
        continue;
      }
      images = [...images, image];
      onChange({ ...collection, images });
    }
    setUploading(null);
  };

  const removeImage = async (image) => {
    setConfirmImageId(null);
    const { error } = await deleteCollectionImage(image);
    if (error) { setMessage('Não foi possível remover.'); return; }
    onChange({ ...collection, images: collection.images.filter((i) => i.id !== image.id) });
  };

  const removeCollection = async () => {
    const { error } = await deleteCollection(collection);
    if (error) { setMessage('Não foi possível excluir.'); return; }
    onDeleted();
  };

  return (
    <section
      className={`relative flex flex-col gap-4 rounded-xl border bg-panel p-5 ${dragging ? 'border-accent' : 'border-border'}`}
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragging(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
      onDrop={(e) => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files); }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        {editingName ? (
          <form onSubmit={saveName} className="flex items-center gap-2">
            <input autoFocus value={name} maxLength={60} onChange={(e) => setName(e.target.value)} aria-label="Nome da coleção" className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold outline-none focus:border-text-primary" />
            <Button type="submit">Salvar</Button>
            <button type="button" onClick={() => { setName(collection.name); setEditingName(false); }} className="text-sm text-text-secondary">Cancelar</button>
          </form>
        ) : (
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold">{collection.name}</h3>
            <button type="button" onClick={() => setEditingName(true)} aria-label="Renomear coleção" title="Renomear" className="rounded p-1 text-text-secondary hover:text-accent"><Pencil className="h-4 w-4" /></button>
            {!collection.active && <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-semibold text-neutral-700">Oculta</span>}
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={toggleActive}>
            {collection.active ? <><EyeOff className="mr-1.5 inline h-4 w-4" />Ocultar</> : <><Eye className="mr-1.5 inline h-4 w-4" />Mostrar</>}
          </Button>
          {confirmDelete ? (
            <span className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              Excluir a coleção e as {collection.images.length} imagens? Não dá para desfazer.
              <button type="button" onClick={removeCollection} className="rounded-md bg-red-600 px-3 py-1 font-semibold text-white">Excluir</button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="font-semibold">Cancelar</button>
            </span>
          ) : (
            <Button variant="secondary" onClick={() => setConfirmDelete(true)} className="text-red-600">
              <Trash2 className="mr-1.5 inline h-4 w-4" />Excluir
            </Button>
          )}
        </div>
      </div>

      <CategoryPicker collection={collection} categories={categories} onChange={onChange} />
      <PromoLinkField collection={collection} onChange={onChange} />

      <input ref={fileInput} type="file" accept={ACCEPT} multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={!!uploading}
          className="flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border text-sm text-text-secondary hover:border-accent hover:text-accent disabled:opacity-60"
        >
          <ImagePlus className="h-6 w-6" />
          {uploading || 'Adicionar imagens'}
          {!uploading && <span className="px-2 text-center text-[11px]">PNG, JPG, WEBP ou SVG — ou arraste aqui</span>}
        </button>
        {collection.images.map((img) => (
          <figure key={img.id} className="group relative flex flex-col gap-1">
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-border bg-[repeating-conic-gradient(#f3f3f3_0%_25%,#fff_0%_50%)] bg-[length:16px_16px] p-2">
              <img src={img.url} alt={img.name} loading="lazy" className="max-h-full max-w-full object-contain" />
            </div>
            <figcaption className="truncate text-xs text-text-secondary" title={img.name}>{img.name || 'Sem nome'}</figcaption>
            {confirmImageId === img.id && (
              <div className="absolute inset-0 flex aspect-square flex-col items-center justify-center gap-2 rounded-lg bg-white/95 p-2 text-center text-xs ring-1 ring-red-300">
                <span className="font-semibold text-red-700">Remover esta imagem?</span>
                <span className="flex gap-2">
                  <button type="button" onClick={() => removeImage(img)} className="rounded-md bg-red-600 px-3 py-1 font-semibold text-white">Remover</button>
                  <button type="button" onClick={() => setConfirmImageId(null)} className="rounded-md px-2 py-1 font-semibold">Cancelar</button>
                </span>
              </div>
            )}
            {confirmImageId !== img.id && <button
              type="button"
              onClick={() => setConfirmImageId(img.id)}
              aria-label={`Remover ${img.name}`}
              className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-red-600 opacity-0 shadow ring-1 ring-border transition-opacity hover:bg-white focus:opacity-100 group-hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>}
          </figure>
        ))}
      </div>
      {message && <p className="text-sm text-red-600">{message}</p>}
    </section>
  );
}
