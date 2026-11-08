import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, X } from 'lucide-react';

const CHECKER = 'bg-[repeating-conic-gradient(#f3f3f3_0%_25%,#fff_0%_50%)] bg-[length:16px_16px]';

/** Janela de Coleções: primeiro mostra as pastas (ícone de pasta com o nome
 * da coleção embaixo); ao abrir uma pasta, mostra as artes. Clicar numa arte
 * aplica no produto. */
export default function CollectionsModal({ collections, onPick, onClose }) {
  const [openId, setOpenId] = useState(null);
  const [loadingId, setLoadingId] = useState(null);
  const folder = collections.find((c) => c.id === openId);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (openId) setOpenId(null);
      else onClose();
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [onClose, openId]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Fechar coleções" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div role="dialog" aria-modal="true" aria-label="Coleções" className="relative flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-panel shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex min-w-0 items-center gap-2">
            {folder && (
              <button type="button" onClick={() => setOpenId(null)} aria-label="Voltar para as coleções" className="flex-shrink-0 rounded-full p-1 text-text-secondary hover:bg-bg hover:text-text-primary">
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <div className="min-w-0">
              <p className="truncate text-lg font-bold">
                {folder ? (
                  <><button type="button" onClick={() => setOpenId(null)} className="font-normal text-text-secondary hover:text-text-primary">Coleções</button> <span className="text-text-secondary">/</span> {folder.name}</>
                ) : 'Coleções'}
              </p>
              <p className="text-xs text-text-secondary">
                {folder ? 'Escolha uma arte para aplicar no produto. Depois é só arrastar e redimensionar.' : 'Escolha uma coleção para ver as artes.'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {collections.length === 0 && (
            <p className="py-12 text-center text-sm text-text-secondary">Ainda não há coleções disponíveis. Em breve novas artes aparecem aqui.</p>
          )}

          {!folder && collections.length > 0 && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-5">
              {collections.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setOpenId(c.id)}
                  className="group flex flex-col items-center gap-2 rounded-xl p-3 text-center transition-colors hover:bg-bg focus-visible:bg-bg"
                >
                  <img
                    src="/icons/pasta-colecao.webp"
                    alt=""
                    className="h-24 w-auto drop-shadow-sm transition-transform group-hover:-translate-y-0.5 group-hover:scale-105 motion-reduce:transform-none"
                  />
                  <span className="w-full break-words text-sm font-semibold leading-tight">{c.name}</span>
                  <span className="-mt-1 text-xs text-text-secondary">{c.images.length} {c.images.length === 1 ? 'arte' : 'artes'}</span>
                </button>
              ))}
            </div>
          )}

          {folder && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {folder.images.map((img) => (
                <button
                  key={img.id}
                  type="button"
                  disabled={!!loadingId}
                  onClick={async () => { setLoadingId(img.id); await onPick(img); setLoadingId(null); }}
                  title={img.name}
                  className="group flex flex-col gap-1 text-left disabled:opacity-60"
                >
                  <span className={`relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border border-border p-2 transition-all group-hover:border-accent group-hover:ring-2 group-hover:ring-accent/30 ${CHECKER}`}>
                    <img src={img.url} alt={img.name} loading="lazy" className="max-h-full max-w-full object-contain" />
                    {loadingId === img.id && (
                      <span className="absolute inset-0 flex items-center justify-center bg-white/70">
                        <span className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
