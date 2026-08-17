import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { useRememberedEmail } from '../hooks/useRememberedEmail';
import Button from '../components/ui/Button';
import SupabaseNotConfigured from './admin/SupabaseNotConfigured';

export default function StaffLogin() {
  const navigate = useNavigate();
  const { email, setEmail, remember, setRemember, persistEmail } = useRememberedEmail('connectx-studio-email');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isPanelUser, setIsPanelUser] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isSupabaseConfigured) {
    return <SupabaseNotConfigured />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setIsPanelUser(false);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setIsSubmitting(false);
        setError('E-mail ou senha inválidos.');
        return;
      }
      // Só unidade (reseller) e master acessam o Studio. Um usuário do painel
      // (staff) autentica mas não pode entrar aqui — em vez de deixar o guard
      // "voltar" sem explicação, avisa e manda pro Painel.
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
      if (profile?.role === 'staff') {
        await supabase.auth.signOut();
        setIsSubmitting(false);
        setIsPanelUser(true);
        return;
      }
      setIsSubmitting(false);
      persistEmail(email);
      // Registra o acesso da unidade (pra contabilizar quantos logins ela teve).
      // Não bloqueia a navegação nem quebra o login se falhar.
      Promise.resolve(supabase.rpc('log_reseller_login')).catch(() => {});
      navigate('/');
    } catch (err) {
      console.error('Erro inesperado no login:', err);
      setIsSubmitting(false);
      setError('Não foi possível entrar. Tente novamente.');
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-6">
      <img src="/logo-connectx.webp" alt="ConnectX Brindes" className="mb-8 h-16 w-auto object-contain" />

      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl border border-border bg-panel p-8 shadow-sm">
        <h1 className="mb-6 text-2xl font-bold">
          Studio<span className="text-accent">.</span>
        </h1>
        <p className="mb-6 text-sm text-text-secondary">Entre com o login da sua unidade pra personalizar produtos.</p>

        <label className="mb-4 flex flex-col gap-1 text-sm">
          E-mail
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-border px-4 py-3 outline-none transition-colors focus:border-text-primary"
          />
        </label>

        <label className="mb-4 flex flex-col gap-1 text-sm">
          Senha
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-border px-4 py-3 outline-none transition-colors focus:border-text-primary"
          />
        </label>

        <label className="mb-6 flex cursor-pointer items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
          />
          Lembrar meu e-mail neste aparelho
        </label>

        {error && (
          <p role="alert" className="mb-4 text-sm text-accent">
            {error}
          </p>
        )}

        {isPanelUser && (
          <div role="alert" className="mb-4 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-text-primary">
            Esse login é da equipe de gerenciamento, não do Studio.{' '}
            <Link to="/admin/login" className="font-semibold text-accent hover:underline">
              Entrar no Painel
            </Link>
            .
          </div>
        )}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </Button>

        <p className="mt-6 text-center text-sm text-text-secondary">
          É da equipe de gerenciamento?{' '}
          <Link to="/admin/login" className="font-medium text-accent hover:underline">
            Acessar o Painel
          </Link>
        </p>
      </form>
    </div>
  );
}
