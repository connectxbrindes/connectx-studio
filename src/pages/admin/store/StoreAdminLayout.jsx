import { NavLink, Outlet } from 'react-router-dom';

// Subabas da Loja virtual no Painel: tudo que muda a loja (/store) fica aqui.
const TABS = [
  { to: '/admin/loja/banners', label: 'Banners' },
  { to: '/admin/loja/precos', label: 'Preços e descontos' },
  { to: '/admin/loja/tokens', label: 'Tokens da campanha' },
  { to: '/admin/loja/frete', label: 'Frete' },
  { to: '/admin/loja/configuracoes', label: 'Configurações' },
];

export default function StoreAdminLayout() {
  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold">Loja virtual</h2>
      <nav className="mb-8 flex flex-wrap gap-2 border-b border-border">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `-mb-px border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                isActive ? 'border-accent text-accent' : 'border-transparent text-text-secondary hover:text-text-primary'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
