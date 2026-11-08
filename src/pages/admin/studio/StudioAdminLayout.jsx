import { NavLink, Outlet } from 'react-router-dom';

// Subabas do Studio no Painel: prévia/teste do fluxo e as coleções de artes.
const TABS = [
  { to: '/admin/studio', label: 'Prévia / teste', end: true },
  { to: '/admin/studio/colecoes', label: 'Coleções' },
];

export default function StudioAdminLayout() {
  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold">Studio</h2>
      <nav className="mb-6 flex flex-wrap gap-2 border-b border-border">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
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
