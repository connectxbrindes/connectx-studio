import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { formatCurrency } from '../../utils/price';
import { productImage } from '../../pages/store/useStoreSession';

/** Card de produto da vitrine: foto (troca pela cor ao passar nas bolinhas),
 * nome, preço e atalho pra personalizar. */
export default function ProductCard({ product }) {
  const campaignProductIds = useStore((s) => s.campaignProductIds);
  const colors = product.options?.colors || [];
  const [color, setColor] = useState(colors[0] || null);
  const isGift = campaignProductIds.includes(product.id);
  const shown = colors.slice(0, 5);
  const href = `/store/p/${product.slug}`;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-white transition-shadow hover:shadow-lg">
      <Link to={href} className="relative block aspect-square bg-bg">
        <img
          src={productImage(product, color)}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-contain p-6 transition-transform duration-300 group-hover:scale-105 mix-blend-multiply"
        />
        {isGift && (
          <span className="absolute left-3 top-3 rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
            Brinde da campanha
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {shown.length > 1 && (
          <div className="flex items-center gap-1.5">
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
        <Link to={href} className="line-clamp-2 text-sm font-semibold text-brand-dark hover:text-brand">
          {product.name.trim()}
        </Link>
        <p className="text-xs text-text-secondary">a partir de</p>
        <p className="-mt-2 text-lg font-extrabold text-brand-dark">{formatCurrency(product.price)}</p>
        <Link
          to={`/store/personalizar?produto=${product.slug}${color ? `&cor=${color.id}` : ''}`}
          className="mt-auto rounded-full bg-accent px-4 py-2.5 text-center text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          Personalizar
        </Link>
      </div>
    </article>
  );
}
