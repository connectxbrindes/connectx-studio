import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import SupabaseNotConfigured from '../../pages/admin/SupabaseNotConfigured';

// Mesmo padrão do AdminGuard, mas aceita tanto master quanto reseller — o
// Studio agora é operado pela equipe da loja logada, não uma vitrine aberta.
export default function StorefrontGuard({ children }) {
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;

    let cancelled = false;

    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        if (!cancelled) setStatus('anon');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.session.user.id)
        .single();

      if (!cancelled) {
        setStatus(profile?.role === 'master' || profile?.role === 'reseller' ? 'authed' : 'anon');
      }
    };

    checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      checkSession();
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
    return <Navigate to="/login" replace />;
  }

  return children;
}
