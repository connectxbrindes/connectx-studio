import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { formatCurrency, storeUnitPrice } from '../../utils/price';
import { productImage } from '../../pages/store/useStoreSession';

/** Card de produto da vitrine: o card inteiro leva à página do produto.
 * Foto troca pela cor ao passar nas bolinhas; preço já com a personalização. */
export default function ProductCard({ product }) {
  const campaignProductIds = useStore((s) => s.campaignProductIds);
  const colors = product.options?.colors || [];
  const [color, setColor] = useState(colors[0] || null);
  const isGift = campaignProductIds.includes(product.id);
  const shown = colors.slice(0, 5);
  const href = `/store/p/${product.slug}`;
  const name = product.name.trim();

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-white transition-all hover:-translate-y-0.5 hover:border-brand-dark/20 hover:shadow-xl motion-reduce:transform-none">
      <div className="relative aspect-square bg-white">
        <img
          src={productImage(product, color)}
          alt={name}
          loading="lazy"
          className="h-full w-full object-contain p-[14%] transition-transform duration-300 group-hover:scale-105 motion-reduce:transform-none"
        />
        {isGift && (
          <span className="absolute left-3 top-3 rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
            Brinde da campanha
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 border-t border-border/60 p-4">
        {shown.length > 1 && (
          // z-10: as bolinhas ficam acima do link que cobre o card.
          <div className="relative z-10 mb-1 flex items-center gap-1.5">
            {shown.map((c) => (
              <button
                key={c.id}
                type="button"
                title={c.name}
                aria-label={`Ver cor ${c.name}`}
                onMouseEnter={() => setColor(c)}
                onFocus={() => setColor(c)}
                onClick={() => setColor(c)}
                className={`h-5 w-5 rounded-full border-2 ${color?.id === c.id ? 'border-brand-dark' : 'border-white ring-1 ring-border'}`}
                style={{ backgroundColor: c.hex || '#ddd' }}
              />
            ))}
            {colors.length > shown.length && <span className="text-xs text-text-secondary">+{colors.length - shown.length}</span>}
          </div>
        )}
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-brand-dark sm:text-[15px]">
          {/* O link cobre o card inteiro (after:inset-0). */}
          <Link to={href} className="after:absolute after:inset-0 after:content-[''] focus:outline-none">
            {name}
          </Link>
        </h3>
        <p className="mt-auto pt-1 text-lg font-extrabold text-brand-dark">{formatCurrency(storeUnitPrice(product))}</p>
        <p className="-mt-1 text-xs text-text-secondary">com a sua personalização</p>
        <span className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-accent">
          Personalizar
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </span>
      </div>
    </article>
  );
}
