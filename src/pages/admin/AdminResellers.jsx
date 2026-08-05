import { useState, useEffect } from 'react';
import { supabaseAdmin } from '../../lib/supabaseClient';
import { provisionResellerLogin } from '../../lib/api';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import * as XLSX from 'xlsx';

// Só dígitos — pra comparar CNPJ/CPF ignorando pontuação (./-).
const onlyDigits = (s) => (s || '').replace(/\D/g, '');

export default function AdminResellers() {
  const [resellers, setResellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [togglingId, setTogglingId] = useState(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    contact_name: '',
    cnpj_cpf: '',
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
    // Esconde os contatos do Tiny que NÃO são "Cliente" (tiny_tipo='outro').
    // Mostra: manuais (tiny_tipo null) + clientes + ainda não classificados.
    const { data, error } = await supabaseAdmin
      .from('resellers')
      .select('*')
      .or('tiny_tipo.is.null,tiny_tipo.eq.cliente')
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
        cnpj_cpf: reseller.cnpj_cpf || '',
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
        cnpj_cpf: '',
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
      cnpj_cpf: formData.cnpj_cpf || null,
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

  // Ativa/desativa direto na lista, sem abrir o modal.
  const toggleStatus = async (reseller) => {
    const next = reseller.status === 'active' ? 'inactive' : 'active';
    setTogglingId(reseller.id);
    // Atualização otimista pra dar fluidez; reverte se der erro.
    setResellers((prev) => prev.map((r) => (r.id === reseller.id ? { ...r, status: next } : r)));
    const { error } = await supabaseAdmin.from('resellers').update({ status: next }).eq('id', reseller.id);
    setTogglingId(null);
    if (error) {
      setResellers((prev) => prev.map((r) => (r.id === reseller.id ? { ...r, status: reseller.status } : r)));
      alert('Erro ao mudar o status do revendedor.');
    }
  };

  // ---------- Exportar Excel ----------
  const exportToExcel = () => {
    if (resellers.length === 0) {
      alert('Nenhum revendedor para exportar.');
      return;
    }

    const columnMap = {
      id: 'ID',
      name: 'Nome',
      contact_name: 'Nome do Contato',
      cnpj_cpf: 'CNPJ / CPF',
      phone: 'Telefone / WhatsApp',
      email: 'E-mail',
      commission_rate: 'Comissão (%)',
      status: 'Status',
      notes: 'Observações',
      tiny_id: 'Tiny ID (ERP)',
      created_at: 'Criado em',
    };

    const statusLabels = { active: 'Ativo', inactive: 'Inativo' };

    const rows = resellers.map((r) => {
      const row = {};
      for (const [key, label] of Object.entries(columnMap)) {
        let value = r[key];
        if (key === 'status') value = statusLabels[value] || value;
        if (key === 'created_at' && value) {
          value = new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        }
        row[label] = value ?? '';
      }
      // Colunas extras que existam no banco mas não no map
      for (const key of Object.keys(r)) {
        if (!columnMap[key]) row[key] = r[key] ?? '';
      }
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(rows);

    // Auto-ajustar largura das colunas
    const colWidths = Object.keys(rows[0]).map((key) => {
      const maxLen = Math.max(key.length, ...rows.map((row) => String(row[key] || '').length));
      return { wch: Math.min(maxLen + 2, 50) };
    });
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Revendedores');
    XLSX.writeFile(wb, 'revendedores_export.xlsx');
  };

  // Filtro por CNPJ/CPF (ignora pontuação) ou nome.
  const term = search.trim().toLowerCase();
  const termDigits = onlyDigits(search);
  const filteredResellers = term
    ? resellers.filter((r) => {
        const byName = (r.name || '').toLowerCase().includes(term) ||
          (r.contact_name || '').toLowerCase().includes(term);
        const byDoc = termDigits && onlyDigits(r.cnpj_cpf).includes(termDigits);
        return byName || byDoc;
      })
    : resellers;

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-3xl font-bold">Revendedores</h2>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={exportToExcel}>
            📊 Exportar Excel
          </Button>
          <Button onClick={() => openModal()}>Novo Revendedor</Button>
        </div>
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por CNPJ/CPF ou nome…"
          className="w-full max-w-md rounded-lg border border-border bg-panel px-4 py-2 text-sm outline-none transition-colors focus:border-accent"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-panel shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-bg text-text-secondary border-b border-border">
              <tr>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider">Nome</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider">CNPJ / CPF</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider">Contato</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider">Comissão (%)</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-text-secondary">
                    <div className="flex justify-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent"></div>
                    </div>
                  </td>
                </tr>
              ) : filteredResellers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-text-secondary">
                    {resellers.length === 0
                      ? 'Nenhum revendedor cadastrado.'
                      : 'Nenhum revendedor encontrado para esse filtro.'}
                  </td>
                </tr>
              ) : (
                filteredResellers.map((reseller) => (
                  <tr key={reseller.id} className="transition-colors hover:bg-bg/50">
                    <td className="px-6 py-4 font-medium">{reseller.name}</td>
                    <td className="px-6 py-4 text-text-secondary">{reseller.cnpj_cpf || '—'}</td>
                    <td className="px-6 py-4 text-text-secondary">
                      {reseller.contact_name}
                      {reseller.phone && <div className="text-xs">{reseller.phone}</div>}
                    </td>
                    <td className="px-6 py-4">{Number(reseller.commission_rate).toFixed(1)}%</td>
                    <td className="px-6 py-4">
                      {/* Toggle rápido: clica pra ativar/desativar sem abrir o modal. */}
                      <button
                        type="button"
                        onClick={() => toggleStatus(reseller)}
                        disabled={togglingId === reseller.id}
                        title="Clique para ativar/desativar"
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                          reseller.status === 'active'
                            ? 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${reseller.status === 'active' ? 'bg-green-600' : 'bg-red-600'}`} />
                        {reseller.status === 'active' ? 'Ativo' : 'Inativo'}
                      </button>
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
              <label className="mb-1 block text-sm font-medium text-text-secondary">CNPJ / CPF</label>
              <input
                type="text"
                value={formData.cnpj_cpf}
                onChange={(e) => setFormData({ ...formData, cnpj_cpf: e.target.value })}
                className="w-full rounded-lg border border-border bg-bg px-4 py-2 outline-none transition-colors focus:border-accent"
                placeholder="Documento do cliente"
              />
            </div>
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
