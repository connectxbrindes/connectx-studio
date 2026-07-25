import { useStore } from '../../../store/useStore';

export default function LayerList() {
  const elements = useStore((s) => s.elements);
  const selectedElementId = useStore((s) => s.selectedElementId);
  const selectElement = useStore((s) => s.selectElement);
  const bringToFront = useStore((s) => s.bringToFront);

  if (elements.length === 0) return null;

  const sorted = [...elements].sort((a, b) => b.zIndex - a.zIndex);

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">Camadas</h3>
      <ul className="flex flex-col gap-2">
        {sorted.map((el) => (
          <li key={el.id}>
            <button
              type="button"
              onClick={() => {
                selectElement(el.id);
                bringToFront(el.id);
              }}
              className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                el.id === selectedElementId ? 'border-accent bg-accent/5' : 'border-border'
              }`}
            >
              <span aria-hidden="true">{el.type === 'text' ? '🔤' : '🖼️'}</span>
              <span className="truncate">{el.type === 'text' ? el.content : 'Imagem'}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
