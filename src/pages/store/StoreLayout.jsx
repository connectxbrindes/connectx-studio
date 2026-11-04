import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import { Clock, Gift, Mail, MapPin, MessageCircle, Search } from 'lucide-react';
import { fetchStorePublicInfo, storeSignOut } from '../../lib/storeApi';
import { useStoreSession, groupByCategory } from './useStoreSession';
import StoreCartDrawer from '../../components/store/StoreCartDrawer';
import StoreAuthModal from '../../components/store/StoreAuthModal';
import PaymentReturnModal from '../../components/store/PaymentReturnModal';
import Toast from '../../components/ui/Toast';
import SupabaseNotConfigured from '../admin/SupabaseNotConfigured';

function SearchBox({ className = '', autoFocus = false }) {
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
        autoFocus={autoFocus}
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

const onlyDigits = (v) => (v || '').replace(/\D/g, '');

/** Rodapé: categorias, atendimento e dados da empresa (cadastrados no Painel). */
function StoreFooter({ categories, info, withBottomBar }) {
  const whatsapp = onlyDigits(info.contact_whatsapp);
  const hasContact = whatsapp || info.contact_email || info.business_hours || info.company_address || info.pickup_address;
  const legal = [info.company_name || 'ConnectX Brindes', info.cnpj && `CNPJ ${info.cnpj}`].filter(Boolean).join(' · ');
  return (
    <footer className={`mt-20 bg-brand-dark text-white ${withBottomBar ? 'pb-20 lg:pb-0' : ''}`}>
      <div className="mx-auto grid max-w-[1240px] gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div>
          <img src="/logo-connectx.webp" alt="ConnectX Brindes" className="mb-4 h-10 w-auto brightness-0 invert" />
          <p className="text-sm leading-relaxed text-white/70">Produtos personalizados com a sua cara: você cria no nosso Studio e a gente produz.</p>
        </div>
        <div>
          <p className="mb-3 text-sm font-bold uppercase tracking-wider">Categorias</p>
          <ul className="flex flex-col gap-2 text-sm text-white/70">
            {categories.map(({ category }) => (
              <li key={category.id}>
                <Link to={`/store/c/${category.slug}`} className="hover:text-white">{category.name}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-3 text-sm font-bold uppercase tracking-wider">Ajuda</p>
          <ul className="flex flex-col gap-2 text-sm text-white/70">
            <li><Link to="/store/ajuda/como-funciona" className="hover:text-white">Como funciona</Link></li>
            {info.exchange_policy && <li><Link to="/store/ajuda/trocas" className="hover:text-white">Trocas e devoluções</Link></li>}
            {info.privacy_policy && <li><Link to="/store/ajuda/privacidade" className="hover:text-white">Política de privacidade</Link></li>}
          </ul>
        </div>
        {hasContact && (
          <div>
            <p className="mb-3 text-sm font-bold uppercase tracking-wider">Atendimento</p>
            <ul className="flex flex-col gap-2.5 text-sm text-white/70">
              {whatsapp && (
                <li>
                  <a href={`https://wa.me/${whatsapp.length <= 11 ? `55${whatsapp}` : whatsapp}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-white">
                    <MessageCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" /> {info.contact_whatsapp}
                  </a>
                </li>
              )}
              {info.contact_email && (
                <li>
                  <a href={`mailto:${info.contact_email}`} className="flex items-center gap-2 break-all hover:text-white">
                    <Mail className="h-4 w-4 flex-shrink-0" aria-hidden="true" /> {info.contact_email}
                  </a>
                </li>
              )}
              {info.business_hours && (
                <li className="flex items-start gap-2"><Clock className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" /> {info.business_hours}</li>
              )}
              {(info.company_address || info.pickup_address) && (
                <li className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" /> {info.company_address || info.pickup_address}</li>
              )}
            </ul>
          </div>
        )}
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-[1240px] px-4 py-4 text-center text-xs text-white/50 sm:px-6">
          © {new Date().getFullYear()} {legal}
          {info.company_address && <span className="block sm:inline"><span className="hidden sm:inline"> · </span>{info.company_address}</span>}
        </p>
      </div>
    </footer>
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [info, setInfo] = useState({});

  useEffect(() => {
    fetchStorePublicInfo().then(setInfo);
  }, []);

  useEffect(() => {
    setSearchOpen(false);
  }, [location.pathname, location.search]);

  // Só a home usa o título padrão; produto e ajuda definem o próprio.
  useEffect(() => {
    if (location.pathname.replace(/\/$/, '') === '/store') document.title = 'ConnectX Brindes — Produtos personalizados do seu jeito';
  }, [location.pathname]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  if (!isSupabaseConfigured) return <SupabaseNotConfigured />;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <div className="truncate bg-brand-dark px-4 py-2 text-center text-xs font-medium text-white sm:text-sm">
        {hasCampaign ? (
          <>
            Ganhou um cartão na loja? <Link to="/store/campanha" className="font-bold underline underline-offset-2">Resgate seu brinde</Link>
            <span className="hidden sm:inline"> · Retirada grátis na loja</span>
          </>
        ) : (
          <>
            Retirada grátis na loja<span className="hidden sm:inline"> · Entrega para todo o Brasil pelos Correios</span>
          </>
        )}
      </div>

      <header className="sticky top-0 z-20 border-b border-border bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1240px] items-center gap-4 px-4 py-3 sm:gap-8 sm:px-6">
          <Link to="/store" className="flex-shrink-0" aria-label="ConnectX Brindes — início da loja">
            <img src="/logo-connectx.webp" alt="ConnectX Brindes" className="h-9 w-auto sm:h-11" />
          </Link>
          <SearchBox className="hidden flex-1 md:block" />
          <div className="ml-auto flex items-center gap-1 sm:gap-5">
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              aria-label="Buscar produtos"
              aria-expanded={searchOpen}
              className="flex h-10 w-10 items-center justify-center rounded-full text-brand-dark hover:bg-bg md:hidden"
            >
              <Search className="h-5 w-5" />
            </button>
            <AccountButton />
            <CartButton />
          </div>
        </div>
        {searchOpen && <SearchBox className="mx-4 mb-3 md:hidden" autoFocus />}
        <nav className="border-t border-border" aria-label="Categorias">
          <ul className="no-scrollbar mx-auto flex max-w-[1240px] gap-1 overflow-x-auto px-2 sm:justify-center sm:px-6">
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
                className={({ isActive }) => `flex items-center gap-1.5 px-3 py-3 text-sm font-semibold ${isActive ? 'text-accent' : 'text-accent hover:opacity-80'}`}
              >
                <Gift className="h-4 w-4" aria-hidden="true" />
                Resgatar brinde
              </NavLink>
            </li>}
          </ul>
        </nav>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <StoreFooter categories={categories} info={info} withBottomBar={location.pathname.startsWith('/store/p/')} />

      <StoreCartDrawer />
      <StoreAuthModal />
      <PaymentReturnModal />
      <Toast />
    </div>
  );
}
