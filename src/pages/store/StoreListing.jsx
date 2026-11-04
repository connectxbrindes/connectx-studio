import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import ProductCard from '../../components/store/ProductCard';

const normalize = (s) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Lista de produtos: por categoria (/store/c/:slug), busca (/store/busca?q=)
 * ou só os brindes da campanha (/store/campanha). */
export default function StoreListing({ mode }) {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const catalog = useStore((s) => s.catalog);
  const catalogLoaded = useStore((s) => s.catalogLoaded);
  const campaignProductIds = useStore((s) => s.campaignProductIds);

  let title = '';
  let subtitle = '';
  let products = catalog;
  if (mode === 'category') {
    products = catalog.filter((p) => p.category?.slug === slug);
    title = products[0]?.category?.name || 'Categoria';
    subtitle = `${products.length} ${products.length === 1 ? 'produto' : 'produtos'} para personalizar`;
  } else if (mode === 'search') {
    const q = params.get('q') || '';
    const nq = normalize(q);
    products = catalog.filter((p) => normalize(`${p.name} ${p.category?.name} ${p.description}`).includes(nq));
    title = q ? `Resultados para “${q}”` : 'Todos os produtos';
    subtitle = `${products.length} ${products.length === 1 ? 'produto encontrado' : 'produtos encontrados'}`;
  } else if (mode === 'campaign') {
    products = catalog.filter((p) => campaignProductIds.includes(p.id));
    title = 'Resgate seu brinde';
    subtitle =
      'Escolha o produto, personalize no Studio e, no carrinho, digite o código do seu cartão. 1 unidade sai grátis e os outros produtos do pedido ganham 10% de desconto.';
  }

  return (
    <section className="mx-auto max-w-[1240px] px-4 pt-6 sm:px-6">
      <nav className="mb-4 text-xs text-text-secondary" aria-label="Você está em">
        <Link to="/store" className="hover:text-brand">Início</Link> <span aria-hidden="true">›</span> <span>{title}</span>
      </nav>
      <h1 className="text-2xl font-extrabold text-brand-dark sm:text-3xl">{title}</h1>
      <p className="mt-1 max-w-2xl text-sm text-text-secondary">{subtitle}</p>

      {!catalogLoaded ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
        </div>
      ) : products.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border p-10 text-center text-text-secondary">
          {mode === 'campaign' ? 'Nenhum brinde ativo no momento.' : 'Nenhum produto encontrado.'}{' '}
          <Link to="/store" className="font-semibold text-accent">Ver todos os produtos</Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </section>
  );
}
