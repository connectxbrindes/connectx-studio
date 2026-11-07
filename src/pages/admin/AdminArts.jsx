import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { supabaseAdmin } from '../../lib/supabaseClient';
import { fetchArtRequests, subscribeArtChanges } from '../../lib/artsApi';
import { formatDue, STATUS, Thread } from '../../components/arts/ArtsShared';

/** Painel → Central de Artes: chamados das unidades em quadro de tarefas,
 * com conversa, status, responsável e avisos de novidades. */
export default function AdminArts() {
  const [requests, setRequests] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [unitFilter, setUnitFilter] = useState('');
  const [showDone, setShowDone] = useState(true);
  const [bellOpen, setBellOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const known = useRef(null);

  const load = useCallback(async () => {
    const list = await fetchArtRequests(supabaseAdmin);
    // Aviso na tela quando chega chamado novo ou mensagem nova de unidade.
    if (known.current) {
      const fresh = list.find((r) => !known.current.has(r.id));
      const bumped = list.find((r) => known.current.has(r.id) && r.teamUnread > known.current.get(r.id));
      if (fresh) showToast(`Novo chamado #${fresh.number} da ${fresh.unit}`);
      else if (bumped) showToast(`Novidade da ${bumped.unit} no chamado #${bumped.number}`);
    }
    known.current = new Map(list.map((r) => [r.id, r.teamUnread]));
    setRequests(list);
  }, []);

  const toastTimer = useRef(null);
  const showToast = (text) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    load();
    const unsubscribe = subscribeArtChanges(supabaseAdmin, 'panel', () => { load(); setRefreshKey((k) => k + 1); });
    const timer = setInterval(load, 60000);
    return () => { unsubscribe(); clearInterval(timer); clearTimeout(toastTimer.current); };
  }, [load]);

  const units = useMemo(() => [...new Set((requests || []).map((r) => r.unit))].sort(), [requests]);
  const assignees = useMemo(() => [...new Set((requests || []).map((r) => r.assignee).filter(Boolean))].sort(), [requests]);

  if (!requests) {
    return <div className="flex h-64 items-center justify-center text-text-secondary">Carregando…</div>;
  }

  const visible = requests.filter((r) => !unitFilter || r.unit === unitFilter);
  const unread = requests.filter((r) => r.teamUnread > 0);
  const selected = requests.find((r) => r.id === selectedId);
  const columns = showDone ? STATUS : STATUS.filter((s) => s.key !== 'done');
  const byDue = (a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Central de Artes</h2>
          <p className="text-sm text-text-secondary">
            Chamados das unidades pedindo artes de divulgação · {requests.filter((r) => r.status !== 'done').length} em aberto
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)} aria-label="Filtrar por unidade" className="rounded-lg border border-border bg-panel px-3 py-2 text-sm">
            <option value="">Todas as unidades</option>
            {units.map((u) => <option key={u}>{u}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Mostrar concluídas
          </label>
          <div className="relative">
            <button type="button" onClick={() => setBellOpen((o) => !o)} aria-label={`Notificações, ${unread.length} chamados com novidade`} className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-panel">
              <Bell className="h-5 w-5" />
              {unread.length > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-white">{unread.length}</span>}
            </button>
            {bellOpen && (
              <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg bg-panel py-1 shadow-xl ring-1 ring-border">
                {unread.length === 0 && <p className="px-4 py-3 text-sm text-text-secondary">Nada novo.</p>}
                {unread.map((r) => (
                  <button key={r.id} type="button" onClick={() => { setSelectedId(r.id); setBellOpen(false); }} className="block w-full px-4 py-2 text-left text-sm hover:bg-bg">
                    <span className="font-semibold">{r.unit}</span> · #{r.number} {r.title}
                    {r.lastMessage && <span className="block truncate text-xs text-text-secondary">{r.lastMessage}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-panel">
        <div className="grid min-w-0 flex-1 auto-cols-[minmax(190px,1fr)] grid-flow-col gap-3 overflow-x-auto bg-bg p-3">
          {columns.map((s) => {
            const items = visible.filter((r) => r.status === s.key).sort(byDue);
            return (
              <div key={s.key} className="flex min-h-0 flex-col gap-2">
                <p className="flex items-center gap-1.5 px-1 text-xs font-bold">
                  <span className={`h-2 w-2 rounded-full ${s.dot}`} /> {s.label}
                  <span className="font-normal text-text-secondary">{items.length}</span>
                </p>
                <div className="flex min-h-0 flex-col gap-2 overflow-y-auto pb-2">
                  {items.map((r) => {
                    const late = r.status !== 'done' && r.dueDate && r.dueDate < today;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setSelectedId(r.id)}
                        className={`flex flex-col gap-1 rounded-lg bg-panel p-2.5 text-left text-xs ring-1 ${selectedId === r.id ? 'ring-2 ring-accent' : 'ring-border'}`}
                      >
                        <span className="flex items-start gap-1 font-semibold">
                          {r.teamUnread > 0 && <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-accent" aria-label="Novidade" />}
                          <span>#{r.number} {r.title}</span>
                        </span>
                        <span className="text-text-secondary">{r.unit}</span>
                        <span className="flex items-center justify-between gap-2 text-text-secondary">
                          <span>{r.artType}</span>
                          <span className={late ? 'font-semibold text-red-600' : ''}>até {formatDue(r.dueDate)}</span>
                        </span>
                        <span className="text-text-secondary">{r.assignee ? `👤 ${r.assignee}` : 'Sem responsável'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex w-[400px] flex-shrink-0 flex-col border-l border-border">
          {selected ? (
            <Thread
              key={selected.id}
              client={supabaseAdmin}
              request={selected}
              side="team"
              refreshKey={refreshKey}
              assignees={assignees}
              onBack={() => setSelectedId(null)}
              onChanged={load}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center px-8 text-center text-sm text-text-secondary">
              {requests.length === 0 ? 'Nenhum chamado ainda. Quando uma unidade abrir um pelo Studio, ele aparece aqui.' : 'Escolha um chamado para ver a conversa.'}
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div role="status" className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg bg-text-primary px-4 py-3 text-sm text-white shadow-xl">
          <Bell className="h-4 w-4" /> {toast}
        </div>
      )}
    </div>
  );
}
