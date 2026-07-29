import { useStore } from '../../store/useStore';
import { useMemo } from 'react';

export default function Step1ChooseProduct() {
  const catalog = useStore((s) => s.catalog);
  const selectedProduct = useStore((s) => s.selectedProduct);
  const selectProduct = useStore((s) => s.selectProduct);
  const goNext = useStore((s) => s.goNext);

  // Um card por categoria (não por produto) — diferenciar entre produtos da
  // mesma categoria (ex: marca/modelo de capa, ou um novo tipo de capa) é
  // responsabilidade do Passo 2, não deste passo.
  const categories = useMemo(() => {
    return catalog.reduce((groups, product) => {
      if (!product.category) return groups;
      const existing = groups.find((group) => group.category.id === product.category.id);
      if (existing) {
        existing.products.push(product);
      } else {
        groups.push({ category: product.category, products: [product] });
      }
      return groups;
    }, []);
  }, [catalog]);

  return (
    <section>
      <h1 className="mb-2 text-3xl font-bold">Escolha um produto</h1>
      <p className="mb-8 text-text-secondary">Selecione a categoria que você quer personalizar.</p>

      {categories.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-border text-text-secondary">
          Nenhum produto disponível no momento.
        </div>
      ) : (
        <div data-tour="produto" className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map(({ category, products: categoryProducts }) => {
            const representativeProduct = categoryProducts[0];
            const isSelected = selectedProduct?.category?.id === category.id;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => {
                  selectProduct(representativeProduct.id);
                  goNext();
                }}
                aria-pressed={isSelected}
                className={`group flex flex-col items-center rounded-2xl border bg-panel p-6 text-left shadow-sm transition-all duration-200 hover:shadow-md ${
                  isSelected ? 'border-accent ring-2 ring-accent/30' : 'border-border'
                }`}
              >
                <div className="mb-4 flex h-40 w-full items-center justify-center rounded-xl bg-bg">
                  <img
                    src={representativeProduct.image}
                    alt={category.name}
                    className="max-h-32 max-w-[80%] object-contain transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <h3 className="text-lg font-semibold">{category.name}</h3>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
