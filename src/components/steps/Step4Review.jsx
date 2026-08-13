import { useRef, useState } from 'react';
import { useStore } from '../../store/useStore';
import { formatCurrency, computePersonalizationFee, computeLineTotal } from '../../utils/price';
import { useCanvasExport } from '../../hooks/useCanvasExport';
import Button from '../ui/Button';
import ProductPreview from '../shared/ProductPreview';
import Viewer3D from '../shared/Viewer3D';

/**
 * Compara dois arrays de elementos de personalização para ver se são idênticos.
 * Ignora campos efêmeros (id, zIndex) e compara apenas o que importa visualmente.
 */
function areElementsIdentical(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const elA = a[i];
    const elB = b[i];
    if (elA.type !== elB.type) return false;
    if (elA.type === 'image') {
      if (elA.src !== elB.src) return false;
    } else if (elA.type === 'text') {
      if (elA.content !== elB.content || elA.fontFamily !== elB.fontFamily || elA.color !== elB.color) return false;
    }
    // Posição e tamanho (tolerância de 0.5% para evitar falsos negativos por arredondamento)
    if (
      Math.abs(elA.x - elB.x) > 0.5 ||
      Math.abs(elA.y - elB.y) > 0.5 ||
      Math.abs(elA.width - elB.width) > 0.5 ||
      Math.abs(elA.height - elB.height) > 0.5 ||
      Math.abs(elA.rotation - elB.rotation) > 0.5
    ) return false;
  }
  return true;
}

/**
 * Verifica se um item idêntico já existe no carrinho.
 */
function findDuplicateInCart(cartItems, { productId, colorId, sizeId, modelId, elements }) {
  return cartItems.find((item) =>
    item.productId === productId &&
    item.colorId === colorId &&
    item.sizeId === sizeId &&
    item.modelId === modelId &&
    areElementsIdentical(item.elements || [], elements || [])
  );
}

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
  const hidePrices = useStore((s) => s.identity?.hidePrices);
  const cartItems = useStore((s) => s.items);
  const { exportCanvas } = useCanvasExport();
  const previewRef = useRef(null);
  const [isAdding, setIsAdding] = useState(false);
  const [viewMode, setViewMode] = useState('2d');
  const [texture3d, setTexture3d] = useState(null);
  const [loading3d, setLoading3d] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  const handleShow3d = async () => {
    if (!texture3d) {
      setLoading3d(true);
      const box = previewRef.current?.getBoundingClientRect();
      const png = await exportCanvas({
        product, color, model, elements,
        width: box?.width, height: box?.height,
      });
      setTexture3d(png);
      setLoading3d(false);
    }
    setViewMode('3d');
  };

  const fee = computePersonalizationFee(elements);
  const lineTotal = computeLineTotal({ unitPrice: product.price, quantity, elements });

  /** Executa a adição ao carrinho de fato (sem verificação de duplicata). */
  const doAddToCart = async () => {
    setIsAdding(true);
    const box = previewRef.current?.getBoundingClientRect();
    const thumbnail = await exportCanvas({
      product, color, model, elements,
      width: box?.width, height: box?.height,
    });
    const artImage = await exportCanvas({
      product, color, model, elements,
      width: box?.width, height: box?.height,
      artOnly: true,
    });
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
    openDrawer();
  };

  /** Ao clicar em "Adicionar ao Carrinho", verifica se já existe item idêntico. */
  const handleAddToCart = async () => {
    const duplicate = findDuplicateInCart(cartItems, {
      productId: product.id,
      colorId: color.id,
      sizeId: size?.id,
      modelId: model?.id,
      elements,
    });

    if (duplicate) {
      setShowDuplicateModal(true);
    } else {
      await doAddToCart();
    }
  };

  const handleConfirmDuplicate = async () => {
    setShowDuplicateModal(false);
    await doAddToCart();
  };

  const handleCancelDuplicate = () => {
    setShowDuplicateModal(false);
  };

  const handleContinueShopping = () => {
    resetConfigurator();
    resetWizard();
  };

  return (
    <>
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

          {!hidePrices && (
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
          )}

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

      {/* ── Modal de confirmação de item duplicado ────────────────────── */}
      {showDuplicateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md animate-fade-in rounded-2xl bg-panel p-8 shadow-2xl">
            {/* Ícone de alerta */}
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
              <svg className="h-7 w-7 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>

            <h3 className="mb-2 text-center text-lg font-bold text-text-primary">
              Produto já adicionado
            </h3>
            <p className="mb-6 text-center text-sm leading-relaxed text-text-secondary">
              Este item com a mesma personalização já está no seu carrinho.
              O que você deseja fazer?
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setShowDuplicateModal(false); openDrawer(); }}
                className="flex-1 rounded-xl border border-border px-4 py-3 text-sm font-semibold text-text-secondary transition-colors hover:bg-bg"
              >
                Ir para o carrinho
              </button>
              <button
                type="button"
                onClick={handleConfirmDuplicate}
                disabled={isAdding}
                className="flex-1 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
              >
                {isAdding ? 'Adicionando…' : 'Adicionar mais um'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
