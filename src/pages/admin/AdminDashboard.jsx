import { useEffect, useState } from 'react';
import { useNavigate, NavLink, Outlet } from 'react-router-dom';
import { fetchArtRequests, subscribeArtChanges } from '../../lib/artsApi';
import { supabaseAdmin } from '../../lib/supabaseClient';
import { useAdminAuth } from './AdminAuthContext';
import Button from '../../components/ui/Button';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { role, hasPermission } = useAdminAuth();
  const canArts = hasPermission('arts');
  const [artsUnread, setArtsUnread] = useState(0);

  // Contador de chamados com novidade na Central de Artes (menu lateral).
  useEffect(() => {
    if (!canArts) return undefined;
    const load = () => fetchArtRequests(supabaseAdmin).then((list) => setArtsUnread(list.filter((r) => r.teamUnread > 0).length));
    load();
    const unsubscribe = subscribeArtChanges(supabaseAdmin, 'sidebar', load);
    const timer = setInterval(load, 60000);
    return () => { unsubscribe(); clearInterval(timer); };
  }, [canArts]);

  const handleLogout = async () => {
    await supabaseAdmin.auth.signOut();
    navigate('/admin/login');
  };

  const navItems = [
    { to: '/admin/pedidos', label: 'Pedidos', show: hasPermission('orders') },
    { to: '/admin/produtos', label: 'Produtos', show: hasPermission('products') },
    { to: '/admin/revendedores', label: 'Revendedores', show: hasPermission('resellers') },
    { to: '/admin/studio', label: 'Studio', show: hasPermission('studio') },
    { to: '/admin/loja', label: 'Loja virtual', show: hasPermission('tokens') },
    { to: '/admin/artes', label: 'Central de Artes', show: canArts, badge: artsUnread },
    // Gestão de usuários é exclusiva do master.
    { to: '/admin/usuarios', label: 'Usuários', show: role === 'master' },
  ].filter((item) => item.show);

  return (
    <div className="flex min-h-screen bg-bg">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-border bg-panel">
        <div className="flex flex-col items-center gap-2 px-6 py-6 border-b border-border">
          <img src="/logo-connectx-icon.svg" alt="ConnectX Brindes" className="h-[150px] w-auto" />
          <h1 className="text-xl font-bold">
            {role === 'master' ? 'Painel Master' : 'Painel'}<span className="text-accent">.</span>
          </h1>
        </div>
        <nav className="flex flex-col gap-1 p-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-accent/10 text-accent'
                    : 'text-text-secondary hover:bg-bg hover:text-text-primary'
                }`
              }
            >
              <span className="flex items-center justify-between">
                {item.label}
                {item.badge > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-white">{item.badge}</span>
                )}
              </span>
            </NavLink>
          ))}
        </nav>
        <div className="absolute bottom-0 w-64 border-t border-border p-4">
          <Button variant="secondary" onClick={handleLogout} className="w-full">
            Sair
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}

