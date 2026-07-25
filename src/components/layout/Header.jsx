import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../store/useStore';

export default function Header() {
  const count = useStore((s) => s.cartCount());
  const openDrawer = useStore((s) => s.openDrawer);
  const identity = useStore((s) => s.identity);
  const loadIdentity = useStore((s) => s.loadIdentity);
  const signOutIdentity = useStore((s) => s.signOutIdentity);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    loadIdentity();
  }, [loadIdentity]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const identityLabel = identity?.role === 'master' ? 'Master' : identity?.resellerName;

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-panel px-6 py-5 sm:px-10">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between">
        <Link to="/" className="text-2xl font-extrabold tracking-wide text-text-primary">
          STUDIO<span className="text-accent">.</span>
        </Link>
        <div className="flex items-center gap-4">
          {identityLabel && (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex items-center gap-2 text-sm font-medium text-text-primary transition-colors hover:text-accent"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white font-bold">
                  {identityLabel.charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:inline">{identityLabel}</span>
                <svg viewBox="0 0 20 20" fill="currentColor" className={`h-5 w-5 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`}>
                  <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              </button>

              {isMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 origin-top-right rounded-lg bg-panel shadow-lg ring-1 ring-border py-1 z-50">
                  <div className="px-4 py-3 text-xs text-text-secondary sm:hidden border-b border-border mb-1">
                    Logado como <br />
                    <span className="font-semibold text-text-primary">{identityLabel}</span>
                  </div>
                  {identity?.role === 'reseller' && (
                    <Link
                      to="/meus-pedidos"
                      className="block px-4 py-2 text-sm text-text-primary hover:bg-bg hover:text-accent"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Meus Pedidos
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      signOutIdentity();
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-bg"
                  >
                    Sair do Studio
                  </button>
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={openDrawer}
            aria-label={`Abrir carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`}
            className="relative flex h-11 w-11 items-center justify-center rounded-full border border-border transition-colors hover:border-text-primary"
          >
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="currentColor" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 1.994-4.694 2.602-7.163.087-.35-.173-.687-.533-.687H5.25M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
            </svg>
            {count > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-white transition-transform duration-200">
                {count}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
