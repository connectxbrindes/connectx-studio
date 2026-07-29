import { useState, useEffect } from 'react';
import { supabaseAdmin } from '../../lib/supabaseClient';
import { provisionResellerLogin } from '../../lib/api';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';

export default function AdminResellers() {
  const [resellers, setResellers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    contact_name: '',
    phone: '',
    email: '',
    commission_rate: 0,
    status: 'active',
  });
  const [saving, setSaving] = useState(false);
  // Login de acesso ao Studio: e-mail+senha só faz sentido ao criar (o
  // e-mail fica preso ao usuário de autenticação); ao editar, só permite
  // redefinir a senha.
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  const [passwordResetDone, setPasswordResetDone] = useState(false);
  // Uma unidade pode existir sem login ainda (ex: criação anterior falhou
  // no passo do login) — checa de verdade em vez de assumir pelo editingId,
  // senão a tela só oferece "redefinir senha" pra um login que não existe.
  const [hasLogin, setHasLogin] = useState(false);
  const [checkingLogin, setCheckingLogin] = useState(false);
  // E-mail de acesso já cadastrado (vem do profile). É a credencial de login
  // da unidade — editável via ação change_email na Edge Function.
  const [loginEmailExisting, setLoginEmailExisting] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [updatingEmail, setUpdatingEmail] = useState(false);
  const [emailUpdateDone, setEmailUpdateDone] = useState(false);

  useEffect(() => {
    fetchResellers();
  }, []);

  const fetchResellers = async () => {
    setLoading(true);
    const { data, error } = await supabaseAdmin
      .from('resellers')
      .select('*')
      .order('name');
    
    if (error) {
      console.error('Error fetching resellers:', error);
      alert('Erro ao carregar revendedores');
    } else {
      setResellers(data || []);
    }
    setLoading(false);
  };

  const openModal = async (reseller = null) => {
    if (reseller) {
      setEditingId(reseller.id);
      setFormData({
        name: reseller.name,
        contact_name: reseller.contact_name || '',
        phone: reseller.phone || '',
        email: reseller.email || '',
        commission_rate: reseller.commission_rate,
        status: reseller.status,
      });
    } else {
      setEditingId(null);
      setFormData({
        name: '',
        contact_name: '',
        phone: '',
        email: '',
        commission_rate: 0,
        status: 'active',
      });
    }
    setLoginEmail('');
    setLoginPassword('');
    setResetPassword('');
    setLoginError('');
    setPasswordResetDone(false);
    setHasLogin(false);
    setLoginEmailExisting('');
    setNewEmail('');
    setEmailUpdateDone(false);
    setIsModalOpen(true);

    if (reseller) {
      setCheckingLogin(true);
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('id, email')
        .eq('reseller_id', reseller.id)
        .maybeSingle();
      setHasLogin(Boolean(data));
      setLoginEmailExisting(data?.email || '');
      setNewEmail(data?.email || '');
      setCheckingLogin(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoginError('');

    if (!hasLogin && (!loginEmail.trim() || !loginPassword.trim())) {
      setLoginError('Informe e-mail e senha de acesso pra essa unidade poder logar no Studio.');
      return;
    }

    setSaving(true);

    const payload = {
      name: formData.name,
      contact_name: formData.contact_name,
      phone: formData.phone,
      email: formData.email,
      commission_rate: parseFloat(formData.commission_rate),
      status: formData.status,
    };

    let error;
    let resellerId = editingId;
    if (editingId) {
      const res = await supabaseAdmin.from('resellers').update(payload).eq('id', editingId);
      error = res.error;
    } else {
      const res = await supabaseAdmin.from('resellers').insert([payload]).select().single();
      error = res.error;
      resellerId = res.data?.id;
    }

    if (!error && !hasLogin) {
      const { error: loginErr } = await provisionResellerLogin({
        action: 'create',
        resellerId,
        email: loginEmail.trim(),
        password: loginPassword.trim(),
      });
      if (loginErr) {
        setSaving(false);
        setLoginError(`Unidade salva, mas o login de acesso falhou: ${loginErr.message}`);
        fetchResellers();
        return;
      }
      setHasLogin(true);
    }

    setSaving(false);

    if (error) {
      console.error('Error saving reseller:', error);
      alert('Erro ao salvar revendedor');
    } else {
      setIsModalOpen(false);
      fetchResellers();
    }
  };

  const handleResetPassword = async () => {
    if (!resetPassword.trim()) {
      setLoginError('Informe a nova senha.');
      return;
    }
    setLoginError('');
    setResettingPassword(true);
    const { error } = await provisionResellerLogin({
      action: 'reset_password',
      resellerId: editingId,
      password: resetPassword.trim(),
    });
    setResettingPassword(false);
    if (error) {
      setLoginError(error.message);
      return;
    }
    setResetPassword('');
    setPasswordResetDone(true);
  };

  const handleUpdateEmail = async () => {
    const email = newEmail.trim();
    if (!email) {
      setLoginError('Informe o novo e-mail de acesso.');
      return;
    }
    if (email === loginEmailExisting) {
      setLoginError('O e-mail informado é igual ao atual.');
      return;
    }
    setLoginError('');
    setEmailUpdateDone(false);
    setUpdatingEmail(true);
    const { error } = await provisionResellerLogin({
      action: 'change_email',
      resellerId: editingId,
      email,
    });
    setUpdatingEmail(false);
    if (error) {
      setLoginError(error.message);
      return;
    }
    setLoginEmailExisting(email);
    setEmailUpdateDone(true);
  };

  return (
    <div className="max-w-5xl">
      <div className="mb-8 flex items-center justify-between">
        <h2 className="text-3xl font-bold">Revendedores</h2>
        <Button onClick={() => openModal()}>Novo Revendedor</Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-panel shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-bg text-text-secondary border-b border-border">
              <tr>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider">Nome</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider">Contato</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider">Comissão (%)</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-text-secondary">
                    <div className="flex justify-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent"></div>
                    </div>
                  </td>
                </tr>
              ) : resellers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-text-secondary">
                    Nenhum revendedor cadastrado.
                  </td>
                </tr>
              ) : (
                resellers.map((reseller) => (
                  <tr key={reseller.id} className="transition-colors hover:bg-bg/50">
                    <td className="px-6 py-4 font-medium">{reseller.name}</td>
                    <td className="px-6 py-4 text-text-secondary">
                      {reseller.contact_name}
                      {reseller.phone && <div className="text-xs">{reseller.phone}</div>}
                    </td>
                    <td className="px-6 py-4">{Number(reseller.commission_rate).toFixed(1)}%</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          reseller.status === 'active'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        }`}
                      >
                        {reseller.status === 'active' ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openModal(reseller)}
                        className="text-accent hover:text-accent/80 transition-colors font-medium"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Editar Revendedor' : 'Novo Revendedor'}
      >
        <form onSubmit={handleSave} className="flex flex-col gap-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Nome do Ponto de Venda *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded-lg border border-border bg-bg px-4 py-2 outline-none transition-colors focus:border-accent"
              placeholder="Ex: Loja do João"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-text-secondary">Nome do Contato</label>
              <input
                type="text"
                value={formData.contact_name}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                className="w-full rounded-lg border border-border bg-bg px-4 py-2 outline-none transition-colors focus:border-accent"
                placeholder="Ex: João Silva"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text-secondary">Telefone / WhatsApp</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full rounded-lg border border-border bg-bg px-4 py-2 outline-none transition-colors focus:border-accent"
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-text-secondary">Comissão (%) *</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                required
                value={formData.commission_rate}
                onChange={(e) => setFormData({ ...formData, commission_rate: e.target.value })}
                className="w-full rounded-lg border border-border bg-bg px-4 py-2 outline-none transition-colors focus:border-accent"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text-secondary">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full rounded-lg border border-border bg-bg px-4 py-2 outline-none transition-colors focus:border-accent"
              >
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </select>
            </div>
          </div>

          <div className="border-t border-border pt-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
              Login de acesso ao Studio
            </h3>

            {checkingLogin ? (
              <p className="text-sm text-text-secondary">Verificando login…</p>
            ) : !hasLogin ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-secondary">E-mail de acesso *</label>
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full rounded-lg border border-border bg-bg px-4 py-2 outline-none transition-colors focus:border-accent"
                    placeholder="loja@exemplo.com"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-secondary">Senha *</label>
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full rounded-lg border border-border bg-bg px-4 py-2 outline-none transition-colors focus:border-accent"
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-secondary">E-mail de acesso</label>
                  <div className="flex items-end gap-3">
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full rounded-lg border border-border bg-bg px-4 py-2 outline-none transition-colors focus:border-accent"
                      placeholder="loja@exemplo.com"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleUpdateEmail}
                      disabled={updatingEmail || newEmail.trim() === loginEmailExisting}
                    >
                      {updatingEmail ? 'Salvando...' : 'Atualizar e-mail'}
                    </Button>
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">
                    Este é o e-mail com que a unidade acessa o Studio. Alterar aqui muda o login dela.
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-secondary">Redefinir senha</label>
                  {/* A senha atual não pode ser exibida (fica criptografada no
                      Supabase, ninguém consegue ler de volta) — o admin define
                      uma nova aqui e repassa pra unidade. */}
                  <div className="flex items-end gap-3">
                    <input
                      type="password"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      className="w-full rounded-lg border border-border bg-bg px-4 py-2 outline-none transition-colors focus:border-accent"
                      placeholder="Nova senha"
                    />
                    <Button type="button" variant="secondary" onClick={handleResetPassword} disabled={resettingPassword}>
                      {resettingPassword ? 'Salvando...' : 'Redefinir'}
                    </Button>
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">
                    Por segurança, a senha atual não pode ser exibida. Defina uma nova aqui para substituí-la.
                  </p>
                </div>
              </div>
            )}

            {loginError && <p className="mt-2 text-sm text-accent">{loginError}</p>}
            {emailUpdateDone && <p className="mt-2 text-sm text-green-600">E-mail de acesso atualizado.</p>}
            {passwordResetDone && <p className="mt-2 text-sm text-green-600">Senha atualizada.</p>}
          </div>

          <div className="mt-4 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
