import { useEffect, useRef } from 'react';

export default function PersonalizationElement({ element, isSelected, registerRef, onSelect, skew = 0 }) {
  const ref = useRef(null);

  useEffect(() => {
    registerRef(element.id, ref.current);
    return () => registerRef(element.id, null);
  }, [element.id, registerRef]);

  const baseStyle = {
    position: 'absolute',
    left: `${element.x}%`,
    top: `${element.y}%`,
    width: `${element.width}%`,
    height: `${element.height}%`,
    transform: `rotate(${element.rotation}deg)`,
    zIndex: element.zIndex,
  };

  if (element.type === 'text') {
    return (
      <div
        ref={ref}
        style={baseStyle}
        onMouseDown={onSelect}
        className={`flex cursor-move items-center justify-center ${isSelected ? 'ring-1 ring-accent' : ''}`}
      >
        {/* Não é contentEditable: a Moveable intercepta o mousedown/pointerdown
            no seu próprio target (preventDefault para poder arrastar) antes do
            navegador conseguir focar o span, então digitar direto no canvas
            nunca funcionava. Edição de texto acontece pelo campo "Conteúdo" no
            painel lateral (PropertiesPanel), que não disputa evento nenhum com
            a Moveable. */}
        <span
          style={{
            fontFamily: element.fontFamily,
            fontSize: `${element.fontSize}px`,
            fontWeight: element.fontWeight,
            color: element.color,
            textAlign: element.textAlign,
            width: '100%',
            outline: 'none',
            // Skew só no conteúdo (não na caixa/target da Moveable) — inclina a
            // base do texto pra ilusão de perspectiva, sem desalinhar manípulos.
            transform: skew ? `skewY(${skew}deg)` : undefined,
          }}
        >
          {element.content?.trim() ? element.content : 'Seu texto aqui'}
        </span>
      </div>
    );
  }

  return (
    <img
      ref={ref}
      src={element.src}
      crossOrigin="anonymous"
      alt="Elemento de personalização"
      onMouseDown={onSelect}
      draggable={false}
      // fill (não contain): a caixa já é o tamanho real que o cliente
      // escolheu arrastando os manípulos — contain deixaria sobrando espaço
      // vazio (letterbox) sempre que a caixa não tivesse a proporção
      // original da foto, dando a impressão de "não preencher tudo".
      style={{ ...baseStyle, objectFit: 'fill', cursor: 'move', maxWidth: 'none', maxHeight: 'none' }}
      className={isSelected ? 'ring-1 ring-accent' : ''}
    />
  );
}
