import { useState, useEffect } from 'react';
import { fetchPanelUsers, managePanelUser } from '../../lib/api';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';

const PERMISSIONS = [
  { value: 'orders', label: 'Pedidos' },
  { value: 'products', label: 'Produtos' },
  { value: 'resellers', label: 'Revendedores' },
];

const permissionLabel = (value) => PERMISSIONS.find((p) => p.value === value)?.label || value;

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null); // null = criar
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [permissions, setPermissions] = useState([]);
  const [resetPass, setResetPass] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadUsers = async () => {
    setLoading(true);
    setUsers(await fetchPanelUsers());
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const openCreate = () => {
    setEditingUser(null);
    setEmail('');
    setPassword('');
    setPermissions([]);
    setResetPass('');
    setError('');
    setIsModalOpen(true);
  };

  const openEdit = (user) => {
    setEditingUser(user);
    setEmail(user.email || '');
    setPassword('');
    setPermissions(user.permissions || []);
    setResetPass('');
    setError('');
    setIsModalOpen(true);
  };

  const togglePermission = (value) => {
    setPermissions((prev) => (prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!editingUser && (!email.trim() || !password.trim())) {
      setError('Informe e-mail e senha para o novo usuário.');
      return;
    }

    setSaving(true);
    const { error: err } = editingUser
      ? await managePanelUser({ action: 'update_permissions', userId: editingUser.id, permissions })
      : await managePanelUser({ action: 'create', email: email.trim(), password: password.trim(), permissions });
    setSaving(false);

    if (err) {
      setError(err.message);
      return;
    }
    setIsModalOpen(false);
    loadUsers();
  };

  const handleResetPassword = async () => {
    if (!resetPass.trim()) {
      setError('Informe a nova senha.');
      return;
    }
    setError('');
    setSaving(true);
    const { error: err } = await managePanelUser({
      action: 'reset_password',
      userId: editingUser.id,
      password: resetPass.trim(),
    });
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setResetPass('');
    setNotice('Senha atualizada.');
    setIsModalOpen(false);
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Excluir o acesso de ${user.email}? Essa ação não pode ser desfeita.`)) return;
    const { error: err } = await managePanelUser({ action: 'delete', userId: user.id });
    if (err) {
      setNotice(`Erro ao excluir: ${err.message}`);
      return;
    }
    loadUsers();
  };

  return (
    <div className="max-w-5xl">
      <div className="mb-8 flex items-center justify-between">
        <h2 className="text-3xl font-bold">Usuários</h2>
        <Button onClick={openCreate}>Novo Usuário</Button>
      </div>

      {notice && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} className="font-medium hover:underline">
            Fechar
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-panel shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-bg text-text-secondary border-b border-border">
              <tr>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider">E-mail</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider">Permissões</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan="3" className="px-6 py-8 text-center text-text-secondary">
                    <div className="flex justify-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent"></div>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="3" className="px-6 py-8 text-center text-text-secondary">
                    Nenhum usuário cadastrado.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="transition-colors hover:bg-bg/50">
                    <td className="px-6 py-4 font-medium">{user.email}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {(user.permissions || []).length === 0 ? (
                          <span className="text-text-secondary">—</span>
                        ) : (
                          (user.permissions || []).map((p) => (
                            <span
                              key={p}
                              className="inline-flex items-center rounded-full bg-bg px-2.5 py-0.5 text-xs font-medium text-text-primary"
                            >
                              {permissionLabel(p)}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openEdit(user)}
                        className="mr-4 font-medium text-accent transition-colors hover:text-accent/80"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(user)}
                        className="font-medium text-red-500 transition-colors hover:text-red-600"
                      >
                        Excluir
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
        title={editingUser ? 'Editar Usuário' : 'Novo Usuário'}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">E-mail de acesso *</label>
            <input
              type="email"
              required={!editingUser}
              disabled={Boolean(editingUser)}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-4 py-2 outline-none transition-colors focus:border-accent disabled:opacity-60"
              placeholder="usuario@exemplo.com"
            />
          </div>

          {!editingUser && (
            <div>
              <label className="mb-1 block text-sm font-medium text-text-secondary">Senha *</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg px-4 py-2 outline-none transition-colors focus:border-accent"
              />
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-text-secondary">Permissões de acesso</label>
            <div className="flex flex-col gap-2">
              {PERMISSIONS.map((perm) => (
                <label key={perm.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={permissions.includes(perm.value)}
                    onChange={() => togglePermission(perm.value)}
                    className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                  />
                  {perm.label}
                </label>
              ))}
            </div>
          </div>

          {editingUser && (
            <div className="border-t border-border pt-4">
              <label className="mb-1 block text-sm font-medium text-text-secondary">Redefinir senha</label>
              <div className="flex items-end gap-3">
                <input
                  type="password"
                  value={resetPass}
                  onChange={(e) => setResetPass(e.target.value)}
                  className="w-full rounded-lg border border-border bg-bg px-4 py-2 outline-none transition-colors focus:border-accent"
                  placeholder="Nova senha"
                />
                <Button type="button" variant="secondary" onClick={handleResetPassword} disabled={saving}>
                  Redefinir
                </Button>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-accent">{error}</p>}

          <div className="mt-2 flex justify-end gap-3">
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
