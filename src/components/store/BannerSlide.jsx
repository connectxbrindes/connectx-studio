import { Link } from 'react-router-dom';

// Cores dos banners de texto (layout "product").
export const BANNER_THEMES = {
  coral: {
    label: 'Coral claro',
    bg: 'bg-gradient-to-br from-[#fff1ec] to-[#ffd9cc]',
    eyebrow: 'text-accent',
    title: 'text-brand-dark',
    text: 'text-brand-dark/70',
  },
  blue: {
    label: 'Azul claro',
    bg: 'bg-gradient-to-br from-[#e8f5fb] to-[#cbe9f6]',
    eyebrow: 'text-brand',
    title: 'text-brand-dark',
    text: 'text-brand-dark/70',
  },
  dark: {
    label: 'Azul escuro',
    bg: 'bg-gradient-to-br from-brand-dark via-[#14506f] to-brand',
    eyebrow: 'text-accent',
    title: 'text-white',
    text: 'text-white/80',
  },
  light: {
    label: 'Cinza claro',
    bg: 'bg-bg',
    eyebrow: 'text-accent',
    title: 'text-brand-dark',
    text: 'text-text-secondary',
  },
};

/** Link que aceita rota da loja (/store/...), âncora (#produtos) ou site externo. */
export function SmartLink({ href, className, children, tabIndex, ariaLabel }) {
  if (!href) return <span className={className}>{children}</span>;
  if (/^https?:\/\//i.test(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className} tabIndex={tabIndex} aria-label={ariaLabel}>
        {children}
      </a>
    );
  }
  if (href.startsWith('#')) {
    return (
      <a href={href} className={className} tabIndex={tabIndex} aria-label={ariaLabel}>
        {children}
      </a>
    );
  }
  return (
    <Link to={href} className={className} tabIndex={tabIndex} aria-label={ariaLabel}>
      {children}
    </Link>
  );
}

/**
 * Um slide do banner da vitrine.
 * slide = { layout: 'image', image, mobileImage, href, title }
 *       | { layout: 'product', theme, eyebrow, title, text, cta, href, image }
 */
export default function BannerSlide({ slide, active = true }) {
  const tabIndex = active ? 0 : -1;

  if (slide.layout === 'image') {
    return (
      <SmartLink href={slide.href} tabIndex={tabIndex} ariaLabel={slide.title || 'Ver destaque'} className="block min-w-full">
        <picture>
          {slide.mobileImage && <source media="(max-width: 639px)" srcSet={slide.mobileImage} />}
          <img
            src={slide.image}
            alt={slide.title || ''}
            className="aspect-square w-full object-cover sm:aspect-[3/1]"
          />
        </picture>
      </SmartLink>
    );
  }

  const theme = BANNER_THEMES[slide.theme] || BANNER_THEMES.coral;
  return (
    <div className={`flex min-w-full flex-col-reverse items-center gap-4 px-6 py-8 sm:flex-row sm:px-14 sm:py-10 ${theme.bg}`}>
      <div className="flex-1 text-center sm:text-left">
        {slide.eyebrow && <p className={`mb-2 text-xs font-bold uppercase tracking-[0.2em] ${theme.eyebrow}`}>{slide.eyebrow}</p>}
        {slide.title && <h2 className={`text-3xl font-extrabold leading-tight sm:text-5xl ${theme.title}`}>{slide.title}</h2>}
        {slide.text && <p className={`mx-auto mt-3 max-w-md text-sm sm:mx-0 sm:text-base ${theme.text}`}>{slide.text}</p>}
        {slide.cta && (
          <SmartLink
            href={slide.href}
            tabIndex={tabIndex}
            className="mt-6 inline-flex rounded-full bg-accent px-7 py-3 text-sm font-bold text-white shadow-lg shadow-accent/30 transition-transform hover:scale-[1.03]"
          >
            {slide.cta}
          </SmartLink>
        )}
      </div>
      {slide.image && (
        <div className="flex h-44 w-44 flex-shrink-0 items-center justify-center rounded-full bg-white shadow-2xl sm:h-72 sm:w-72">
          <img src={slide.image} alt="" className="h-[78%] w-[78%] object-contain mix-blend-multiply" />
        </div>
      )}
    </div>
  );
}

/** Converte uma linha de store_banners no formato do slide. */
export const bannerToSlide = (b) => ({
  key: b.id,
  layout: b.layout,
  theme: b.theme,
  eyebrow: b.eyebrow,
  title: b.title,
  text: b.text,
  cta: b.cta_label,
  href: b.link,
  image: b.image_url,
  mobileImage: b.mobile_image_url,
});
