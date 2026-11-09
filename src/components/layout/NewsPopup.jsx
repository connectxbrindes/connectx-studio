import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, Megaphone, X } from 'lucide-react';
import { fetchStudioCollections } from '../../lib/collectionsApi';
import { useLocation } from 'react-router-dom';
import { fetchCurrentNews } from '../../lib/newsApi';

/** Texto da novidade: quebras de linha mantidas e **assim** vira negrito. */
function RichText({ text }) {
  return (
    <p className="whitespace-pre-line text-sm text-text-secondary">
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith('**') && part.endsWith('**') && part.length > 4
          ? <strong key={i} className="text-text-primary">{part.slice(2, -2)}</strong>
          : part,
      )}
    </p>
  );
}

/** Desenho do pop-up (usado no Studio e na prévia do Painel). */
export function NewsModal({ news, onClose }) {
  // Links de divulgação cadastrados nas coleções (Painel → Studio → Coleções).
  const [promos, setPromos] = useState([]);
  useEffect(() => {
    if (!news.showCollectionLinks) return undefined;
    let alive = true;
    fetchStudioCollections().then((list) => { if (alive) setPromos(list.filter((c) => c.promoUrl)); });
    return () => { alive = false; };
  }, [news.showCollectionLinks]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <button type="button" aria-label="Fechar novidade" onClick={onClose} className="absolute inset-0 bg-black/50" />
      <div role="dialog" aria-modal="true" aria-label={news.title || 'Novidade'} className="relative max-h-[92vh] w-full max-w-[560px] overflow-y-auto rounded-2xl bg-panel shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-text-primary shadow hover:bg-white"
        >
          <X className="h-5 w-5" />
        </button>
        {news.imageUrl && (
          <img src={news.imageUrl} alt={news.title} className="block aspect-[16/10] w-full object-cover" />
        )}
        <div className={`flex flex-col gap-3 p-5 sm:p-6 ${news.imageUrl ? '' : 'pt-14'}`}>
          {news.title && <h2 className="text-xl font-bold">{news.title}</h2>}
          {news.body && <RichText text={news.body} />}
          {news.showCollectionLinks && promos.length > 0 && (
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
            onClick={onClose}
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

/** Pop-up de novidade para revendedores: mostra a novidade cadastrada no
 * Painel (Studio → Novidades), entre as datas de início e fim, toda vez que o
 * revendedor abre o site ou volta para a tela de início ("/"). */
export default function NewsPopup() {
  const location = useLocation();
  const [news, setNews] = useState(null);

  // Cada chegada na tela de início (abrir o site, clicar no logo, voltar de
  // outra página) gera uma nova location.key e mostra de novo.
  useEffect(() => {
    if (location.pathname !== '/') return undefined;
    let alive = true;
    fetchCurrentNews().then((n) => { if (alive && n) setNews(n); });
    return () => { alive = false; };
  }, [location.key, location.pathname]);

  if (!news) return null;
  return <NewsModal news={news} onClose={() => setNews(null)} />;
}
