import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabaseAdmin, isSupabaseConfigured } from '../../lib/supabaseClient';
import { useRememberedEmail } from '../../hooks/useRememberedEmail';
import Button from '../../components/ui/Button';
import SupabaseNotConfigured from './SupabaseNotConfigured';

export default function AdminLogin() {
  const navigate = useNavigate();
  const { email, setEmail, remember, setRemember, persistEmail } = useRememberedEmail('connectx-admin-email');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isSupabaseConfigured) {
    return <SupabaseNotConfigured />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    const { error: signInError } = await supabaseAdmin.auth.signInWithPassword({ email, password });
    setIsSubmitting(false);
    if (signInError) {
      setError('E-mail ou senha inválidos.');
      return;
    }
    persistEmail(email);
    navigate('/admin');
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-6">
      <img src="/logo-connectx.webp" alt="ConnectX Brindes" className="mb-8 h-16 w-auto object-contain" />

      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl border border-border bg-panel p-8 shadow-sm">
        <h1 className="mb-6 text-2xl font-bold">
          Painel de Gerenciamento<span className="text-accent">.</span>
        </h1>

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

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </div>
  );
}
