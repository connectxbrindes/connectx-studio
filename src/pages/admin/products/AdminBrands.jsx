import { useEffect, useState } from 'react';
import { fetchBrands, saveBrand, deleteBrand } from '../../../lib/api';
import { slugify } from '../../../utils/slugify';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import DataTable from '../../../components/admin/DataTable';

export default function AdminBrands() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setBrands(await fetchBrands());
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const openModal = (brand = null) => {
    setEditingId(brand?.id || null);
    setName(brand?.name || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await saveBrand(editingId, { name, slug: slugify(name) });
    setSaving(false);

    if (error) {
      alert('Erro ao salvar marca.');
      return;
    }
    setIsModalOpen(false);
    loadData();
  };

  const handleDelete = async (brand) => {
    if (!confirm(`Excluir a marca "${brand.name}"?`)) return;
    const { error } = await deleteBrand(brand.id);
    if (error) {
      alert('Erro ao excluir marca. Verifique se ela ainda não está em uso por algum produto.');
      return;
    }
    loadData();
  };

  const columns = [
    { key: 'name', label: 'Marca', render: (b) => b.name },
    { key: 'slug', label: 'Slug', render: (b) => b.slug },
    {
      key: 'actions',
      label: 'Ações',
      render: (b) => (
        <div className="flex gap-4">
          <button onClick={() => openModal(b)} className="font-medium text-accent hover:text-accent/80">
            Editar
          </button>
          <button onClick={() => handleDelete(b)} className="font-medium text-red-600 hover:text-red-500">
            Excluir
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Marcas</h2>
        <Button onClick={() => openModal()}>Adicionar Marca</Button>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center text-text-secondary">Carregando…</div>
      ) : (
        <DataTable columns={columns} rows={brands} getRowId={(b) => b.id} emptyMessage="Nenhuma marca cadastrada." />
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? 'Editar Marca' : 'Nova Marca'}>
        <form onSubmit={handleSave} className="flex flex-col gap-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Nome da Marca *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-4 py-2 outline-none transition-colors focus:border-accent"
              placeholder="Ex: Stanley"
            />
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
