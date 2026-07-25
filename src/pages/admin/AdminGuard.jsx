import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabaseAdmin, isSupabaseConfigured } from '../../lib/supabaseClient';
import { fetchAdminProfile } from '../../lib/api';
import { AdminAuthProvider } from './AdminAuthContext';
import SupabaseNotConfigured from './SupabaseNotConfigured';

export default function AdminGuard({ children }) {
  const [status, setStatus] = useState('loading');
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;

    let cancelled = false;

    const check = async () => {
      const { data } = await supabaseAdmin.auth.getSession();
      if (!data.session) {
        if (!cancelled) setStatus('anon');
        return;
      }
      // Só master ou staff acessam o Painel — reseller (ou usuário sem
      // profile) cai fora, mesmo tendo sessão válida no client do Painel.
      const p = await fetchAdminProfile();
      if (cancelled) return;
      if (p && (p.role === 'master' || p.role === 'staff')) {
        setProfile(p);
        setStatus('authed');
      } else {
        setStatus('anon');
      }
    };

    check();

    const { data: listener } = supabaseAdmin.auth.onAuthStateChange(() => {
      check();
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (!isSupabaseConfigured) {
    return <SupabaseNotConfigured />;
  }

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center text-text-secondary">Carregando…</div>
    );
  }

  if (status === 'anon') {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <AdminAuthProvider role={profile.role} permissions={profile.permissions}>
      {children}
    </AdminAuthProvider>
  );
}
