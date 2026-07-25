import { createContext, useContext } from 'react';
import { Navigate } from 'react-router-dom';

// Papel + permissões da sessão do Painel, carregados no AdminGuard e
// disponibilizados pra sidebar e pros guards de seção.
const AdminAuthContext = createContext({ role: null, permissions: [], hasPermission: () => false });

export function AdminAuthProvider({ role, permissions, children }) {
  const hasPermission = (section) => role === 'master' || permissions.includes(section);
  return (
    <AdminAuthContext.Provider value={{ role, permissions, hasPermission }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  return useContext(AdminAuthContext);
}

// Ordem de fallback pra onde mandar quem entra em /admin sem seção definida.
const SECTION_ROUTES = [
  { section: 'orders', path: '/admin/pedidos' },
  { section: 'products', path: '/admin/produtos' },
  { section: 'resellers', path: '/admin/revendedores' },
];

/** Redireciona /admin pra primeira seção que o usuário tem permissão (master
 * cai em Pedidos; um staff só com Produtos cai direto em Produtos). */
export function AdminIndexRedirect() {
  const { role, hasPermission } = useAdminAuth();
  const first = SECTION_ROUTES.find((s) => hasPermission(s.section));
  if (role === 'master') return <Navigate to="/admin/pedidos" replace />;
  if (first) return <Navigate to={first.path} replace />;
  // staff sem nenhuma seção — só a tela de "sem acesso".
  return (
    <div className="flex h-64 items-center justify-center text-text-secondary">
      Sua conta ainda não tem nenhuma seção liberada. Fale com o administrador.
    </div>
  );
}

/** Protege uma rota de seção: quem não tem a permissão é mandado pro index
 * (que reencaminha pra uma seção válida). `master` passa em tudo. */
export function RequirePermission({ section, children }) {
  const { hasPermission } = useAdminAuth();
  if (!hasPermission(section)) return <Navigate to="/admin" replace />;
  return children;
}

/** Só o master (usado na aba Usuários). */
export function RequireMaster({ children }) {
  const { role } = useAdminAuth();
  if (role !== 'master') return <Navigate to="/admin" replace />;
  return children;
}
