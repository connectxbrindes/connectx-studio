import { useStore } from '../../../store/useStore';
import InfoHint from '../../ui/InfoHint';

const DEFAULT_TEXT = 'Seu texto aqui';
const FONT_SIZES = [14, 16, 20, 24, 32, 40, 48];
const FONT_FAMILIES = [
  { value: "'Amsi Pro Cond', sans-serif", label: 'Amsi Pro Cond' },
  { value: "'Bakerie Smooth', sans-serif", label: 'Bakerie Smooth' },
  { value: "'Weather Sunday', cursive", label: 'Weather Sunday' },
];
const ALIGNMENTS = [
  { value: 'left', label: 'Esq.' },
  { value: 'center', label: 'Centro' },
  { value: 'right', label: 'Dir.' },
];

export default function PropertiesPanel() {
  const elements = useStore((s) => s.elements);
  const selectedElementId = useStore((s) => s.selectedElementId);
  const updateElement = useStore((s) => s.updateElement);
  const removeElement = useStore((s) => s.removeElement);

  const element = elements.find((el) => el.id === selectedElementId);

  if (!element) {
    return (
      <p className="text-sm text-text-secondary">
        Adicione texto ou imagem e selecione um elemento para editar suas propriedades.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          {element.type === 'text' ? 'Texto' : 'Imagem'}
        </h3>
        <button
          type="button"
          onClick={() => removeElement(element.id)}
          className="text-sm font-medium text-accent hover:underline"
        >
          Remover
        </button>
      </div>

      {element.type === 'text' && (
        <>
          <label className="flex flex-col gap-1 text-sm">
            <span className="flex items-center gap-1.5">
              Conteúdo
              <InfoHint
                label="Conteúdo"
                text="Digite aqui o texto que vai aparecer no produto. Ao clicar, o texto de exemplo some e você já começa a escrever."
              />
            </span>
            <textarea
              value={element.content}
              onChange={(e) => updateElement(element.id, { content: e.target.value })}
              // Ao focar, limpa o texto padrão pra o cliente já começar a
              // digitar direto. Se sair sem escrever nada, restaura o padrão
              // pra não ficar uma caixa de texto invisível na prévia.
              onFocus={() => {
                if (element.content === DEFAULT_TEXT) updateElement(element.id, { content: '' });
              }}
              onBlur={() => {
                if (element.content.trim() === '') updateElement(element.id, { content: DEFAULT_TEXT });
              }}
              rows={2}
              placeholder={DEFAULT_TEXT}
              className="resize-none rounded-lg border border-border px-3 py-2 placeholder:text-text-secondary"
            />
          </label>

          <div className="flex flex-col gap-1 text-sm">
            <span className="flex items-center gap-1.5">
              Fonte
              <InfoHint
                label="Fonte"
                text="Escolha o estilo da letra. Cada botão 'Aa' mostra uma prévia da fonte. Toque numa opção para aplicar ao texto."
              />
            </span>
            <div className="grid grid-cols-3 gap-2">
              {FONT_FAMILIES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  title={label}
                  aria-label={label}
                  onClick={() => updateElement(element.id, { fontFamily: value })}
                  aria-pressed={element.fontFamily === value}
                  style={{ fontFamily: value }}
                  className={`rounded-lg border py-2 text-lg transition-colors ${
                    element.fontFamily === value ? 'border-text-primary bg-text-primary text-white' : 'border-border'
                  }`}
                >
                  Aa
                </button>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span className="flex items-center gap-1.5">
              Tamanho da fonte
              <InfoHint label="Tamanho da fonte" text="Deixa o texto maior ou menor. Você também pode redimensionar arrastando os cantos da caixa sobre o produto." />
            </span>
            <select
              value={element.fontSize}
              onChange={(e) => updateElement(element.id, { fontSize: Number(e.target.value) })}
              className="rounded-lg border border-border px-3 py-2"
            >
              {FONT_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}px
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="flex items-center gap-1.5">
              Cor
              <InfoHint label="Cor" text="Escolha a cor do texto. Toque no quadro colorido e selecione a cor desejada." />
            </span>
            <input
              type="color"
              value={element.color}
              onChange={(e) => updateElement(element.id, { color: e.target.value })}
              className="h-10 w-full rounded-lg border border-border"
            />
          </label>

          <div className="flex flex-col gap-1 text-sm">
            <span className="flex items-center gap-1.5">
              Alinhamento
              <InfoHint label="Alinhamento" text="Alinha o texto à esquerda, ao centro ou à direita — útil quando o texto tem mais de uma linha." />
            </span>
            <div className="flex gap-2">
              {ALIGNMENTS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => updateElement(element.id, { textAlign: value })}
                  aria-pressed={element.textAlign === value}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    element.textAlign === value ? 'border-text-primary bg-text-primary text-white' : 'border-border'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="flex flex-col gap-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            Rotação
            <InfoHint label="Rotação" text="Gira o elemento. Digite o ângulo (em graus) ou use a barra deslizante. Também dá pra girar pela alça redonda acima da caixa no produto." />
          </span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              step="1"
              value={Math.round(element.rotation)}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v)) updateElement(element.id, { rotation: v });
              }}
              className="w-16 rounded-lg border border-border px-2 py-1 text-right outline-none transition-colors focus:border-text-primary"
            />
            <span className="text-text-secondary">°</span>
          </div>
        </div>
        <input
          type="range"
          min="-180"
          max="180"
          value={element.rotation}
          onChange={(e) => updateElement(element.id, { rotation: Number(e.target.value) })}
        />
      </div>
    </div>
  );
}
