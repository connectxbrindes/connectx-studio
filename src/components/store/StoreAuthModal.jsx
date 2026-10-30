import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { storeSignIn, storeSignUp } from '../../lib/storeApi';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

const inputClass =
  'rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-text-primary placeholder:text-text-secondary';

/** Cadastro / login do cliente da loja virtual. Abre ao finalizar a compra
 * sem estar logado (ou pelo botão "Entrar" do topo). */
export default function StoreAuthModal() {
  const isOpen = useStore((s) => s.isStoreAuthOpen);
  const close = useStore((s) => s.closeStoreAuth);
  const [mode, setMode] = useState('signup');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (mode === 'signup') {
      if (form.name.trim().length < 2) return setError('Informe seu nome.');
      if (form.phone.replace(/\D/g, '').length < 10) return setError('Informe um telefone com DDD.');
    }
    if (!form.email.trim()) return setError('Informe seu e-mail.');
    if (form.password.length < 6) return setError('A senha precisa ter pelo menos 6 caracteres.');

    setLoading(true);
    const { error: authError } =
      mode === 'signup'
        ? await storeSignUp({ name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), password: form.password })
        : await storeSignIn({ email: form.email, password: form.password });
    setLoading(false);
    if (authError) return setError(authError);
    setForm({ name: '', email: '', phone: '', password: '' });
    close();
  };

  return (
    <Modal isOpen={isOpen} onClose={() => !loading && close()} title={mode === 'signup' ? 'Crie sua conta' : 'Entrar'} maxWidthClass="max-w-md">
      <div className="mb-5 grid grid-cols-2 rounded-lg bg-bg p-1 text-sm font-semibold">
        {[
          ['signup', 'Criar conta'],
          ['signin', 'Já tenho conta'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => { setMode(value); setError(''); }}
            className={`rounded-md py-2 transition-colors ${mode === value ? 'bg-panel text-text-primary shadow-sm' : 'text-text-secondary'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {mode === 'signup' && (
          <>
            <label className="flex flex-col gap-1 text-sm">
              Nome completo
              <input autoComplete="name" value={form.name} onChange={update('name')} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Celular / WhatsApp
              <input type="tel" autoComplete="tel" placeholder="(00) 00000-0000" value={form.phone} onChange={update('phone')} className={inputClass} />
            </label>
          </>
        )}
        <label className="flex flex-col gap-1 text-sm">
          E-mail
          <input type="email" autoComplete="email" value={form.email} onChange={update('email')} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Senha
          <input
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            placeholder={mode === 'signup' ? 'Mínimo 6 caracteres' : ''}
            value={form.password}
            onChange={update('password')}
            className={inputClass}
          />
        </label>
        {error && <p className="text-sm text-accent">{error}</p>}
        <Button type="submit" className="mt-2 w-full" disabled={loading}>
          {loading ? 'Aguarde…' : mode === 'signup' ? 'Cadastrar e continuar' : 'Entrar e continuar'}
        </Button>
        {mode === 'signup' && (
          <p className="text-center text-xs text-text-secondary">
            Seu cadastro é usado para identificar o pedido e avisar quando estiver pronto.
          </p>
        )}
      </form>
    </Modal>
  );
}
