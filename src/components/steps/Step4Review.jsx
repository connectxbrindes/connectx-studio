import { useRef, useState } from 'react';
import { useStore } from '../../store/useStore';
import { formatCurrency, computePersonalizationFee, computeLineTotal } from '../../utils/price';
import { useCanvasExport } from '../../hooks/useCanvasExport';
import Button from '../ui/Button';
import ProductPreview from '../shared/ProductPreview';
import Viewer3D from '../shared/Viewer3D';

export default function Step4Review() {
  const product = useStore((s) => s.selectedProduct);
  const color = useStore((s) => s.selectedColor);
  const size = useStore((s) => s.selectedSize);
  const model = useStore((s) => s.selectedModel);
  const quantity = useStore((s) => s.quantity);
  const setQuantity = useStore((s) => s.setQuantity);
  const elements = useStore((s) => s.elements);
  const goBack = useStore((s) => s.goBack);
  const goToStep = useStore((s) => s.goToStep);
  const addItem = useStore((s) => s.addItem);
  const showToast = useStore((s) => s.showToast);
  const openDrawer = useStore((s) => s.openDrawer);
  const resetConfigurator = useStore((s) => s.resetConfigurator);
  const resetWizard = useStore((s) => s.resetWizard);
  const previewMode = useStore((s) => s.previewMode);
  const { exportNode } = useCanvasExport();
  const previewRef = useRef(null);
  const artRef = useRef(null);
  const artBoxRef = useRef(null);
  const [isAdding, setIsAdding] = useState(false);
  const [viewMode, setViewMode] = useState('2d');
  const [texture3d, setTexture3d] = useState(null);
  const [loading3d, setLoading3d] = useState(false);

  const handleShow3d = async () => {
    // Captura a prévia 2D (produto + cor + elementos) ANTES de trocar de aba —
    // o preview precisa continuar visível no DOM pro html-to-image conseguir
    // renderizá-lo; escondido ele sairia em branco.
    if (!texture3d) {
      setLoading3d(true);
      const png = await exportNode(previewRef.current);
      setTexture3d(png);
      setLoading3d(false);
    }
    setViewMode('3d');
  };

  const fee = computePersonalizationFee(elements);
  const lineTotal = computeLineTotal({ unitPrice: product.price, quantity, elements });

  const handleAddToCart = async () => {
    setIsAdding(true);
    // Espelha o tamanho da prévia visível no render oculto da arte, pra a
    // geometria bater exatamente (posições em % → mesmo container). Espera as
    // fontes carregarem antes de capturar (texto sai certo).
    const box = previewRef.current?.getBoundingClientRect();
    if (box && artBoxRef.current) {
      artBoxRef.current.style.width = `${Math.round(box.width)}px`;
      artBoxRef.current.style.height = `${Math.round(box.height)}px`;
      void artBoxRef.current.offsetHeight; // força reflow antes de capturar
    }
    if (document.fonts?.ready) {
      try {
        await document.fonts.ready;
      } catch {
        /* ignora */
      }
    }
    const thumbnail = await exportNode(previewRef.current);
    // Arte montada (sem mockup/máscara, fundo transparente) — vai pro pedido
    // pra produção usar direto, sem remontar o layout.
    const artImage = await exportNode(artRef.current);
    addItem({
      productId: product.id,
      productName: product.name,
      image: color?.image || product.image,
      thumbnail,
      artImage,
      unitPrice: product.price,
      color: color.name,
      colorId: color.id,
      size: size?.name,
      sizeId: size?.id,
      model: model?.name,
      modelId: model?.id,
      quantity,
      personalizationFee: fee,
      lineTotal,
      elements,
    });
    setIsAdding(false);
    showToast('Adicionado ao carrinho!');
    // Abre o carrinho na hora — o vendedor já vê o item e finaliza, sem
    // precisar clicar no ícone do carrinho depois.
    openDrawer();
  };

  const handleContinueShopping = () => {
    resetConfigurator();
    resetWizard();
  };

  return (
    <section className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_420px]">
      <div data-tour="previa" className="flex flex-col items-center gap-4 rounded-2xl bg-panel p-10 shadow-sm">
        {product.hasViewer3d && (
          <div className="flex w-fit rounded-lg border border-border p-1">
            <button
              type="button"
              onClick={() => setViewMode('2d')}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                viewMode === '2d' ? 'bg-text-primary text-white' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Prévia 2D
            </button>
            <button
              type="button"
              onClick={handleShow3d}
              disabled={loading3d}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                viewMode === '3d' ? 'bg-text-primary text-white' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {loading3d ? 'Gerando…' : 'Prévia 3D'}
            </button>
          </div>
        )}

        <div className="relative flex w-full items-center justify-center">
          {/* w-full aqui é essencial: sem largura definida, a prévia sem
              mockup (térmicos) colapsa pra 0 de largura (a imagem é absolute,
              não segura o container). Produtos com mockup têm largura própria
              (aspect-ratio) e ficam centralizados pelo mx-auto interno. */}
          <div className={`w-full ${viewMode === '2d' ? '' : 'hidden'}`}>
            <ProductPreview
              ref={previewRef}
              product={product}
              color={color}
              model={model}
              elements={elements}
              heightClass="h-[560px]"
            />
          </div>
          {viewMode === '3d' && texture3d && (
            <Viewer3D modelUrl={product.model3dUrl} textureUrl={texture3d} className="h-[400px] w-full" />
          )}
        </div>

        {/* Render oculto da arte montada (sem mockup/máscara, fundo
            transparente) só pra capturar a imagem que vai no pedido. Fica no
            fluxo mas 0×0 + overflow-hidden (invisível, sem quebrar o
            html-to-image como acontecia fora da tela). O box interno tem o
            tamanho da prévia (setado no add-to-cart) e o ProductPreview bare
            preenche ele — geometria idêntica à prévia. */}
        <div aria-hidden="true" className="h-0 w-0 overflow-hidden">
          <div ref={artBoxRef} style={{ width: 314, height: 560 }}>
            <ProductPreview
              ref={artRef}
              product={product}
              color={color}
              model={model}
              elements={elements}
              bare
              artOnly
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="border-b border-border pb-6">
          <h1 className="text-3xl font-bold">{product.name}</h1>
          <p className="mt-2 text-text-secondary">
            {[color.name, size?.name, model?.name].filter(Boolean).join(' · ')}
          </p>
          <button
            type="button"
            onClick={() => goToStep(2)}
            className="mt-2 text-sm font-medium text-accent hover:underline"
          >
            Editar variante
          </button>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-secondary">Personalização</h3>
          {elements.length > 0 ? (
            <p className="text-text-primary">{elements.length} elemento(s) adicionado(s)</p>
          ) : (
            <p className="text-text-secondary">Nenhuma personalização adicionada</p>
          )}
          <button
            type="button"
            onClick={() => goToStep(3)}
            className="mt-2 text-sm font-medium text-accent hover:underline"
          >
            {elements.length > 0 ? 'Editar personalização' : 'Adicionar personalização'}
          </button>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-text-secondary">Quantidade</h3>
          <div className="flex w-fit items-center rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setQuantity(quantity - 1)}
              className="h-12 w-12 text-lg text-text-secondary hover:text-text-primary"
            >
              −
            </button>
            <span className="w-12 text-center font-semibold">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity(quantity + 1)}
              className="h-12 w-12 text-lg text-text-secondary hover:text-text-primary"
            >
              +
            </button>
          </div>
        </div>

        <div className="space-y-2 border-t border-border pt-6 text-sm">
          <div className="flex justify-between text-text-secondary">
            <span>Preço unitário</span>
            <span>{formatCurrency(product.price)}</span>
          </div>
          {fee > 0 && (
            <div className="flex justify-between text-text-secondary">
              <span>Taxa de personalização</span>
              <span>{formatCurrency(fee)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold text-text-primary">
            <span>Total</span>
            <span>{formatCurrency(lineTotal)}</span>
          </div>
        </div>

        {previewMode ? (
          // Prévia/teste dentro do painel — sem carrinho nem pedido.
          <div className="mt-2 flex flex-col gap-3">
            <p className="rounded-lg border border-border bg-bg px-4 py-3 text-sm text-text-secondary">
              Prévia de teste — nenhum pedido é criado. Use pra conferir o produto/modelos ou mostrar pro cliente.
            </p>
            <div className="flex justify-between text-sm">
              <button type="button" onClick={goBack} className="font-medium text-text-secondary hover:text-text-primary">
                Voltar
              </button>
              <button
                type="button"
                onClick={handleContinueShopping}
                className="font-medium text-accent hover:underline"
              >
                Recomeçar
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2 flex flex-col gap-3">
            <Button data-tour="add-carrinho" onClick={handleAddToCart} disabled={isAdding}>
              {isAdding ? 'Adicionando…' : 'Adicionar ao Carrinho'}
            </Button>
            <div className="flex justify-between text-sm">
              <button type="button" onClick={goBack} className="font-medium text-text-secondary hover:text-text-primary">
                Voltar
              </button>
              <button type="button" onClick={openDrawer} className="font-medium text-text-secondary hover:text-text-primary">
                Ver carrinho
              </button>
            </div>
            <button
              type="button"
              onClick={handleContinueShopping}
              className="text-center text-sm font-medium text-accent hover:underline"
            >
              Continuar comprando
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
