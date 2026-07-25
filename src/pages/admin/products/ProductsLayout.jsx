import { NavLink, Outlet } from 'react-router-dom';

const TABS = [
  { to: '/admin/produtos', end: true, label: 'Produto' },
  { to: '/admin/produtos/categorias', label: 'Categoria' },
  { to: '/admin/produtos/marcas', label: 'Marca' },
  { to: '/admin/produtos/modelos', label: 'Modelo' },
];

export default function ProductsLayout() {
  return (
    <div>
      <nav className="mb-8 flex gap-2 border-b border-border">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `-mb-px border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
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
