import { useEffect, useState } from 'react';
import { fetchAllBrandModels, saveBrandModel, deleteBrandModel, fetchBrands } from '../../../lib/api';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import DataTable from '../../../components/admin/DataTable';
import ImageUploader from '../../../components/admin/ImageUploader';

function emptyForm() {
  return { brandId: '', name: '', mockupImageUrl: '', maskImageUrl: '' };
}

export default function AdminProductModels() {
  const [models, setModels] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [modelRows, brandRows] = await Promise.all([fetchAllBrandModels(), fetchBrands()]);
    setModels(modelRows);
    setBrands(brandRows);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const updateField = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const openCreateModal = () => {
    setEditingId(null);
    setForm({ ...emptyForm(), brandId: brands[0]?.id || '' });
    setIsModalOpen(true);
  };

  const openEditModal = (model) => {
    setEditingId(model.id);
    setForm({
      brandId: model.brand?.id || '',
      name: model.name,
      mockupImageUrl: model.mockup_image_url || '',
      maskImageUrl: model.mask_image_url || '',
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.brandId) return;
    setSaving(true);
    const { error } = await saveBrandModel(editingId, {
      brand_id: form.brandId,
      name: form.name,
      mockup_image_url: form.mockupImageUrl || null,
      mask_image_url: form.maskImageUrl || null,
    });
    setSaving(false);

    if (error) {
      alert(`Erro ao salvar modelo: ${error.message || JSON.stringify(error)}`);
      return;
    }
    setIsModalOpen(false);
    loadData();
  };

  const handleDelete = async (model) => {
    if (!confirm(`Excluir o modelo "${model.name}"?`)) return;
    const { error } = await deleteBrandModel(model.id);
    if (error) {
      alert('Erro ao excluir modelo.');
      return;
    }
    loadData();
  };

  const columns = [
    {
      key: 'preview',
      label: 'Prévia',
      render: (m) =>
        m.mockup_image_url ? (
          <img src={m.mockup_image_url} alt="" className="h-12 w-8 rounded object-cover" />
        ) : (
          <span className="text-xs text-text-secondary">—</span>
        ),
    },
    { key: 'brand', label: 'Marca', render: (m) => m.brand?.name || '—' },
    { key: 'name', label: 'Modelo', render: (m) => m.name },
    {
      key: 'actions',
      label: 'Ações',
      render: (m) => (
        <div className="flex gap-4">
          <button onClick={() => openEditModal(m)} className="font-medium text-accent hover:text-accent/80">
            Editar
          </button>
          <button onClick={() => handleDelete(m)} className="font-medium text-red-600 hover:text-red-500">
            Excluir
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Modelos (por Marca)</h2>
        <Button onClick={openCreateModal} disabled={brands.length === 0}>
          Adicionar Modelo
        </Button>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center text-text-secondary">Carregando…</div>
      ) : (
        <DataTable
          columns={columns}
          rows={models}
          getRowId={(m) => m.id}
          emptyMessage="Nenhum modelo cadastrado. Modelos são vinculados a uma Marca (ex: iPhone 14 para a marca Apple)."
        />
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? 'Editar Modelo' : 'Novo Modelo'}>
        <form onSubmit={handleSave} className="flex flex-col gap-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Marca *</label>
            <select
              required
              value={form.brandId}
              onChange={(e) => updateField({ brandId: e.target.value })}
              className="w-full rounded-lg border border-border bg-bg px-4 py-2 outline-none transition-colors focus:border-accent"
            >
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Nome do Modelo *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => updateField({ name: e.target.value })}
              className="w-full rounded-lg border border-border bg-bg px-4 py-2 outline-none transition-colors focus:border-accent"
              placeholder="Ex: iPhone 15 Pro"
            />
          </div>

          <div className="rounded-lg border border-border p-3">
            <p className="mb-3 text-xs text-text-secondary">
              Prévia exibida no Studio quando o cliente escolher esse modelo — recomendado 331×590px. Reaproveitada
              em qualquer produto que use esse modelo.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <ImageUploader
                label="Foto do produto (mockup)"
                value={form.mockupImageUrl}
                onChange={(url) => updateField({ mockupImageUrl: url })}
              />
              <ImageUploader
                label="Máscara da área de personalização"
                value={form.maskImageUrl}
                onChange={(url) => updateField({ maskImageUrl: url })}
              />
            </div>
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
