import { forwardRef } from 'react';

const ProductPreview = forwardRef(function ProductPreview(
  { product, color, model, elements, className = '', bare = false, heightClass = 'h-[420px]', artOnly = false },
  ref
) {
  // 3 camadas quando o modelo tem mockup: foto (fundo) → arte do cliente
  // (meio) → máscara por cima (cobre o que estiver fora da área de
  // personalização) — mesma lógica do Canvas.jsx do Passo 3.
  //
  // artOnly: só a arte do cliente (elementos), sem mockup e sem máscara, em
  // fundo transparente — é a "arte montada" que vai pro pedido pra produção
  // usar direto, mantendo a mesma geometria (posições em %) da prévia.
  const backgroundImage = model?.mockupImageUrl || color?.image || product.image;
  const maskImageUrl = model?.maskImageUrl || null;
  const hasModelMockup = Boolean(model?.mockupImageUrl);
  // Perspectiva (skew) da área de personalização: inclina a BASE dos elementos
  // só na PRÉVIA, dando a ilusão de que a arte está deitada sobre a superfície
  // do produto (ex: chaveiro exibido de lado). É efeito visual — a arte de
  // produção (artOnly) sai reta, sem skew, porque a gravação é plana.
  const previewSkew = artOnly ? 0 : Number(product?.personalizationArea?.skew) || 0;

  return (
    <div
      ref={ref}
      className={`relative z-0 transition-colors duration-500 ${
        hasModelMockup
          ? `mx-auto aspect-[331/590] ${bare ? 'h-full' : `${heightClass} overflow-hidden rounded-xl`}`
          : `w-full ${bare ? 'h-full' : `${heightClass} overflow-hidden rounded-xl`}`
      } ${artOnly ? '' : hasModelMockup ? 'bg-white' : backgroundImage ? 'bg-panel' : ''} ${className}`}
      style={artOnly || hasModelMockup || backgroundImage ? undefined : { backgroundColor: color.hex }}
    >
      {!artOnly && (
        <img
          src={backgroundImage}
          crossOrigin="anonymous"
          alt={product.name}
          draggable={false}
          className={`pointer-events-none absolute inset-0 object-contain ${
            hasModelMockup ? 'h-full w-full' : 'm-auto max-h-[92%] max-w-[92%]'
          }`}
        />
      )}
      <div className="absolute inset-0" style={{ zIndex: 10 }}>
        {elements.map((element) => (
          <div
            key={element.id}
            style={{
              position: 'absolute',
              left: `${element.x}%`,
              top: `${element.y}%`,
              width: `${element.width}%`,
              height: `${element.height}%`,
              transform: `skewY(${previewSkew}deg) rotate(${element.rotation}deg)`,
              zIndex: element.zIndex,
            }}
            className="flex items-center justify-center"
          >
            {element.type === 'text' ? (
              <span
                style={{
                  fontFamily: element.fontFamily,
                  fontSize: `${element.fontSize}px`,
                  fontWeight: element.fontWeight,
                  color: element.color,
                  textAlign: element.textAlign,
                  width: '100%',
                }}
              >
                {element.content?.trim() ? element.content : 'Seu texto aqui'}
              </span>
            ) : (
              <img
                src={element.src}
                crossOrigin="anonymous"
                alt="Elemento de personalização"
                draggable={false}
                className="h-full w-full object-fill"
              />
            )}
          </div>
        ))}
      </div>

      {maskImageUrl && !artOnly && (
        <img
          src={maskImageUrl}
          crossOrigin="anonymous"
          alt=""
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
          style={{ zIndex: 50 }}
        />
      )}
    </div>
  );
});

export default ProductPreview;
