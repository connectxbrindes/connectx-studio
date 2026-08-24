import { useState, useEffect, useCallback } from 'react';

const PRODUCTS = [
  {
    src: '/CUIA.webp',
    bg: '#2C3E6B',
    name: 'Copo Cuia 360ml',
    label: 'CUIA',
    desc: 'Aço inox, térmico com parede dupla isolada a vácuo e acabamento mate.',
  },
  {
    src: '/COPO.webp',
    bg: '#C17D4A',
    name: 'Copo 476ml',
    label: 'COPO',
    desc: 'Aço inox térmico, com parede dupla isolada a vácuo, preservando as suas bebidas frias ou quentes. A tampa inclui um abridor de garrafas.',
  },
  {
    src: '/CANETA.webp',
    bg: '#3D3D3D',
    name: 'Caneta Metálica',
    label: 'CANETA',
    desc: 'Caneta esferográfica em alumínio com acabamento metalizado.',
  },
  {
    src: '/GARRAFA.webp',
    bg: '#5B7A5E',
    name: 'Garrafa com Led',
    label: 'GARRAFA',
    desc: 'Sensor de Temperatura Digital é uma opção prática, abertura automática com apenas um click.',
  },
  {
    src: '/CAPA.webp',
    bg: '#6B5B7B',
    name: 'Capa Personalizada',
    label: 'CAPA',
    desc: 'TPU transparente e maleável. Impressão UV.',
  },
  {
    src: '/ABRIDOR.webp',
    bg: '#8B4455',
    name: 'Chaveiro Abridor',
    label: 'ABRIDOR',
    desc: 'Chaveiro em alumínio com abridor de garrafas.',
  },
];

const TOTAL = PRODUCTS.length;

const GRAIN_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.08'/%3E%3C/svg%3E")`;

const DUR = 650;
const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';

/* ── Pure-SVG arrows (no lucide dependency) ── */
function ArrowLeftIcon({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function ArrowRightIcon({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

export default function Apresentacao() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 640 : false);
  const [hoverPrev, setHoverPrev] = useState(false);
  const [hoverNext, setHoverNext] = useState(false);
  const [hoverCta, setHoverCta] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    PRODUCTS.forEach((p) => {
      const img = new Image();
      img.src = p.src;
    });
  }, []);

  const navigate = useCallback(
    (dir) => {
      if (isAnimating) return;
      setIsAnimating(true);
      setActiveIndex((prev) =>
        dir === 'next' ? (prev + 1) % TOTAL : (prev + TOTAL - 1) % TOTAL
      );
      setTimeout(() => setIsAnimating(false), DUR);
    },
    [isAnimating]
  );

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowLeft') navigate('prev');
      if (e.key === 'ArrowRight') navigate('next');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  useEffect(() => {
    let startX = 0;
    const onStart = (e) => { startX = e.touches[0].clientX; };
    const onEnd = (e) => {
      const diff = startX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) navigate(diff > 0 ? 'next' : 'prev');
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchend', onEnd);
    };
  }, [navigate]);

  const center = activeIndex;
  const left = (activeIndex + TOTAL - 1) % TOTAL;
  const right = (activeIndex + 1) % TOTAL;

  const trans = `transform ${DUR}ms ${EASE}, filter ${DUR}ms ${EASE}, opacity ${DUR}ms ${EASE}, left ${DUR}ms ${EASE}, bottom ${DUR}ms ${EASE}, height ${DUR}ms ${EASE}`;

  const getRoleStyle = (idx) => {
    if (idx === center) {
      return {
        transform: `translateX(-50%) scale(${isMobile ? 1.35 : 1.55})`,
        filter: 'blur(0px)', opacity: 1, zIndex: 20,
        left: '50%', height: isMobile ? '72%' : '82%',
        bottom: isMobile ? '28%' : '30%',
        transition: trans, willChange: 'transform, filter, opacity',
      };
    }
    if (idx === left) {
      return {
        transform: 'translateX(-50%) scale(1)',
        filter: 'blur(2px)', opacity: 0.85, zIndex: 10,
        left: isMobile ? '16%' : '26%', height: isMobile ? '32%' : '42%',
        bottom: isMobile ? '24%' : '18%',
        transition: trans, willChange: 'transform, filter, opacity',
      };
    }
    if (idx === right) {
      return {
        transform: 'translateX(-50%) scale(1)',
        filter: 'blur(2px)', opacity: 0.85, zIndex: 10,
        left: isMobile ? '84%' : '74%', height: isMobile ? '32%' : '42%',
        bottom: isMobile ? '24%' : '18%',
        transition: trans, willChange: 'transform, filter, opacity',
      };
    }
    // All other items are hidden off-screen
    return {
      transform: 'translateX(-50%) scale(0.8)',
      filter: 'blur(6px)', opacity: 0, zIndex: 1,
      left: '50%', height: isMobile ? '18%' : '30%',
      bottom: isMobile ? '24%' : '14%',
      pointerEvents: 'none',
      transition: trans, willChange: 'transform, filter, opacity',
    };
  };

  const cur = PRODUCTS[activeIndex];

  const btnBase = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: '50%', cursor: 'pointer',
    width: isMobile ? 48 : 64, height: isMobile ? 48 : 64,
    border: '2px solid rgba(255,255,255,0.7)', color: 'white',
    transition: 'transform 150ms, background-color 150ms',
    outline: 'none', padding: 0,
  };

  return (
    <div
      style={{
        position: 'relative', width: '100%', height: '100vh', overflow: 'hidden',
        backgroundColor: cur.bg,
        transition: `background-color ${DUR}ms ${EASE}`,
        fontFamily: "'Inter', sans-serif",
        margin: 0, padding: 0,
      }}
    >
      <div style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden' }}>

        {/* ── Grain overlay ── */}
        <div
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 50,
            opacity: 0.4, backgroundImage: GRAIN_SVG,
            backgroundSize: '200px 200px', backgroundRepeat: 'repeat',
          }}
        />

        {/* ── Giant ghost text ── */}
        <div
          style={{
            position: 'absolute', left: 0, right: 0, top: isMobile ? '32%' : '18%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none', userSelect: 'none', zIndex: 2,
          }}
        >
          <span
            style={{
              fontFamily: "'Anton', sans-serif",
              fontSize: 'clamp(90px, 28vw, 380px)',
              fontWeight: 900, color: 'white', opacity: 0.12,
              lineHeight: 1, textTransform: 'uppercase',
              letterSpacing: '-0.02em', whiteSpace: 'nowrap',
            }}
          >
            BRINDES
          </span>
        </div>

        {/* ── Top-left brand ── */}
        <div
          style={{
            position: 'absolute', top: 24, left: isMobile ? 16 : 32,
            zIndex: 60, display: 'flex', alignItems: 'center', gap: 12,
          }}
        >
          <img
            src="/logo-connectx-icon.svg" alt="ConnectX"
            style={{
              width: isMobile ? 28 : 32, height: isMobile ? 28 : 32,
              filter: 'brightness(0) invert(1)', opacity: 0.95,
            }}
          />
          <span
            style={{
              fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
              color: 'white', opacity: 0.9, letterSpacing: '0.18em',
            }}
          >
            CONNECTX BRINDES
          </span>
        </div>

        {/* ── Category pills (desktop) ── */}
        {!isMobile && (
          <div
            style={{
              position: 'absolute', top: 24, left: '50%',
              transform: 'translateX(-50%)', zIndex: 60,
              display: 'flex', alignItems: 'center', gap: 16,
            }}
          >
            {PRODUCTS.map((p, i) => (
              <button
                key={i}
                onClick={() => {
                  if (!isAnimating && i !== activeIndex) {
                    setIsAnimating(true);
                    setActiveIndex(i);
                    setTimeout(() => setIsAnimating(false), DUR);
                  }
                }}
                style={{
                  padding: '6px 12px', borderRadius: 999,
                  fontSize: 12, fontWeight: 500, textTransform: 'uppercase',
                  letterSpacing: '0.08em', color: 'white', cursor: 'pointer',
                  backgroundColor: i === activeIndex ? 'rgba(255,255,255,0.22)' : 'transparent',
                  border: i === activeIndex ? '1.5px solid rgba(255,255,255,0.5)' : '1.5px solid transparent',
                  opacity: i === activeIndex ? 1 : 0.6,
                  transition: 'all 300ms', outline: 'none',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        {/* ── Carousel images ── */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 3 }}>
          {PRODUCTS.map((product, idx) => (
            <div
              key={idx}
              style={{
                position: 'absolute',
                aspectRatio: '0.6 / 1',
                ...getRoleStyle(idx),
              }}
            >
              <img
                src={product.src}
                alt={product.name}
                draggable={false}
                style={{
                  width: '100%', height: '100%',
                  objectFit: 'contain', objectPosition: 'bottom center',
                }}
              />
            </div>
          ))}
        </div>

        {/* ── Bottom-left info + nav ── */}
        <div
          style={{
            position: 'absolute', zIndex: 60, maxWidth: 340,
            bottom: isMobile ? 24 : 80, left: isMobile ? 16 : 96,
          }}
        >
          <p
            style={{
              fontWeight: 700, textTransform: 'uppercase',
              marginBottom: isMobile ? 8 : 12,
              fontSize: isMobile ? 16 : 22,
              color: 'white', opacity: 0.95, letterSpacing: '0.02em',
              margin: 0, marginBottom: isMobile ? 8 : 12,
            }}
          >
            {cur.name}
          </p>

          {!isMobile && (
            <p
              style={{
                fontSize: 14, color: 'white', opacity: 0.85,
                lineHeight: 1.6, marginBottom: 20, marginTop: 0,
              }}
            >
              {cur.desc}
            </p>
          )}

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              id="carousel-prev"
              onClick={() => navigate('prev')}
              onMouseEnter={() => setHoverPrev(true)}
              onMouseLeave={() => setHoverPrev(false)}
              aria-label="Produto anterior"
              style={{
                ...btnBase,
                backgroundColor: hoverPrev ? 'rgba(255,255,255,0.12)' : 'transparent',
                transform: hoverPrev ? 'scale(1.08)' : 'scale(1)',
              }}
            >
              <ArrowLeftIcon size={26} />
            </button>
            <button
              id="carousel-next"
              onClick={() => navigate('next')}
              onMouseEnter={() => setHoverNext(true)}
              onMouseLeave={() => setHoverNext(false)}
              aria-label="Próximo produto"
              style={{
                ...btnBase,
                backgroundColor: hoverNext ? 'rgba(255,255,255,0.12)' : 'transparent',
                transform: hoverNext ? 'scale(1.08)' : 'scale(1)',
              }}
            >
              <ArrowRightIcon size={26} />
            </button>
          </div>
        </div>

        {/* ── Bottom-right CTA ── */}
        <a
          href="/"
          onMouseEnter={() => setHoverCta(true)}
          onMouseLeave={() => setHoverCta(false)}
          style={{
            position: 'absolute', zIndex: 60,
            bottom: isMobile ? 24 : 80, right: isMobile ? 16 : 40,
            display: 'flex', alignItems: 'center', gap: 8,
            textDecoration: 'none',
            fontFamily: "'Anton', sans-serif",
            fontSize: isMobile ? 20 : 'clamp(20px, 4vw, 56px)',
            fontWeight: 400, color: 'white',
            opacity: hoverCta ? 1 : 0.95,
            letterSpacing: '-0.02em', lineHeight: 1,
            textTransform: 'uppercase',
            transition: 'opacity 200ms',
          }}
        >
          PERSONALIZAR
          <ArrowRightIcon size={isMobile ? 20 : 32} />
        </a>

        {/* ── Mobile dots ── */}
        {isMobile && (
          <div
            style={{
              position: 'absolute', bottom: 24, left: '50%',
              transform: 'translateX(-50%)', zIndex: 60,
              display: 'flex', gap: 8,
            }}
          >
            {PRODUCTS.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === activeIndex ? 24 : 8, height: 8,
                  borderRadius: 999,
                  backgroundColor: i === activeIndex ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)',
                  transition: 'all 300ms',
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
