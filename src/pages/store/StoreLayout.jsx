import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import { storeSignOut } from '../../lib/storeApi';
import { useStoreSession, groupByCategory } from './useStoreSession';
import StoreCartDrawer from '../../components/store/StoreCartDrawer';
import StoreAuthModal from '../../components/store/StoreAuthModal';
import PaymentReturnModal from '../../components/store/PaymentReturnModal';
import Toast from '../../components/ui/Toast';
import SupabaseNotConfigured from '../admin/SupabaseNotConfigured';

function SearchBox({ className = '' }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        navigate(`/store/busca?q=${encodeURIComponent(q.trim())}`);
      }}
      className={`relative ${className}`}
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="O que você quer personalizar?"
        aria-label="Buscar produtos"
        className="h-11 w-full rounded-full border border-transparent bg-bg pl-5 pr-14 text-sm outline-none transition-colors focus:border-brand focus:bg-white"
      />
      <button
        type="submit"
        aria-label="Buscar"
        className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white transition-opacity hover:opacity-90"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-4 w-4">
          <circle cx="11" cy="11" r="7" />
          <path strokeLinecap="round" d="m20 20-3.5-3.5" />
        </svg>
      </button>
    </form>
  );
}

function AccountButton() {
  const customer = useStore((s) => s.storeCustomer);
  const openStoreAuth = useStore((s) => s.openStoreAuth);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const icon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <circle cx="12" cy="8" r="4" />
      <path strokeLinecap="round" d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </svg>
  );

  if (!customer) {
    return (
      <button type="button" onClick={openStoreAuth} className="flex items-center gap-2 text-sm font-semibold text-brand-dark hover:text-brand">
        {icon}
        <span className="hidden sm:inline">Entrar</span>
      </button>
    );
  }

  const firstName = customer.name?.split(' ')[0] || customer.email;
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(!open)} className="flex items-center gap-2 text-sm font-semibold text-brand-dark hover:text-brand">
        {icon}
        <span className="hidden max-w-28 truncate sm:inline">Olá, {firstName}</span>
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-48 rounded-xl bg-white py-1 shadow-lg ring-1 ring-border">
          <p className="truncate border-b border-border px-4 py-2 text-xs text-text-secondary">{customer.email}</p>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              storeSignOut();
            }}
            className="block w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-bg"
          >
            Sair
          </button>
        </div>
      )}
    </div>
  );
}

function CartButton() {
  const count = useStore((s) => s.cartCount());
  const openDrawer = useStore((s) => s.openDrawer);
  return (
    <button
      type="button"
      onClick={openDrawer}
      aria-label={`Abrir carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`}
      className="relative flex h-10 w-10 items-center justify-center rounded-full text-brand-dark transition-colors hover:bg-bg"
    >
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="currentColor" className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007Z" />
      </svg>
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-white">
          {count}
        </span>
      )}
    </button>
  );
}

/** Topo + menu de categorias + rodapé da loja virtual (vitrine). */
export default function StoreLayout() {
  useStoreSession({ loadCatalog: true });
  const catalog = useStore((s) => s.catalog);
  const campaignProductIds = useStore((s) => s.campaignProductIds);
  const hasCampaign = catalog.some((p) => campaignProductIds.includes(p.id));
  const categories = groupByCategory(catalog);
  const location = useLocation();

  useEffect(() => {
    document.title = 'ConnectX Brindes — Produtos personalizados do seu jeito';
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  if (!isSupabaseConfigured) return <SupabaseNotConfigured />;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <div className="bg-brand-dark px-4 py-2 text-center text-xs font-medium text-white sm:text-sm">
        {hasCampaign ? (
          <>
            🎁 Ganhou um cartão na loja? <Link to="/store/campanha" className="font-bold underline underline-offset-2">Resgate seu brinde personalizado</Link>
            <span className="hidden sm:inline"> · Retirada grátis na loja</span>
          </>
        ) : (
          <>🎨 Personalize do seu jeito · Retirada grátis na loja · Entrega pelos Correios</>
        )}
      </div>

      <header className="sticky top-0 z-20 border-b border-border bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1240px] items-center gap-4 px-4 py-3 sm:gap-8 sm:px-6">
          <Link to="/store" className="flex-shrink-0" aria-label="ConnectX Brindes — início da loja">
            <img src="/logo-connectx.webp" alt="ConnectX Brindes" className="h-9 w-auto sm:h-11" />
          </Link>
          <SearchBox className="hidden flex-1 md:block" />
          <div className="ml-auto flex items-center gap-3 sm:gap-5">
            <AccountButton />
            <CartButton />
          </div>
        </div>
        <SearchBox className="mx-4 mb-3 md:hidden" />
        <nav className="border-t border-border" aria-label="Categorias">
          <ul className="mx-auto flex max-w-[1240px] gap-1 overflow-x-auto px-4 sm:justify-center sm:px-6">
            {categories.map(({ category }) => (
              <li key={category.id} className="flex-shrink-0">
                <NavLink
                  to={`/store/c/${category.slug}`}
                  className={({ isActive }) =>
                    `block px-3 py-3 text-sm font-semibold transition-colors ${isActive ? 'text-accent' : 'text-brand-dark hover:text-accent'}`
                  }
                >
                  {category.name}
                </NavLink>
              </li>
            ))}
            {hasCampaign && <li className="flex-shrink-0">
              <NavLink
                to="/store/campanha"
                className={({ isActive }) => `block px-3 py-3 text-sm font-semibold ${isActive ? 'text-accent' : 'text-accent hover:opacity-80'}`}
              >
                🎁 Resgatar brinde
              </NavLink>
            </li>}
          </ul>
        </nav>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-16 bg-brand-dark text-white">
        <div className="mx-auto grid max-w-[1240px] gap-8 px-4 py-12 sm:grid-cols-3 sm:px-6">
          <div>
            <img src="/logo-connectx.webp" alt="ConnectX Brindes" className="mb-4 h-10 w-auto brightness-0 invert" />
            <p className="text-sm text-white/70">Produtos personalizados com a sua cara: você cria no nosso Studio e a gente produz.</p>
          </div>
          <div>
            <p className="mb-3 font-bold">Categorias</p>
            <ul className="flex flex-col gap-2 text-sm text-white/70">
              {categories.map(({ category }) => (
                <li key={category.id}>
                  <Link to={`/store/c/${category.slug}`} className="hover:text-white">{category.name}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-3 font-bold">Como funciona</p>
            <ul className="flex flex-col gap-2 text-sm text-white/70">
              <li>1. Escolha o produto</li>
              <li>2. Personalize com foto, nome ou frase</li>
              <li>3. Retire grátis na loja ou receba em casa</li>
            </ul>
          </div>
        </div>
        <p className="border-t border-white/10 py-4 text-center text-xs text-white/50">
          © {new Date().getFullYear()} ConnectX Brindes
        </p>
      </footer>

      <StoreCartDrawer />
      <StoreAuthModal />
      <PaymentReturnModal />
      <Toast />
    </div>
  );
}
