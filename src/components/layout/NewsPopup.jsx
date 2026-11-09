import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, Megaphone, X } from 'lucide-react';
import { fetchStudioCollections } from '../../lib/collectionsApi';

// Troque o ID ao lançar uma nova novidade: todos os revendedores veem de novo.
const NEWS_ID = 'colecoes-2026-11';
// Último dia (inclusive) em que o pop-up aparece. Uma vez por dia até lá.
const LAST_DAY = '2026-11-15';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Pop-up de novidade para revendedores: aparece uma vez por dia ao abrir o
 * Studio, até LAST_DAY. */
export default function NewsPopup({ resellerId }) {
  const key = `news-seen:${NEWS_ID}:${resellerId || 'unit'}`;
  const [open, setOpen] = useState(() => {
    if (today() > LAST_DAY) return false;
    try { return localStorage.getItem(key) !== today(); } catch { return true; }
  });

  // Links de divulgação cadastrados nas coleções (Painel → Studio → Coleções).
  const [promos, setPromos] = useState([]);
  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    fetchStudioCollections().then((list) => { if (alive) setPromos(list.filter((c) => c.promoUrl)); });
    return () => { alive = false; };
  }, [open]);

  const close = () => {
    try { localStorage.setItem(key, today()); } catch { /* sem armazenamento: só fecha */ }
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <button type="button" aria-label="Fechar novidade" onClick={close} className="absolute inset-0 bg-black/50" />
      <div role="dialog" aria-modal="true" aria-label="Novidade: Coleções" className="relative max-h-[92vh] w-full max-w-[560px] overflow-y-auto rounded-2xl bg-panel shadow-2xl">
        <button
          type="button"
          onClick={close}
          aria-label="Fechar"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-text-primary shadow hover:bg-white"
        >
          <X className="h-5 w-5" />
        </button>
        <img
          src="/novidade-colecoes.jpg"
          alt="Novidades: coleção Me Leve Para Praia"
          className="block aspect-[16/10] w-full object-cover"
        />
        <div className="flex flex-col gap-3 p-5 sm:p-6">
          <h2 className="text-xl font-bold">Novidade: Coleções</h2>
          <p className="text-sm text-text-secondary">
            <strong className="text-text-primary">Onde encontrar as artes:</strong> ao montar um pedido, no passo{' '}
            <strong className="text-text-primary">3 · Personalizar</strong>, clique no botão{' '}
            <strong className="text-text-primary">Coleções</strong> e abra a pasta da coleção. É só escolher a arte para aplicar no produto.
          </p>
          {promos.length > 0 && (
            <div className="flex flex-col gap-2 rounded-xl border border-accent/30 bg-accent/5 p-3">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Megaphone className="h-4 w-4 text-accent" /> Peças para postar nas redes sociais
              </p>
              {promos.map((c) => (
                <a
                  key={c.id}
                  href={c.promoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-2 rounded-lg bg-panel px-3 py-2 text-sm font-semibold text-accent ring-1 ring-border hover:ring-accent"
                >
                  <span className="truncate">Coleção {c.name}</span>
                  <span className="flex flex-shrink-0 items-center gap-1">Abrir <ExternalLink className="h-4 w-4" /></span>
                </a>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={close}
            className="mt-1 self-end rounded-lg bg-text-primary px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
