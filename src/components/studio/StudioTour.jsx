import { useEffect, useState } from 'react';

// Tour de boas-vindas do Studio.
//
// - Aparece automaticamente no primeiro acesso e, depois, no máximo 1x por
//   semana (guarda a data da última vez no localStorage).
// - O usuário escolhe "Fazer tour" ou "Pular".
// - Pode ser reaberto a qualquer momento pelo botão de ajuda no cabeçalho
//   (dispara o evento 'studio:open-tour').

const LAST_SEEN_KEY = 'studio-tour-last-seen';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const SLIDES = [
  {
    icon: '👋',
    title: 'Bem-vindo ao Studio',
    text: 'Aqui você personaliza o produto do jeito do cliente em 4 passos simples. Vamos dar uma volta rápida — leva menos de um minuto.',
  },
  {
    icon: '📦',
    title: 'Passo 1 · Produto',
    text: 'Escolha o produto que vai personalizar (ex: uma capa). É o ponto de partida do pedido.',
  },
  {
    icon: '🎨',
    title: 'Passo 2 · Variação',
    text: 'Selecione a marca/modelo e a cor. A prévia já mostra exatamente como o produto vai ficar.',
  },
  {
    icon: '✍️',
    title: 'Passo 3 · Personalizar',
    text: 'Use “+ Texto” para escrever e “+ Imagem” para enviar uma foto ou logo. No painel à direita você ajusta fonte, cor, tamanho e alinhamento. O ícone “?” em cada opção explica pra que serve.',
  },
  {
    icon: '🔄',
    title: 'Ajuste fino',
    text: 'Arraste para posicionar, gire pela alça redonda (ou digite o ângulo) e redimensione pelos cantos. Em “Camadas” você organiza o que fica na frente.',
  },
  {
    icon: '🛒',
    title: 'Passo 4 · Revisão e carrinho',
    text: 'Confira a prévia final, adicione ao carrinho e finalize preenchendo o nome do cliente e, se precisar, uma observação para a produção. Pronto!',
  },
];

export default function StudioTour({ autoOffer = true }) {
  const [phase, setPhase] = useState('hidden'); // 'hidden' | 'offer' | 'tour'
  const [index, setIndex] = useState(0);

  // Auto: primeiro acesso ou 1x por semana. Só onde autoOffer=true (o Studio) —
  // em páginas como "Meus Pedidos" o tour existe só pra reabertura manual.
  useEffect(() => {
    if (!autoOffer) return;
    let last = 0;
    try {
      last = Number(localStorage.getItem(LAST_SEEN_KEY)) || 0;
    } catch {
      last = 0;
    }
    if (Date.now() - last > WEEK_MS) setPhase('offer');
  }, [autoOffer]);

  // Reabrir manualmente pelo botão de ajuda do cabeçalho.
  useEffect(() => {
    const open = () => {
      setIndex(0);
      setPhase('tour');
    };
    window.addEventListener('studio:open-tour', open);
    return () => window.removeEventListener('studio:open-tour', open);
  }, []);

  const markSeen = () => {
    try {
      localStorage.setItem(LAST_SEEN_KEY, String(Date.now()));
    } catch {
      /* ignora */
    }
  };

  const close = () => {
    markSeen();
    setPhase('hidden');
  };

  if (phase === 'hidden') return null;

  const isLast = index === SLIDES.length - 1;
  const slide = SLIDES[index];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        onClick={close}
        aria-hidden="true"
        className="absolute inset-0 bg-black/50 motion-safe:animate-fade-in"
      />

      {phase === 'offer' ? (
        <div className="relative w-full max-w-md rounded-2xl bg-panel p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 text-3xl">
            🎬
          </div>
          <h2 className="text-2xl font-bold">Quer um tour rápido?</h2>
          <p className="mt-2 text-text-secondary">
            Em menos de um minuto a gente mostra como personalizar um produto e finalizar o pedido. Você pode pular e fazer depois pelo botão de ajuda “?” no topo.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse">
            <button
              type="button"
              onClick={() => {
                setIndex(0);
                setPhase('tour');
              }}
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
      ) : (
        <div className="relative w-full max-w-md rounded-2xl bg-panel p-8 shadow-2xl">
          <button
            type="button"
            onClick={close}
            aria-label="Fechar tutorial"
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-bg hover:text-text-primary"
          >
            ✕
          </button>

          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 text-3xl">
            {slide.icon}
          </div>
          <h2 className="text-center text-xl font-bold">{slide.title}</h2>
          <p className="mt-2 min-h-[96px] text-center text-text-secondary">{slide.text}</p>

          {/* Indicador de progresso */}
          <div className="mt-4 flex justify-center gap-1.5">
            {SLIDES.map((s, i) => (
              <span
                key={s.title}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? 'w-5 bg-accent' : 'w-1.5 bg-border'
                }`}
              />
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between">
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
      )}
    </div>
  );
}
