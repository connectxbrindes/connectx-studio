import { forwardRef } from 'react';

const ProductPreview = forwardRef(function ProductPreview(
  { product, color, model, elements, className = '', bare = false, heightClass = 'h-[420px]' },
  ref
) {
  // 3 camadas quando o modelo tem mockup: foto (fundo) → arte do cliente
  // (meio) → máscara por cima (cobre o que estiver fora da área de
  // personalização) — mesma lógica do Canvas.jsx do Passo 3.
  const backgroundImage = model?.mockupImageUrl || color?.image || product.image;
  const maskImageUrl = model?.maskImageUrl || null;
  const hasModelMockup = Boolean(model?.mockupImageUrl);

  return (
    <div
      ref={ref}
      className={`relative flex items-center justify-center transition-colors duration-500 ${
        hasModelMockup
          ? `mx-auto aspect-[331/590] ${bare ? 'h-full' : `${heightClass} overflow-hidden rounded-xl`}`
          : `w-full ${bare ? 'h-full' : `${heightClass} overflow-hidden rounded-xl`}`
      } ${hasModelMockup ? 'bg-white' : color?.image ? 'bg-panel' : ''} ${className}`}
      style={hasModelMockup || color?.image ? undefined : { backgroundColor: color.hex }}
    >
      <img
        src={backgroundImage}
        alt={product.name}
        draggable={false}
        className={`pointer-events-none absolute inset-0 object-contain ${
          hasModelMockup ? 'h-full w-full' : 'm-auto max-h-[80%] max-w-[80%]'
        }`}
      />
      <div className="absolute inset-0">
        {elements.map((element) => (
          <div
            key={element.id}
            style={{
              position: 'absolute',
              left: `${element.x}%`,
              top: `${element.y}%`,
              width: `${element.width}%`,
              height: `${element.height}%`,
              transform: `rotate(${element.rotation}deg)`,
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
                {element.content}
              </span>
            ) : (
              <img
                src={element.src}
                alt="Elemento de personalização"
                draggable={false}
                className="h-full w-full object-fill"
              />
            )}
          </div>
        ))}
      </div>

      {maskImageUrl && (
        <img
          src={maskImageUrl}
          alt=""
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
          style={{ zIndex: 1000 }}
        />
      )}
    </div>
  );
});

export default ProductPreview;
