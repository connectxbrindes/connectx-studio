import { useState, useRef, useEffect } from 'react';

// Ícone "?" de ajuda ao lado de um rótulo. Mostra uma explicação curta ao
// passar o mouse (desktop) e ao tocar/clicar (mobile). Fecha ao clicar fora
// ou apertar Esc. É só informativo — não altera o valor do campo.
export default function InfoHint({ text, label, align = 'center' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Perto da borda direita (ex: última coluna do painel) o balão centralizado
  // vazaria pra fora da tela — nesses casos passa align="right".
  const position =
    align === 'right' ? 'right-0' : align === 'left' ? 'left-0' : 'left-1/2 -translate-x-1/2';

  return (
    <span
      ref={ref}
      className="relative inline-flex align-middle"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={label ? `Ajuda: ${label}` : 'Ajuda'}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex h-4 w-4 items-center justify-center rounded-full bg-accent/15 text-[11px] font-bold leading-none text-accent transition-colors hover:bg-accent hover:text-white"
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          className={`absolute top-6 z-[1100] w-56 max-w-[70vw] rounded-lg border border-border bg-panel px-3 py-2 text-xs font-normal normal-case leading-relaxed tracking-normal text-text-secondary shadow-lg ${position}`}
        >
          {text}
        </span>
      )}
    </span>
  );
}
