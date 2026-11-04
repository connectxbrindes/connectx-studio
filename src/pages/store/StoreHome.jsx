import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { formatCurrency } from '../../utils/price';
import ProductCard from '../../components/store/ProductCard';
import { groupByCategory, productImage } from './useStoreSession';

function Spinner() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
    </div>
  );
}

/** Banner rotativo do topo, montado a partir do catálogo. */
function HeroCarousel({ slides }) {
  const [index, setIndex] = useState(0);
  const count = slides.length;

  useEffect(() => {
    if (count < 2) return undefined;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return undefined;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), 6000);
    return () => clearInterval(t);
  }, [count]);

  if (count === 0) return null;
  const go = (delta) => setIndex((i) => (i + delta + count) % count);

  return (
    <section className="relative mx-auto max-w-[1240px] px-4 pt-4 sm:px-6" aria-roledescription="carrossel" aria-label="Destaques">
      <div className="relative overflow-hidden rounded-3xl">
        <div className="flex transition-transform duration-700 ease-out motion-reduce:transition-none" style={{ transform: `translateX(-${index * 100}%)` }}>
          {slides.map((s, i) => (
            <div
              key={s.key}
              className={`flex min-w-full flex-col-reverse items-center gap-4 px-6 py-8 sm:flex-row sm:px-14 sm:py-10 ${s.bg}`}
              aria-hidden={i !== index}
            >
              <div className="flex-1 text-center sm:text-left">
                <p className={`mb-2 text-xs font-bold uppercase tracking-[0.2em] ${s.eyebrowClass}`}>{s.eyebrow}</p>
                <h2 className={`text-3xl font-extrabold leading-tight sm:text-5xl ${s.titleClass}`}>{s.title}</h2>
                <p className={`mt-3 max-w-md text-sm sm:text-base ${s.textClass} mx-auto sm:mx-0`}>{s.text}</p>
                <Link
                  to={s.href}
                  tabIndex={i === index ? 0 : -1}
                  className="mt-6 inline-flex rounded-full bg-accent px-7 py-3 text-sm font-bold text-white shadow-lg shadow-accent/30 transition-transform hover:scale-[1.03]"
                >
                  {s.cta}
                </Link>
              </div>
              <div className="flex h-44 w-44 flex-shrink-0 items-center justify-center rounded-full bg-white shadow-2xl sm:h-72 sm:w-72">
                {s.image && <img src={s.image} alt="" className="h-[78%] w-[78%] object-contain mix-blend-multiply" />}
              </div>
            </div>
          ))}
        </div>

        {count > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Destaque anterior" className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-brand-dark shadow sm:flex">‹</button>
            <button type="button" onClick={() => go(1)} aria-label="Próximo destaque" className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-brand-dark shadow sm:flex">›</button>
            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
              {slides.map((s, i) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Ir para o destaque ${i + 1}`}
                  className={`h-2 rounded-full transition-all ${i === index ? 'w-6 bg-accent' : 'w-2 bg-white/70'}`}
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
  ['🎨', 'Personalize do seu jeito', 'Foto, nome ou frase no Studio'],
  ['🏬', 'Retire grátis na loja', 'Sem custo de entrega'],
  ['📦', 'Ou receba em casa', 'Frete calculado pelo CEP'],
  ['🔒', 'Pagamento seguro', 'Pix, cartão ou boleto'],
];

export default function StoreHome() {
  const catalog = useStore((s) => s.catalog);
  const catalogLoaded = useStore((s) => s.catalogLoaded);
  const campaignProductIds = useStore((s) => s.campaignProductIds);
  const categories = useMemo(() => groupByCategory(catalog), [catalog]);
  const [tab, setTab] = useState('all');

  const gifts = catalog.filter((p) => campaignProductIds.includes(p.id));
  const featured = [...catalog].sort((a, b) => b.price - a.price)[0];

  const slides = useMemo(() => {
    const list = [];
    if (gifts[0]) {
      list.push({
        key: 'campanha',
        bg: 'bg-gradient-to-br from-brand-dark via-[#14506f] to-brand',
        eyebrow: 'Campanha nas lojas',
        eyebrowClass: 'text-accent',
        title: 'Ganhou um cartão? Seu brinde é personalizado!',
        titleClass: 'text-white',
        text: `Digite o código do cartão no carrinho e leve o ${gifts[0].name.trim()} com a sua arte, de graça.`,
        textClass: 'text-white/80',
        cta: 'Resgatar meu brinde',
        href: `/store/p/${gifts[0].slug}`,
        image: productImage(gifts[0]),
      });
    }
    if (featured) {
      list.push({
        key: 'destaque',
        bg: 'bg-gradient-to-br from-[#fff1ec] to-[#ffd9cc]',
        eyebrow: 'Feito pra você',
        eyebrowClass: 'text-accent',
        title: `${featured.name.trim()} com a sua cara`,
        titleClass: 'text-brand-dark',
        text: `Crie em minutos no nosso Studio. A partir de ${formatCurrency(featured.price)}.`,
        textClass: 'text-brand-dark/70',
        cta: 'Personalizar agora',
        href: `/store/p/${featured.slug}`,
        image: productImage(featured),
      });
    }
    const other = catalog.find((p) => p.id !== featured?.id && p.id !== gifts[0]?.id && productImage(p));
    if (other) {
      list.push({
        key: 'retirada',
        bg: 'bg-gradient-to-br from-[#e8f5fb] to-[#cbe9f6]',
        eyebrow: 'Sem custo de entrega',
        eyebrowClass: 'text-brand',
        title: 'Personalize online, retire grátis na loja',
        titleClass: 'text-brand-dark',
        text: 'Ou receba em casa pelos Correios, com o frete calculado pelo seu CEP.',
        textClass: 'text-brand-dark/70',
        cta: 'Ver produtos',
        href: '#produtos',
        image: productImage(other),
      });
    }
    return list;
  }, [catalog, gifts, featured]);

  if (!catalogLoaded) return <Spinner />;

  const tabProducts = tab === 'all' ? catalog : categories.find((c) => c.category.id === tab)?.products || [];

  return (
    <>
      <HeroCarousel slides={slides} />

      <section className="mx-auto mt-4 max-w-[1240px] px-4 sm:px-6">
        <ul className="grid grid-cols-2 gap-3 rounded-2xl bg-bg p-4 lg:grid-cols-4">
          {BENEFITS.map(([icon, title, text]) => (
            <li key={title} className="flex items-center gap-3">
              <span className="text-2xl" aria-hidden="true">{icon}</span>
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
          <ul className="flex justify-start gap-6 overflow-x-auto pb-2 sm:justify-center sm:gap-10">
            {categories.map(({ category, products }) => (
              <li key={category.id} className="flex-shrink-0">
                <Link to={`/store/c/${category.slug}`} className="group flex w-24 flex-col items-center gap-2 text-center sm:w-28">
                  <span className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#e8f5fb] to-[#ffe6de] ring-2 ring-transparent transition group-hover:ring-accent sm:h-28 sm:w-28">
                    <img src={productImage(products[0])} alt="" className="h-[72%] w-[72%] object-contain transition-transform group-hover:scale-110 mix-blend-multiply" />
                  </span>
                  <span className="text-sm font-semibold text-brand-dark">{category.name}</span>
                </Link>
              </li>
            ))}
            {gifts.length > 0 && (
              <li className="flex-shrink-0">
                <Link to="/store/campanha" className="group flex w-24 flex-col items-center gap-2 text-center sm:w-28">
                  <span className="flex h-24 w-24 items-center justify-center rounded-full bg-accent text-4xl ring-2 ring-transparent transition group-hover:ring-brand-dark sm:h-28 sm:w-28">🎁</span>
                  <span className="text-sm font-semibold text-accent">Resgatar brinde</span>
                </Link>
              </li>
            )}
          </ul>
        </section>
      )}

      <section id="produtos" className="mx-auto mt-12 max-w-[1240px] scroll-mt-32 px-4 sm:px-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-2xl font-extrabold text-brand-dark sm:text-3xl">Escolha o seu e personalize</h2>
        </div>
        <div className="mb-6 flex gap-2 overflow-x-auto pb-1" role="tablist">
          {[{ id: 'all', name: 'Todos' }, ...categories.map((c) => c.category)].map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={tab === c.id}
              onClick={() => setTab(c.id)}
              className={`flex-shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                tab === c.id ? 'border-brand-dark bg-brand-dark text-white' : 'border-border text-brand-dark hover:border-brand-dark'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
          {tabProducts.map((p) => (
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
              <span className="flex h-64 w-64 items-center justify-center rounded-full bg-white shadow-2xl">
                <img src={productImage(gifts[0])} alt="" className="h-[78%] w-[78%] object-contain mix-blend-multiply" />
              </span>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
