import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { ChevronLeft, ChevronRight, Gift, Palette, ShieldCheck, Store, Truck } from 'lucide-react';
import { formatCurrency, storeUnitPrice } from '../../utils/price';
import ProductCard from '../../components/store/ProductCard';
import BannerSlide, { bannerToSlide } from '../../components/store/BannerSlide';
import { fetchPublicBanners } from '../../lib/storeApi';
import { groupByCategory, productImage } from './useStoreSession';

function Spinner() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
    </div>
  );
}

/** Banner rotativo do topo. */
function HeroCarousel({ slides }) {
  const [index, setIndex] = useState(0);
  const count = slides.length;

  useEffect(() => {
    setIndex(0);
  }, [count]);

  useEffect(() => {
    if (count < 2) return undefined;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return undefined;
    // Recomeça a contagem a cada troca (inclusive manual), pra não pular logo depois de um clique.
    const t = setTimeout(() => setIndex((i) => (i + 1) % count), 6000);
    return () => clearTimeout(t);
  }, [count, index]);

  if (count === 0) return null;
  const go = (delta) => setIndex((i) => (i + delta + count) % count);

  return (
    <section className="relative mx-auto max-w-[1240px] px-4 pt-4 sm:px-6" aria-roledescription="carrossel" aria-label="Destaques">
      <div className="relative overflow-hidden rounded-3xl">
        <div className="flex transition-transform duration-700 ease-out motion-reduce:transition-none" style={{ transform: `translateX(-${index * 100}%)` }}>
          {slides.map((s, i) => (
            <div key={s.key} className="min-w-full" aria-hidden={i !== index}>
              <BannerSlide slide={s} active={i === index} />
            </div>
          ))}
        </div>

        {count > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Destaque anterior" className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-brand-dark shadow sm:flex"><ChevronLeft className="h-5 w-5" /></button>
            <button type="button" onClick={() => go(1)} aria-label="Próximo destaque" className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-brand-dark shadow sm:flex"><ChevronRight className="h-5 w-5" /></button>
            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
              {slides.map((s, i) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Ir para o destaque ${i + 1}`}
                  className={`h-2 rounded-full shadow transition-all ${i === index ? 'w-6 bg-accent' : 'w-2 bg-white/80'}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

const BENEFITS = [
  [Palette, 'Personalize do seu jeito', 'Foto, nome ou frase no Studio'],
  [Store, 'Retire grátis na loja', 'Sem custo de entrega'],
  [Truck, 'Ou receba em casa', 'Frete calculado pelo CEP'],
  [ShieldCheck, 'Pagamento seguro', 'Pix, cartão ou boleto'],
];

export default function StoreHome() {
  const catalog = useStore((s) => s.catalog);
  const catalogLoaded = useStore((s) => s.catalogLoaded);
  const campaignProductIds = useStore((s) => s.campaignProductIds);
  const categories = useMemo(() => groupByCategory(catalog), [catalog]);

  const [banners, setBanners] = useState(null); // null = carregando
  const gifts = useMemo(() => catalog.filter((p) => campaignProductIds.includes(p.id)), [catalog, campaignProductIds]);

  useEffect(() => {
    fetchPublicBanners().then(setBanners);
  }, []);

  // Banners cadastrados no Painel; sem nenhum ativo, monta destaques
  // automáticos a partir do catálogo.
  const slides = useMemo(() => {
    if (banners === null) return [];
    if (banners.length > 0) return banners.map(bannerToSlide);
    const list = [];
    const featured = [...catalog].sort((a, b) => b.price - a.price)[0];
    if (gifts[0]) {
      list.push({
        key: 'campanha',
        layout: 'product',
        theme: 'dark',
        eyebrow: 'Campanha nas lojas',
        title: 'Ganhou um cartão? Seu brinde é personalizado!',
        text: `Digite o código do cartão no carrinho e leve o ${gifts[0].name.trim()} com a sua arte, de graça.`,
        cta: 'Resgatar meu brinde',
        href: `/store/p/${gifts[0].slug}`,
        image: productImage(gifts[0]),
      });
    }
    if (featured) {
      list.push({
        key: 'destaque',
        layout: 'product',
        theme: 'coral',
        eyebrow: 'Feito pra você',
        title: `${featured.name.trim()} com a sua cara`,
        text: `Crie em minutos no nosso Studio. ${formatCurrency(storeUnitPrice(featured))} já com a sua personalização.`,
        cta: 'Personalizar agora',
        href: `/store/p/${featured.slug}`,
        image: productImage(featured),
      });
    }
    const other = catalog.find((p) => p.id !== featured?.id && p.id !== gifts[0]?.id && productImage(p));
    if (other) {
      list.push({
        key: 'retirada',
        layout: 'product',
        theme: 'blue',
        eyebrow: 'Sem custo de entrega',
        title: 'Personalize online, retire grátis na loja',
        text: 'Ou receba em casa pelos Correios, com o frete calculado pelo seu CEP.',
        cta: 'Ver produtos',
        href: '#produtos',
        image: productImage(other),
      });
    }
    return list;
  }, [banners, catalog, gifts]);

  if (!catalogLoaded) return <Spinner />;

  // 4 colunas só quando fecha as linhas; senão 3 (evita a última linha pela metade).
  const gridCols = catalog.length % 4 === 0 || catalog.length > 12 ? 'lg:grid-cols-4' : 'lg:grid-cols-3';

  return (
    <>
      <HeroCarousel slides={slides} />

      <section className="mx-auto mt-4 max-w-[1240px] px-4 sm:px-6">
        <ul className="grid grid-cols-2 gap-x-3 gap-y-4 rounded-2xl border border-border p-4 sm:p-5 lg:grid-cols-4">
          {BENEFITS.map(([Icon, title, text]) => (
            <li key={title} className="flex items-center gap-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#fff1ec] text-accent" aria-hidden="true">
                <Icon className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <span>
                <span className="block text-sm font-bold text-brand-dark">{title}</span>
                <span className="block text-xs text-text-secondary">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {categories.length > 0 && (
        <section className="mx-auto mt-10 max-w-[1240px] px-4 sm:px-6" aria-label="Categorias">
          <ul className="no-scrollbar -mx-4 flex justify-start gap-5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:justify-center sm:gap-10 sm:px-0">
            {categories.map(({ category, products }) => (
              <li key={category.id} className="flex-shrink-0">
                <Link to={`/store/c/${category.slug}`} className="group flex w-24 flex-col items-center gap-2 text-center sm:w-28">
                  <span className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-bg ring-2 ring-transparent transition group-hover:ring-accent sm:h-28 sm:w-28">
                    <img src={productImage(products[0])} alt="" className="h-[72%] w-[72%] object-contain transition-transform group-hover:scale-110 mix-blend-multiply" />
                  </span>
                  <span className="text-sm font-semibold text-brand-dark">{category.name}</span>
                </Link>
              </li>
            ))}
            {gifts.length > 0 && (
              <li className="flex-shrink-0">
                <Link to="/store/campanha" className="group flex w-24 flex-col items-center gap-2 text-center sm:w-28">
                  <span className="flex h-24 w-24 items-center justify-center rounded-full bg-accent text-white ring-2 ring-transparent transition group-hover:ring-brand-dark sm:h-28 sm:w-28"><Gift className="h-10 w-10" strokeWidth={1.6} aria-hidden="true" /></span>
                  <span className="text-sm font-semibold text-accent">Resgatar brinde</span>
                </Link>
              </li>
            )}
          </ul>
        </section>
      )}

      <section id="produtos" className="mx-auto mt-14 max-w-[1240px] scroll-mt-32 px-4 sm:px-6">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-brand-dark sm:text-3xl">Escolha o seu e personalize</h2>
            <p className="mt-1 text-sm text-text-secondary">Preços já com a personalização inclusa.</p>
          </div>
        </div>
        <div className={`grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 ${gridCols}`}>
          {catalog.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {gifts.length > 0 && (
        <section className="mx-auto mt-16 max-w-[1240px] px-4 sm:px-6">
          <div className="grid items-center gap-8 overflow-hidden rounded-3xl bg-brand-dark p-8 text-white sm:grid-cols-2 sm:p-12">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Campanha nas lojas</p>
              <h2 className="mt-2 text-3xl font-extrabold">Seu cartão vale um brinde personalizado</h2>
              <ol className="mt-6 flex flex-col gap-4 text-sm text-white/80">
                {[
                  `Escolha o ${gifts.map((g) => g.name.trim()).join(' ou ')} e personalize no Studio.`,
                  'No carrinho, digite o código impresso no seu cartão.',
                  'Pronto: 1 unidade sai de graça — e qualquer outro produto ganha 10% de desconto.',
                ].map((step, i) => (
                  <li key={step} className="flex gap-3">
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">{i + 1}</span>
                    <span className="pt-1">{step}</span>
                  </li>
                ))}
              </ol>
              <Link to="/store/campanha" className="mt-8 inline-flex rounded-full bg-accent px-7 py-3 text-sm font-bold text-white">
                Resgatar meu brinde
              </Link>
            </div>
            <div className="flex justify-center">
              <span className="flex h-52 w-52 items-center justify-center rounded-full bg-white shadow-2xl sm:h-64 sm:w-64">
                <img src={productImage(gifts[0])} alt="" className="h-[78%] w-[78%] object-contain mix-blend-multiply" />
              </span>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
