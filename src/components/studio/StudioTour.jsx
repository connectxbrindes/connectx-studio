import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/useStore';

// Tour interativo do Studio.
//
// - Aparece automaticamente no primeiro acesso e, depois, no máximo 1x por
//   semana (guarda a data no localStorage). Pode ser reaberto pelo botão de
//   ajuda "?" do cabeçalho (evento 'studio:open-tour').
// - Em vez de um carrossel de cards, é um passo a passo NA PÁGINA: navega o
//   assistente pelos 4 passos e ILUMINA (spotlight) o elemento real de cada
//   etapa com uma instrução, até chegar em finalizar o pedido.
// - Os alvos são marcados com data-tour="..." nos componentes das etapas.

const LAST_SEEN_KEY = 'studio-tour-last-seen';
const AUTOSTART_KEY = 'studio-tour-autostart';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Cada passo: em qual etapa do assistente estar, qual elemento iluminar e o
// texto. A ordem reproduz o fluxo real de personalização.
const STEPS = [
  { wizard: 1, sel: '[data-tour="produto"]', title: 'Passo 1 · Escolha o produto', text: 'Toque no produto que o cliente quer personalizar. Vamos seguir com um de exemplo.' },
  { wizard: 2, sel: '[data-tour="variacao"]', title: 'Passo 2 · Modelo e cor', text: 'Escolha a marca/modelo e a cor. A prévia ao lado já mostra como vai ficar.' },
  { wizard: 3, sel: '[data-tour="ferramentas"]', title: 'Passo 3 · Adicione conteúdo', text: 'Use “+ Texto” para escrever e “+ Imagem” para enviar uma foto ou logo do cliente.' },
  { wizard: 3, sel: '[data-tour="propriedades"]', title: 'Ajuste o elemento', text: 'Ao selecionar um texto ou imagem, edite fonte, cor, tamanho, alinhamento e rotação aqui. Cada “?” explica a opção.' },
  { wizard: 3, sel: '[data-tour="canvas"]', title: 'Posicione no produto', text: 'Arraste para mover, gire pela alça redonda e redimensione pelos cantos — direto sobre o produto.' },
  { wizard: 3, sel: '[data-tour="avancar"]', title: 'Avance para a revisão', text: 'Quando a arte estiver pronta, toque em “Próximo”.' },
  { wizard: 4, sel: '[data-tour="previa"]', title: 'Passo 4 · Revisão', text: 'Confira a prévia final do produto personalizado antes de fechar o pedido.' },
  { wizard: 4, sel: '[data-tour="add-carrinho"]', title: 'Adicione ao carrinho', text: 'Toque em “Adicionar ao Carrinho”. O carrinho abre automaticamente para finalizar.' },
  { wizard: 4, sel: '[data-tour="carrinho"]', title: 'Finalize o pedido', text: 'No carrinho, preencha o nome do cliente e a observação (se houver) e toque em “Finalizar Compra”. Pronto, o seu pedido foi para a linha de produção!' },
];

export default function StudioTour({ autoOffer = true }) {
  const [phase, setPhase] = useState('hidden'); // 'hidden' | 'offer' | 'tour'
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const startRef = useRef(null);
  const offeredRef = useRef(false);

  const ready = useStore((s) => s.catalogLoaded && !!s.selectedProduct);

  const markSeen = () => {
    try {
      localStorage.setItem(LAST_SEEN_KEY, String(Date.now()));
    } catch {
      /* ignora */
    }
  };

  const startTour = () => {
    const s = useStore.getState();
    if (!s.selectedProduct) return; // sem catálogo não há o que mostrar
    startRef.current = { currentStep: s.currentStep, furthestStep: s.furthestStep };
    setIndex(0);
    setRect(null);
    setPhase('tour');
  };

  const close = () => {
    markSeen();
    if (startRef.current) {
      useStore.setState(startRef.current);
      startRef.current = null;
    }
    setRect(null);
    setPhase('hidden');
  };

  // Oferta automática: primeiro acesso ou 1x/semana, quando o catálogo estiver
  // pronto. Também atende o "abrir na volta de Meus Pedidos" (flag autostart).
  useEffect(() => {
    if (!autoOffer || !ready || offeredRef.current) return;
    let autostart = false;
    try {
      autostart = localStorage.getItem(AUTOSTART_KEY) === '1';
      if (autostart) localStorage.removeItem(AUTOSTART_KEY);
    } catch {
      autostart = false;
    }
    offeredRef.current = true;
    if (autostart) {
      startTour();
      return;
    }
    let last = 0;
    try {
      last = Number(localStorage.getItem(LAST_SEEN_KEY)) || 0;
    } catch {
      last = 0;
    }
    if (Date.now() - last > WEEK_MS) setPhase('offer');
  }, [autoOffer, ready]);

  // Reabrir manualmente pelo botão de ajuda do cabeçalho.
  useEffect(() => {
    const open = () => startTour();
    window.addEventListener('studio:open-tour', open);
    return () => window.removeEventListener('studio:open-tour', open);
  }, []);

  // Posiciona o spotlight no elemento do passo atual: leva o assistente à
  // etapa certa, espera o elemento montar (retry) e mede sua posição. Refaz a
  // medição em resize/scroll pra o destaque acompanhar.
  useEffect(() => {
    if (phase !== 'tour') return undefined;
    const cfg = STEPS[index];

    // Navega direto (sem passar pela validação do assistente) — é uma
    // demonstração, então pode pular pra qualquer etapa.
    useStore.setState((s) => ({
      currentStep: cfg.wizard,
      furthestStep: Math.max(s.furthestStep, cfg.wizard),
    }));

    let cancelled = false;
    let raf = 0;
    let tries = 0;

    const place = (doScroll) => {
      const el = document.querySelector(cfg.sel);
      if (!el) {
        setRect(null);
        return;
      }
      if (doScroll) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    const tick = () => {
      if (cancelled) return;
      const el = document.querySelector(cfg.sel);
      if (el || tries > 45) {
        place(true);
        return;
      }
      tries += 1;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onReflow = () => place(false);
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [phase, index]);

  if (phase === 'hidden') return null;

  if (phase === 'offer') {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div onClick={close} aria-hidden="true" className="absolute inset-0 bg-black/50" />
        <div className="relative w-full max-w-md rounded-2xl bg-panel p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 text-3xl">
            🎬
          </div>
          <h2 className="text-2xl font-bold">Quer um tour rápido?</h2>
          <p className="mt-2 text-text-secondary">
            A gente destaca cada parte da tela e mostra, passo a passo, como personalizar um produto e finalizar o pedido. Dá pra pular e fazer depois no botão de ajuda “?” no topo.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse">
            <button
              type="button"
              onClick={startTour}
              className="flex-1 rounded-lg bg-text-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-neutral-800"
            >
              Fazer o tour
            </button>
            <button
              type="button"
              onClick={close}
              className="flex-1 rounded-lg border border-border bg-white px-6 py-3 font-semibold text-text-primary transition-colors hover:border-text-primary"
            >
              Pular
            </button>
          </div>
        </div>
      </div>
    );
  }

  // phase === 'tour'
  const cfg = STEPS[index];
  const isLast = index === STEPS.length - 1;

  return (
    <>
      {/* Bloqueia cliques na página durante o tour. Quando há elemento medido,
          o escurecimento vem do box-shadow do spotlight (deixa o "buraco"
          transparente); sem elemento, escurece o bloqueador inteiro. */}
      <div className={`fixed inset-0 z-[9990] ${rect ? '' : 'bg-black/60'}`} />

      {rect && (
        <div
          className="pointer-events-none fixed z-[9991] rounded-xl ring-2 ring-accent transition-all duration-300"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
          }}
        />
      )}

      {/* Card em posição fixa (rodapé central) — não se move entre os passos,
          só o spotlight muda. Deixa a experiência padronizada e nunca cobre o
          elemento destacado (que é centralizado na tela pelo scroll). */}
      <div
        role="dialog"
        aria-label="Tutorial do Studio"
        className="fixed bottom-4 left-1/2 z-[9992] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl bg-panel p-5 shadow-2xl sm:bottom-6"
      >
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-accent">
          {index + 1} de {STEPS.length}
        </div>
        <h3 className="text-lg font-bold">{cfg.title}</h3>
        <p className="mt-1 text-sm text-text-secondary">{cfg.text}</p>

        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={close}
            className="text-sm font-medium text-text-secondary hover:text-text-primary"
          >
            Pular
          </button>
          <div className="flex gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={() => setIndex((i) => i - 1)}
                className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-text-primary transition-colors hover:border-text-primary"
              >
                Anterior
              </button>
            )}
            <button
              type="button"
              onClick={() => (isLast ? close() : setIndex((i) => i + 1))}
              className="rounded-lg bg-text-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
            >
              {isLast ? 'Concluir' : 'Próximo'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
