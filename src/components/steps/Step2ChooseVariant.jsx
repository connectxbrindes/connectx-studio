import { useEffect, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import Button from '../ui/Button';
import ProductPreview from '../shared/ProductPreview';

export default function Step2ChooseVariant() {
  const catalog = useStore((s) => s.catalog);
  const product = useStore((s) => s.selectedProduct);
  const selectedColor = useStore((s) => s.selectedColor);
  const selectedSize = useStore((s) => s.selectedSize);
  const modelBrands = useStore((s) => s.modelBrands);
  const selectedBrand = useStore((s) => s.selectedBrand);
  const selectedModel = useStore((s) => s.selectedModel);
  const selectProduct = useStore((s) => s.selectProduct);
  const selectColor = useStore((s) => s.selectColor);
  const selectSize = useStore((s) => s.selectSize);
  const selectBrand = useStore((s) => s.selectBrand);
  const selectModel = useStore((s) => s.selectModel);
  const elements = useStore((s) => s.elements);
  const goNext = useStore((s) => s.goNext);
  const goBack = useStore((s) => s.goBack);
  const canProceed = useStore((s) => s.canProceed());

  // Estoque é por Produto+Modelo — null/undefined quer dizer que ninguém
  // configurou estoque pra esse modelo ainda (não bloqueia, só sem controle).
  const isOutOfStock = (model) =>
    model.stockQuantity !== null && model.stockQuantity !== undefined && model.stockQuantity <= 0;
  const selectedModelOutOfStock = selectedModel ? isOutOfStock(selectedModel) : false;

  // Térmicos: estoque por cor. null/undefined = sem controle (não bloqueia).
  const isColorOutOfStock = (color) =>
    color.stockQuantity !== null && color.stockQuantity !== undefined && color.stockQuantity <= 0;
  const selectedColorOutOfStock = selectedColor ? isColorOutOfStock(selectedColor) : false;

  // Sem estoque não bloqueia — só avisa e pede confirmação (permite encomenda).
  const handleNext = () => {
    if (selectedModelOutOfStock || selectedColorOutOfStock) {
      const ok = window.confirm('Este produto não está disponível em estoque. Deseja continuar mesmo assim?');
      if (!ok) return;
    }
    goNext();
  };

  // Todos os produtos da mesma categoria escolhida no Passo 1 — quando há
  // mais de um, o cliente escolhe qual aqui, antes de marca/modelo/cor.
  const categoryProducts = useMemo(
    () => catalog.filter((p) => p.category?.id === product.category?.id),
    [catalog, product.category?.id]
  );

  // Modelos da marca selecionada (ou todos, se não há filtro de marca).
  const modelsForBrand = useMemo(
    () =>
      (product.options.models || []).filter((m) => !selectedBrand || m.brandId === selectedBrand.id),
    [product.options.models, selectedBrand]
  );

  // Pré-carrega mockup + máscara desses modelos pro cache do navegador — assim
  // trocar de modelo mostra a prévia na hora, sem o delay de baixar a imagem.
  useEffect(() => {
    for (const m of modelsForBrand) {
      for (const url of [m.mockupImageUrl, m.maskImageUrl]) {
        if (url) {
          const img = new Image();
          img.src = url;
        }
      }
    }
  }, [modelsForBrand]);

  return (
    <section className="grid grid-cols-1 overflow-hidden rounded-2xl lg:grid-cols-2">
      <ProductPreview
        bare
        product={product}
        color={selectedColor}
        model={selectedModel}
        elements={[]}
        className="min-h-[320px] lg:min-h-[560px]"
      />

      <div className="flex flex-col gap-8 bg-panel p-8 sm:p-10">
        <div className="border-b border-border pb-6">
          <h1 className="text-3xl font-bold">{product.name}</h1>
        </div>

        {categoryProducts.length > 1 && (
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-text-secondary">
              Tipo de Produto
            </h3>
            <div className="flex flex-wrap gap-3">
              {categoryProducts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectProduct(p.id)}
                  aria-pressed={product.id === p.id}
                  className={`rounded-full border px-6 py-3 font-medium transition-colors duration-200 ${
                    product.id === p.id
                      ? 'border-text-primary bg-text-primary text-white'
                      : 'border-border bg-white hover:border-text-primary'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {product.options.models && (
          <>
            {modelBrands.length > 1 && (
              <div>
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-text-secondary">
                  Marca do Aparelho
                </h3>
                <div className="flex flex-wrap gap-3">
                  {modelBrands.map((brand) => (
                    <button
                      key={brand.id}
                      type="button"
                      onClick={() => selectBrand(brand)}
                      aria-pressed={selectedBrand?.id === brand.id}
                      className={`rounded-full border px-6 py-3 font-medium transition-colors duration-200 ${
                        selectedBrand?.id === brand.id
                          ? 'border-text-primary bg-text-primary text-white'
                          : 'border-border bg-white hover:border-text-primary'
                      }`}
                    >
                      {brand.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-text-secondary">
                Modelo do Aparelho
              </h3>
              <select
                value={selectedModel?.id || ''}
                onChange={(e) =>
                  selectModel(product.options.models.find((m) => m.id === e.target.value))
                }
                className="w-full rounded-lg border border-border bg-white px-4 py-4 text-base outline-none transition-colors focus:border-text-primary"
              >
                {modelsForBrand.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                      {isOutOfStock(model) ? ' (Esgotado)' : ''}
                    </option>
                  ))}
              </select>
              {selectedModelOutOfStock && (
                <p className="mt-2 text-sm text-accent">Este produto não está disponível em estoque.</p>
              )}
            </div>
          </>
        )}

        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-text-secondary">
            Cor <span className="ml-2 font-medium normal-case text-text-primary">{selectedColor.name}</span>
          </h3>
          <div className="flex gap-4">
            {product.options.colors.map((color) => {
              const out = isColorOutOfStock(color);
              return (
                <button
                  key={color.id}
                  type="button"
                  aria-label={out ? `${color.name} (esgotado)` : color.name}
                  title={out ? `${color.name} — esgotado` : color.name}
                  aria-pressed={selectedColor.id === color.id}
                  onClick={() => selectColor(color)}
                  style={{ backgroundColor: color.hex }}
                  className={`h-12 w-12 rounded-full shadow transition-transform duration-200 hover:scale-110 ${
                    out ? 'opacity-40' : ''
                  } ${selectedColor.id === color.id ? 'ring-2 ring-text-primary ring-offset-2' : ''}`}
                />
              );
            })}
          </div>
          {selectedColorOutOfStock && (
            <p className="mt-2 text-sm text-accent">Esta cor não está disponível em estoque.</p>
          )}
        </div>

        {product.options.sizes && (
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-text-secondary">Tamanho</h3>
            <div className="flex gap-3">
              {product.options.sizes.map((size) => (
                <button
                  key={size.id}
                  type="button"
                  onClick={() => selectSize(size)}
                  aria-pressed={selectedSize?.id === size.id}
                  className={`rounded-full border px-6 py-3 font-medium transition-colors duration-200 ${
                    selectedSize?.id === size.id
                      ? 'border-text-primary bg-text-primary text-white'
                      : 'border-border bg-white hover:border-text-primary'
                  }`}
                >
                  {size.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-auto flex justify-between pt-6">
          <Button variant="secondary" onClick={goBack}>
            Voltar
          </Button>
          <Button onClick={handleNext} disabled={!canProceed}>
            Próximo
          </Button>
        </div>
      </div>
    </section>
  );
}
