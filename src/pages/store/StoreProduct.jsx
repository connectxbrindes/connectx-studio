import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { formatCurrency, PERSONALIZATION_FEE } from '../../utils/price';
import ProductCard from '../../components/store/ProductCard';
import { productImage } from './useStoreSession';

/** Página do produto: fotos por cor, preço, descrição e botão Personalizar
 * (abre o Studio já com o produto e a cor escolhidos). */
export default function StoreProduct() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const catalog = useStore((s) => s.catalog);
  const catalogLoaded = useStore((s) => s.catalogLoaded);
  const campaignProductIds = useStore((s) => s.campaignProductIds);
  const product = catalog.find((p) => p.slug === slug);
  const colors = product?.options?.colors || [];
  const [colorId, setColorId] = useState(null);
  const color = colors.find((c) => c.id === colorId) || colors[0] || null;

  useEffect(() => {
    setColorId(null);
    if (product) document.title = `${product.name.trim()} personalizado — ConnectX Brindes`;
  }, [product]);

  if (!catalogLoaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-[1240px] px-4 py-20 text-center">
        <p className="text-text-secondary">Produto não encontrado.</p>
        <Link to="/store" className="mt-4 inline-block font-semibold text-accent">Voltar para a loja</Link>
      </div>
    );
  }

  const isGift = campaignProductIds.includes(product.id);
  const outOfStock = color?.stockQuantity === 0;
  const thumbs = colors.filter((c) => c.image);
  const related = catalog.filter((p) => p.id !== product.id).slice(0, 4);

  const personalize = () =>
    navigate(`/store/personalizar?produto=${product.slug}${color ? `&cor=${color.id}` : ''}`);

  return (
    <>
      <section className="mx-auto max-w-[1240px] px-4 pt-6 sm:px-6">
        <nav className="mb-6 text-xs text-text-secondary" aria-label="Você está em">
          <Link to="/store" className="hover:text-brand">Início</Link>
          {product.category && (
            <>
              {' '}<span aria-hidden="true">›</span>{' '}
              <Link to={`/store/c/${product.category.slug}`} className="hover:text-brand">{product.category.name}</Link>
            </>
          )}
          {' '}<span aria-hidden="true">›</span> <span>{product.name.trim()}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
          <div className="flex flex-col gap-3">
            <div className="relative flex aspect-square items-center justify-center rounded-3xl bg-bg">
              <img src={productImage(product, color)} alt={`${product.name} ${color?.name || ''}`} className="max-h-[80%] max-w-[80%] object-contain mix-blend-multiply" />
              {isGift && (
                <span className="absolute left-4 top-4 rounded-full bg-accent px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                  Brinde da campanha
                </span>
              )}
            </div>
            {thumbs.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {thumbs.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setColorId(c.id)}
                    aria-label={`Ver ${c.name}`}
                    className={`h-20 w-20 flex-shrink-0 rounded-xl bg-bg p-2 ring-2 ${color?.id === c.id ? 'ring-brand-dark' : 'ring-transparent'}`}
                  >
                    <img src={c.image} alt="" className="h-full w-full object-contain mix-blend-multiply" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-5">
            <div>
              {product.category && <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">{product.category.name}</p>}
              <h1 className="mt-1 text-3xl font-extrabold text-brand-dark sm:text-4xl">{product.name.trim()}</h1>
            </div>

            <div>
              <p className="text-3xl font-extrabold text-brand-dark">{formatCurrency(product.price)}</p>
              <p className="text-sm text-text-secondary">+ {formatCurrency(PERSONALIZATION_FEE)} da personalização (foto, nome ou frase)</p>
            </div>

            {isGift && (
              <div className="rounded-2xl border border-accent/30 bg-[#fff4f0] p-4 text-sm">
                <p className="font-bold text-accent">🎁 Tem o cartão da campanha?</p>
                <p className="mt-1 text-brand-dark/80">
                  Personalize e digite o código do cartão no carrinho: 1 unidade sai grátis e os outros produtos do pedido ganham 10% de desconto.
                </p>
              </div>
            )}

            {colors.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-semibold text-brand-dark">
                  Cor: <span className="font-normal text-text-secondary">{color?.name}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {colors.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      title={c.name}
                      aria-label={c.name}
                      aria-pressed={color?.id === c.id}
                      onClick={() => setColorId(c.id)}
                      className={`h-9 w-9 rounded-full border-[3px] ${color?.id === c.id ? 'border-brand-dark' : 'border-white ring-1 ring-border'} ${c.stockQuantity === 0 ? 'opacity-40' : ''}`}
                      style={{ backgroundColor: c.hex || '#ddd' }}
                    />
                  ))}
                </div>
                {outOfStock && <p className="mt-2 text-xs text-accent">Esta cor está sem estoque no momento.</p>}
              </div>
            )}

            <button
              type="button"
              onClick={personalize}
              className="rounded-full bg-accent px-8 py-4 text-base font-bold text-white shadow-lg shadow-accent/30 transition-transform hover:scale-[1.01]"
            >
              🎨 Personalizar este produto
            </button>
            {product.minOrderQty > 1 && (
              <p className="-mt-3 text-center text-xs text-text-secondary">Pedido mínimo: {product.minOrderQty} unidades</p>
            )}

            <ul className="grid grid-cols-1 gap-2 rounded-2xl bg-bg p-4 text-sm text-brand-dark sm:grid-cols-2">
              <li>🏬 Retirada grátis na loja</li>
              <li>📦 Entrega pelos Correios</li>
              <li>🖼️ Veja a prévia antes de comprar</li>
              <li>🔒 Pix, cartão ou boleto</li>
            </ul>

            {product.description && (
              <div>
                <h2 className="mb-2 text-sm font-bold text-brand-dark">Sobre o produto</h2>
                <p className="whitespace-pre-line text-sm leading-relaxed text-text-secondary">{product.description}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="mx-auto mt-16 max-w-[1240px] px-4 sm:px-6">
          <h2 className="mb-5 text-2xl font-extrabold text-brand-dark">Você também pode gostar</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
