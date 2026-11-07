import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, MessageSquare, Plus, X } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { createArtRequest, fetchArtRequests, subscribeArtChanges } from '../../lib/artsApi';
import { formatDue, NewRequestForm, StatusPill, Thread } from './ArtsShared';

/** Central de Artes no Studio: botão no topo + painel lateral.
 * - Unidade (side="unit"): abre chamados e conversa com a central; só vê os seus.
 * - Master (side="team"): vê e responde os chamados de todas as unidades, sem
 *   precisar entrar no Painel (que tem login separado). */
export default function ArtsCenterButton({ unitName, side = 'unit' }) {
  const isTeam = side === 'team';
  const unreadOf = (r) => (isTeam ? r.teamUnread : r.unitUnread) || 0;
  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState([]);
  const [view, setView] = useState({ mode: 'list', id: null });
  const [refreshKey, setRefreshKey] = useState(0);

  const [notice, setNotice] = useState(null);
  const known = useRef(null);

  // Aviso: fica na tela até a pessoa abrir um chamado ou fechar. Lista cada
  // chamado com novidade (o mais recente primeiro) para abrir o certo.
  // `notice` = id do chamado da última novidade (ou true quando são várias).
  // Se o Studio estiver em outra aba, vai também uma notificação do computador.
  const notify = (r, text) => {
    setNotice(r ? r.id : true);
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
      try {
        const desk = new Notification('Central de Artes', { body: text, icon: '/logo-connectx-icon.svg', tag: `central-de-artes-${r?.id || 'varios'}` });
        desk.onclick = () => { window.focus(); desk.close(); };
      } catch { /* navegador sem suporte */ }
    }
  };
  const askDesktopPermission = () => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
  };

  const load = useCallback(async () => {
    const list = await fetchArtRequests(supabase);
    if (known.current === null) {
      const pending = list.filter((r) => unreadOf(r) > 0);
      if (pending.length) notify(pending.length === 1 ? pending[0] : null, `Novidades em ${pending.length} chamado(s)`);
    } else {
      const fresh = isTeam && list.find((r) => !known.current.has(r.id));
      const bumped = list.find((r) => known.current.has(r.id) && unreadOf(r) > known.current.get(r.id));
      const r = fresh || bumped;
      if (r) notify(r, fresh ? `Novo chamado #${r.number} da ${r.unit} — ${r.title}` : `Chamado #${r.number} — ${r.title}: ${r.lastMessage || 'nova atualização'}`);
    }
    known.current = new Map(list.map((r) => [r.id, unreadOf(r)]));
    setRequests(list);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
    const unsubscribe = subscribeArtChanges(supabase, 'studio', () => { load(); setRefreshKey((k) => k + 1); });
    // Verificação de reserva caso a conexão ao vivo caia; e ao voltar para a aba.
    const timer = setInterval(load, 20000);
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { unsubscribe(); clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [load]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const unread = requests.reduce((n, r) => n + unreadOf(r), 0);

  // Número de novidades no título da aba do navegador.
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\) /, '');
    document.title = unread > 0 ? `(${unread}) ${base}` : base;
    return () => { document.title = document.title.replace(/^\(\d+\) /, ''); };
  }, [unread]);
  const current = requests.find((r) => r.id === view.id);
  const pending = requests
    .filter((r) => unreadOf(r) > 0)
    .sort((a, b) => (a.id === notice ? -1 : b.id === notice ? 1 : 0));
  // Na lista, chamados com novidade vêm primeiro.
  const sorted = [...requests].sort((a, b) => (unreadOf(b) > 0) - (unreadOf(a) > 0));
  const openRequest = (id) => { setView({ mode: 'thread', id }); setNotice(null); setOpen(true); askDesktopPermission(); };

  return (
    <>
      <button
        type="button"
        onClick={() => { setNotice(null); setOpen(true); askDesktopPermission(); }}
        aria-label={`Central de Artes${unread ? `, ${unread} novas` : ''}`}
        title={isTeam ? 'Central de Artes — chamados das unidades' : 'Central de Artes — peça artes de divulgação'}
        className={`relative flex h-11 items-center gap-2 rounded-full border px-3 text-sm font-semibold transition-colors sm:px-4 ${unread > 0 ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-primary hover:border-text-primary'}`}
      >
        <MessageSquare className="h-5 w-5" strokeWidth={1.8} />
        <span className="hidden sm:inline">Central de Artes</span>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-white">
            <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-60 motion-reduce:hidden" aria-hidden="true" />
            <span className="relative">{unread}</span>
          </span>
        )}
      </button>

      {notice && !open && pending.length > 0 && createPortal(
        <div role="status" className="fixed right-4 top-24 z-40 w-[calc(100%-2rem)] max-w-sm rounded-xl bg-text-primary p-4 text-sm text-white shadow-2xl">
          <div className="mb-2 flex items-center gap-2">
            <Bell className="h-5 w-5 flex-shrink-0 text-accent" aria-hidden="true" />
            <p className="flex-1 font-semibold">
              {pending.length === 1 ? 'Novidade na Central de Artes' : `Novidades em ${pending.length} chamados`}
            </p>
            <button type="button" onClick={() => setNotice(null)} aria-label="Fechar aviso" className="text-white/70 hover:text-white"><X className="h-4 w-4" /></button>
          </div>
          <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
            {pending.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => openRequest(r.id)}
                  className={`flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/15 ${r.id === notice ? 'bg-white/10 ring-1 ring-accent' : 'bg-white/5'}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">#{r.number} {r.title}</span>
                    <span className="block truncate text-xs text-white/70">
                      {isTeam ? `${r.unit}: ` : r.status === 'review' ? 'Arte para aprovar: ' : 'Central: '}{r.lastMessage || 'nova atualização'}
                    </span>
                  </span>
                  <span className="flex flex-shrink-0 flex-col items-end gap-1">
                    <span className="rounded-full bg-accent px-1.5 text-[11px] font-bold">{unreadOf(r)}</span>
                    <span className="text-xs font-semibold text-accent">Abrir</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>,
        document.body,
      )}

      {open && createPortal(
        <div className="fixed inset-0 z-50 flex justify-end">
          <button type="button" aria-label="Fechar Central de Artes" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/30" />
          <aside role="dialog" aria-label="Central de Artes" className="relative flex h-full w-full max-w-[440px] flex-col bg-panel shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <p className="font-bold">Central de Artes</p>
                <p className="text-[11px] text-text-secondary">
                  {isTeam ? 'Chamados de todas as unidades' : `${unitName ? `${unitName} · ` : ''}você vê apenas os chamados da sua unidade`}
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar"><X className="h-5 w-5" /></button>
            </div>
            <div className="min-h-0 flex-1">
              {view.mode === 'list' && (
                <div className="flex h-full flex-col">
                  {!isTeam && <div className="border-b border-border p-3">
                    <button type="button" onClick={() => setView({ mode: 'new' })} className="flex w-full items-center justify-center gap-2 rounded-lg bg-text-primary py-2.5 text-sm font-semibold text-white">
                      <Plus className="h-4 w-4" /> Abrir chamado de arte
                    </button>
                  </div>}
                  {requests.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center text-sm text-text-secondary">
                      <MessageSquare className="h-8 w-8" strokeWidth={1.5} />
                      <p>{isTeam ? 'Nenhum chamado ainda. Quando uma unidade pedir uma arte pelo Studio, ele aparece aqui.' : <>Precisa de um post, story ou cartaz para divulgar um produto ou campanha? Abra um chamado e a central cria a arte para sua unidade.</>}</p>
                    </div>
                  ) : (
                    <ul className="flex-1 overflow-y-auto">
                      {sorted.map((r) => {
                        const n = unreadOf(r);
                        return (
                          <li key={r.id}>
                            <button
                              type="button"
                              onClick={() => setView({ mode: 'thread', id: r.id })}
                              className={`flex w-full flex-col gap-1 border-b border-l-4 border-b-border px-4 py-3 text-left hover:bg-bg ${n > 0 ? 'border-l-accent bg-accent/5' : 'border-l-transparent'}`}
                            >
                              <span className="flex items-center gap-2">
                                <span className="flex-1 truncate text-sm font-semibold">#{r.number} {r.title}</span>
                                {n > 0 && (
                                  <span className="whitespace-nowrap rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-white">
                                    {n} {n === 1 ? 'nova' : 'novas'}
                                  </span>
                                )}
                                <StatusPill status={r.status} />
                              </span>
                              <span className="text-xs text-text-secondary">{isTeam ? `${r.unit} · ` : ''}{r.artType} · até {formatDue(r.dueDate)}{isTeam ? ` · ${r.assignee || 'sem responsável'}` : ''}</span>
                              {r.lastMessage && <span className={`truncate text-xs ${n > 0 ? 'font-semibold text-text-primary' : 'text-text-secondary'}`}>{r.lastMessage}</span>}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
              {view.mode === 'new' && (
                <NewRequestForm
                  onCancel={() => setView({ mode: 'list' })}
                  onSubmit={async (form) => {
                    const { request, error } = await createArtRequest(supabase, form);
                    if (!request) return error || true;
                    await load();
                    setView({ mode: 'thread', id: request.id });
                    return null;
                  }}
                />
              )}
              {view.mode === 'thread' && current && (
                <Thread
                  client={supabase}
                  request={current}
                  side={side}
                  refreshKey={refreshKey}
                  onBack={() => setView({ mode: 'list' })}
                  onChanged={load}
                />
              )}
            </div>
          </aside>
        </div>,
        document.body,
      )}
    </>
  );
}
