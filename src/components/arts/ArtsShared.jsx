import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, CalendarDays, Check, Download, FileText, ImagePlus, Link2, Paperclip, Pencil, Send, X,
} from 'lucide-react';
import { fetchArtMessages, markArtRequestRead, sendArtMessage, updateArtRequest } from '../../lib/artsApi';

// Peças da Central de Artes usadas no Studio (unidade) e no Painel (central).

export const ART_TYPES = ['Post para feed', 'Story', 'Cartaz / banner impresso', 'Vídeo curto (Reels)', 'Outro'];
export const PURPOSES = ['Promover um produto', 'Campanha / promoção', 'Data comemorativa', 'Inauguração / evento', 'Outro'];

export const STATUS = [
  { key: 'received', label: 'Recebida', cls: 'bg-neutral-200 text-neutral-700', dot: 'bg-neutral-400' },
  { key: 'producing', label: 'Em produção', cls: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  { key: 'review', label: 'Aguardando', cls: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  { key: 'done', label: 'Concluída', cls: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
];
const statusOf = (key) => STATUS.find((s) => s.key === key) || STATUS[0];

export const formatDue = (date) => (date ? date.split('-').reverse().slice(0, 2).join('/') : 'a combinar');

export function formatWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return time;
  if (d.toDateString() === yesterday.toDateString()) return `Ontem ${time}`;
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${time}`;
}

const isImage = (url) => /\.(png|jpe?g|jfif|gif|webp|avif|svg)$/i.test(url || '');
// Formatos listados um a um: alguns seletores de arquivo (Windows) não mostram
// .jpg/.jfif quando recebem só "image/*".
export const IMAGE_ACCEPT = 'image/*,.jpg,.jpeg,.jfif,.pjpeg,.pjp,.png,.webp,.gif,.heic,.heif';
const downloadUrl = (url, name) => `${url}?download=${encodeURIComponent(name || '')}`;

export const StatusPill = ({ status }) => {
  const s = statusOf(status);
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}>{s.label}</span>;
};

/** Texto com links clicáveis. */
function RichText({ text, light }) {
  const parts = text.split(/(https?:\/\/\S+)/g);
  return parts.map((p, i) =>
    /^https?:\/\//.test(p) ? (
      <a key={i} href={p} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-0.5 break-all underline ${light ? 'text-white' : 'text-accent'}`}>
        <Link2 className="h-3 w-3 flex-shrink-0" />{p.replace(/^https?:\/\//, '')}
      </a>
    ) : <span key={i}>{p}</span>,
  );
}

/** Etapas do chamado. */
function Progress({ status }) {
  const idx = STATUS.findIndex((s) => s.key === status);
  return (
    <ol className="grid grid-cols-4 gap-1 px-4 py-2 text-[11px]">
      {STATUS.map((s, i) => (
        <li key={s.key} className="flex min-w-0 flex-col items-center gap-1 text-center">
          <span className={`h-1.5 w-full rounded-full ${i <= idx ? s.dot : 'bg-border'}`} />
          <span className={`whitespace-nowrap leading-tight ${i === idx ? 'font-bold text-text-primary' : 'text-text-secondary'}`}>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

/** Título e objetivo do chamado, editáveis pela unidade e pela central. */
function EditableHeader({ request, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: request.title, purpose: request.purpose });
  if (!editing) {
    return (
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1">
          <p className="break-words font-semibold">{request.title}</p>
          <p className="text-xs text-text-secondary">{request.artType} · {request.purpose}</p>
        </div>
        <button
          type="button"
          onClick={() => { setDraft({ title: request.title, purpose: request.purpose }); setEditing(true); }}
          aria-label="Editar título e objetivo"
          title="Editar título e objetivo"
          className="mt-0.5 rounded p-1 text-text-secondary hover:bg-bg hover:text-accent"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!draft.title.trim()) return;
        onUpdate({ title: draft.title.trim(), purpose: draft.purpose });
        setEditing(false);
      }}
      className="flex flex-col gap-1.5"
    >
      <input autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} aria-label="Título do chamado" className="rounded-md border border-border px-2 py-1 text-sm font-semibold outline-none focus:border-text-primary" />
      <div className="flex items-center gap-1.5">
        <select value={draft.purpose} onChange={(e) => setDraft({ ...draft, purpose: e.target.value })} aria-label="Objetivo" className="min-w-0 flex-1 rounded-md border border-border px-2 py-1 text-xs">
          {[...new Set([...PURPOSES, draft.purpose])].map((t) => <option key={t}>{t}</option>)}
        </select>
        <button type="submit" className="rounded-md bg-accent px-2 py-1 text-xs font-semibold text-white">Salvar</button>
        <button type="button" onClick={() => setEditing(false)} className="px-1 text-xs text-text-secondary">Cancelar</button>
      </div>
    </form>
  );
}

function Attachment({ m, own }) {
  if (!m.imageUrl) return null;
  if (isImage(m.imageUrl)) {
    return (
      <a href={m.imageUrl} target="_blank" rel="noreferrer" className="mb-2 block">
        <img src={m.imageUrl} alt={m.fileName || 'Imagem'} className="max-h-60 max-w-full rounded-lg object-contain" />
      </a>
    );
  }
  return (
    <a href={m.imageUrl} target="_blank" rel="noreferrer" className={`mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${own ? 'bg-white/20' : 'bg-bg'}`}>
      <FileText className="h-4 w-4 flex-shrink-0" /> <span className="break-all">{m.fileName || 'Arquivo'}</span>
    </a>
  );
}

/** Arquivos escolhidos aguardando envio. */
function PendingFiles({ files, onRemove }) {
  if (!files.length) return null;
  return (
    <ul className="flex flex-wrap gap-2 px-3 pt-2">
      {files.map((f, i) => (
        <li key={`${f.name}-${i}`} className="flex items-center gap-1 rounded-full bg-bg px-2 py-1 text-xs">
          <span className="max-w-[160px] truncate">{f.name}</span>
          <button type="button" onClick={() => onRemove(i)} aria-label={`Remover ${f.name}`} className="text-text-secondary hover:text-accent"><X className="h-3 w-3" /></button>
        </li>
      ))}
    </ul>
  );
}

/** Conversa de um chamado. `side` = 'unit' (Studio) ou 'team' (Painel). */
export function Thread({ client, request, side, onBack, onChanged, refreshKey, assignees = [] }) {
  const [messages, setMessages] = useState(null);
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [deliverable, setDeliverable] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);
  const imageInput = useRef(null);
  const fileInput = useRef(null);

  useEffect(() => {
    let cancelled = false;
    fetchArtMessages(client, request.id).then((m) => { if (!cancelled) setMessages(m); });
    return () => { cancelled = true; };
  }, [client, request.id, refreshKey]);

  useEffect(() => {
    const unread = side === 'team' ? request.teamUnread : request.unitUnread;
    if (unread > 0) markArtRequestRead(client, request.id).then(() => onChanged?.());
  }, [client, request.id, request.teamUnread, request.unitUnread, side]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages]);

  const update = async (patch) => {
    setError('');
    const { error: err } = await updateArtRequest(client, request.id, patch);
    if (err) setError('Não foi possível salvar a alteração.');
    onChanged?.();
  };

  const send = async (overrideText) => {
    const body = overrideText ?? text;
    if (!body.trim() && !files.length) return;
    setSending(true);
    setError('');
    const { error: err } = await sendArtMessage(client, request.id, { text: body, files: overrideText ? [] : files, deliverable });
    setSending(false);
    if (err) {
      setError(`Não foi possível enviar${err.message ? `: ${err.message}` : ''}. Tente de novo.`);
      return;
    }
    if (!overrideText) { setText(''); setFiles([]); setDeliverable(false); }
    setMessages(await fetchArtMessages(client, request.id));
    onChanged?.();
  };

  const addFiles = (list) => {
    const picked = Array.from(list || []).filter((f) => f.size <= 25 * 1024 * 1024);
    if (picked.length < (list?.length || 0)) setError('Arquivos acima de 25 MB não são aceitos.');
    setFiles((fs) => [...fs, ...picked]);
  };

  const [dragging, setDragging] = useState(false);

  return (
    <div
      className="relative flex h-full min-h-0 flex-col"
      onDragOver={(e) => { if (request.status !== 'done' && e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragging(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
      onDrop={(e) => { e.preventDefault(); setDragging(false); if (request.status !== 'done') addFiles(e.dataTransfer.files); }}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-accent bg-panel/90 text-sm font-semibold text-accent">
          Solte aqui para anexar
        </div>
      )}
      <div className="flex items-start gap-3 border-b border-border px-4 pt-3">
        {onBack && (
          <button type="button" onClick={onBack} aria-label="Voltar" className="mt-0.5 text-text-secondary hover:text-text-primary">
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <div className="min-w-0 flex-1 pb-2">
          <p className="text-[11px] font-semibold text-text-secondary">Chamado #{request.number}{side === 'team' ? ` · ${request.unit}` : ''}</p>
          <EditableHeader key={request.id} request={request} onUpdate={update} />
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-text-secondary">
            {side === 'team' ? (
              <label className="inline-flex items-center gap-1">
                <CalendarDays className="h-3 w-3" /> até
                <input type="date" value={request.dueDate || ''} onChange={(e) => update({ dueDate: e.target.value })} className="rounded border border-border px-1 text-xs" aria-label="Prazo" />
              </label>
            ) : (
              <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" /> até {formatDue(request.dueDate)}</span>
            )}
            {side === 'unit' && <span>Responsável: {request.assignee || 'a definir'}</span>}
          </p>
        </div>
        {side === 'team' && (
          <div className="flex flex-col items-end gap-1 pb-2">
            <select value={request.status} onChange={(e) => update({ status: e.target.value })} className="rounded-md border border-border px-2 py-1 text-xs" aria-label="Status">
              {STATUS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <input
              list="arts-assignees"
              defaultValue={request.assignee || ''}
              key={`${request.id}-${request.assignee}`}
              onBlur={(e) => { if ((e.target.value.trim() || null) !== (request.assignee || null)) update({ assignee: e.target.value.trim() }); }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              placeholder="Responsável…"
              aria-label="Responsável"
              className="w-32 rounded-md border border-border px-2 py-1 text-xs"
            />
            <datalist id="arts-assignees">{assignees.map((a) => <option key={a} value={a} />)}</datalist>
          </div>
        )}
      </div>
      <Progress status={request.status} />

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-bg px-4 py-4">
        {messages === null && <p className="text-center text-xs text-text-secondary">Carregando…</p>}
        {messages?.map((m) => {
          if (m.from === 'system') {
            return (
              <p key={m.id} className="self-center rounded-full bg-panel px-3 py-1 text-[11px] text-text-secondary ring-1 ring-border">
                {m.text} · {formatWhen(m.createdAt)}
              </p>
            );
          }
          const own = m.from === side;
          return (
            <div key={m.id} className={`flex max-w-[88%] flex-col gap-1 ${own ? 'items-end self-end' : 'items-start self-start'}`}>
              <span className="text-[11px] text-text-secondary">{m.author} · {formatWhen(m.createdAt)}</span>
              <div className={`rounded-2xl px-3 py-2 text-sm ${own ? 'rounded-br-sm bg-accent text-white' : 'rounded-bl-sm bg-panel ring-1 ring-border'}`}>
                {m.deliverable && (
                  <span className={`mb-1 block text-[11px] font-bold uppercase tracking-wide ${own ? 'text-white/80' : 'text-accent'}`}>Arte para aprovação</span>
                )}
                <Attachment m={m} own={own} />
                {m.text && <p className="whitespace-pre-wrap break-words"><RichText text={m.text} light={own} /></p>}
                {m.imageUrl && (
                  <a href={downloadUrl(m.imageUrl, m.fileName)} className={`mt-2 flex items-center gap-1 text-xs font-semibold ${own ? 'text-white' : 'text-accent'}`}>
                    <Download className="h-3.5 w-3.5" /> Baixar
                  </a>
                )}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {side === 'unit' && request.status === 'review' && (
        <div className="flex gap-2 border-t border-border bg-amber-50 px-4 py-2">
          <button type="button" onClick={async () => { await send('Arte aprovada! ✅'); await update({ status: 'done' }); }} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-green-600 py-2 text-xs font-semibold text-white">
            <Check className="h-4 w-4" /> Aprovar arte
          </button>
          <button type="button" onClick={() => update({ status: 'producing' })} className="flex-1 rounded-lg border border-border bg-panel py-2 text-xs font-semibold">
            Pedir ajuste
          </button>
        </div>
      )}

      {request.status === 'done' ? (
        <div className="flex flex-col items-center gap-1 border-t border-border bg-green-50 px-4 py-3 text-center text-xs text-green-800">
          <p className="font-semibold">Chamado concluído — conversa encerrada.</p>
          {side === 'team'
            ? <p>Para voltar a conversar, mude o status do chamado.</p>
            : <p>Precisa de outra arte? Abra um novo chamado.</p>}
        </div>
      ) : (
        <>
        {error && <p className="border-t border-border bg-red-50 px-4 py-1.5 text-xs text-red-600">{error}</p>}
        <PendingFiles files={files} onRemove={(i) => setFiles((fs) => fs.filter((_, idx) => idx !== i))} />
        {side === 'team' && files.length > 0 && (
          <label className="flex items-center gap-2 px-3 pt-2 text-xs">
            <input type="checkbox" checked={deliverable} onChange={(e) => setDeliverable(e.target.checked)} />
            É a arte para a unidade aprovar (muda o status para “Aguardando”)
          </label>
        )}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const markReview = side === 'team' && deliverable && files.length > 0 && request.status !== 'review';
            await send();
            if (markReview) update({ status: 'review' });
          }}
          className="flex items-center gap-2 border-t border-border px-3 py-3"
        >
          <input ref={imageInput} type="file" accept={IMAGE_ACCEPT} multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          <input ref={fileInput} type="file" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          <button type="button" onClick={() => imageInput.current?.click()} aria-label="Anexar imagem" title="Anexar imagem" className="text-text-secondary hover:text-accent"><ImagePlus className="h-5 w-5" /></button>
          <button type="button" onClick={() => fileInput.current?.click()} aria-label="Anexar arquivo" title="Anexar arquivo (PDF, vídeo…)" className="text-text-secondary hover:text-accent"><Paperclip className="h-5 w-5" /></button>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={(e) => { if (e.clipboardData.files.length) { e.preventDefault(); addFiles(e.clipboardData.files); } }}
            placeholder="Mensagem, link ou observação…"
            className="min-w-0 flex-1 rounded-full border border-border px-4 py-2 text-sm outline-none focus:border-text-primary"
          />
          <button type="submit" disabled={sending} aria-label="Enviar" className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent text-white disabled:opacity-50">
            {sending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
        </>
      )}
    </div>
  );
}

/** Formulário de abertura de chamado (Studio). */
export function NewRequestForm({ onCancel, onSubmit }) {
  const [form, setForm] = useState({ artType: ART_TYPES[0], purpose: PURPOSES[0], title: '', dueDate: '', text: '' });
  const [files, setFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const fileInput = useRef(null);
  const field = 'rounded-lg border border-border px-3 py-2 outline-none focus:border-text-primary';
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!form.title.trim() || !form.text.trim()) {
          setError('Preencha o título e o que precisa.');
          return;
        }
        setSending(true);
        const err = await onSubmit({ ...form, files });
        setSending(false);
        if (err) setError(`Não foi possível abrir o chamado${err.message ? `: ${err.message}` : ''}. Tente de novo.`);
      }}
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); }}
      onDrop={(e) => { e.preventDefault(); setFiles((fs) => [...fs, ...Array.from(e.dataTransfer.files || [])]); }}
      className="flex h-full flex-col gap-3 overflow-y-auto p-4 text-sm"
    >
      <div className="flex items-center gap-2">
        <button type="button" onClick={onCancel} aria-label="Voltar" className="text-text-secondary"><ArrowLeft className="h-5 w-5" /></button>
        <p className="font-semibold">Abrir chamado de arte</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">Tipo de arte
          <select value={form.artType} onChange={(e) => setForm({ ...form, artType: e.target.value })} className={field}>
            {ART_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">Objetivo
          <select value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} className={field}>
            {PURPOSES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1">Título
        <input value={form.title} maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Story promoção de canecas" className={field} />
      </label>
      <label className="flex flex-col gap-1">Prazo desejado
        <input type="date" min={today} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className={field} />
      </label>
      <label className="flex flex-col gap-1">O que precisa
        <textarea rows={5} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} placeholder="Produto, preço, texto da arte, cores, links de referência…" className={field} />
      </label>
      <input ref={fileInput} type="file" accept={`${IMAGE_ACCEPT},application/pdf,.pdf`} multiple hidden onChange={(e) => { setFiles((fs) => [...fs, ...Array.from(e.target.files || [])]); e.target.value = ''; }} />
      <button type="button" onClick={() => fileInput.current?.click()} className="flex items-center gap-2 self-start text-xs font-semibold text-accent">
        <ImagePlus className="h-4 w-4" /> Anexar imagens de referência (JPG, PNG, PDF — ou arraste aqui)
      </button>
      {files.length > 0 && (
        <ul className="-mt-1 flex flex-wrap gap-2">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-1 rounded-full bg-bg px-2 py-1 text-xs">
              <span className="max-w-[160px] truncate">{f.name}</span>
              <button type="button" onClick={() => setFiles((fs) => fs.filter((_, idx) => idx !== i))} aria-label={`Remover ${f.name}`}><X className="h-3 w-3" /></button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button type="submit" disabled={sending} className="mt-auto rounded-lg bg-accent py-2.5 font-semibold text-white disabled:opacity-60">
        {sending ? 'Enviando…' : 'Abrir chamado'}
      </button>
    </form>
  );
}
