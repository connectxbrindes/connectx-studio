import { useEffect, useState } from 'react';
import {
  fetchCategories,
  fetchSubcategories,
  saveCategory,
  deleteCategory,
  saveSubcategory,
  deleteSubcategory,
} from '../../../lib/api';
import { slugify } from '../../../utils/slugify';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import DataTable from '../../../components/admin/DataTable';

export default function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal de categoria
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [categoryName, setCategoryName] = useState('');
  const [saving, setSaving] = useState(false);

  // Modal de subcategorias
  const [managingCategory, setManagingCategory] = useState(null);
  const [newSubcategoryName, setNewSubcategoryName] = useState('');
  const [savingSubcategory, setSavingSubcategory] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [cats, subs] = await Promise.all([fetchCategories(), fetchSubcategories()]);
    setCategories(cats);
    setSubcategories(subs);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCategoryModal = (category = null) => {
    setEditingCategoryId(category?.id || null);
    setCategoryName(category?.name || '');
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await saveCategory(editingCategoryId, { name: categoryName, slug: slugify(categoryName) });
    setSaving(false);

    if (error) {
      alert('Erro ao salvar categoria.');
      return;
    }
    setIsCategoryModalOpen(false);
    loadData();
  };

  const handleDeleteCategory = async (category) => {
    if (!confirm(`Excluir a categoria "${category.name}"? As subcategorias dela também serão excluídas.`)) return;
    const { error } = await deleteCategory(category.id);
    if (error) {
      alert('Erro ao excluir categoria. Verifique se ela ainda não está em uso por algum produto.');
      return;
    }
    loadData();
  };

  const handleAddSubcategory = async (e) => {
    e.preventDefault();
    setSavingSubcategory(true);
    const { error } = await saveSubcategory(null, {
      category_id: managingCategory.id,
      name: newSubcategoryName,
      slug: slugify(newSubcategoryName),
    });
    setSavingSubcategory(false);

    if (error) {
      alert('Erro ao adicionar subcategoria.');
      return;
    }
    setNewSubcategoryName('');
    loadData();
  };

  const handleDeleteSubcategory = async (subcategory) => {
    if (!confirm(`Excluir a subcategoria "${subcategory.name}"?`)) return;
    const { error } = await deleteSubcategory(subcategory.id);
    if (error) {
      alert('Erro ao excluir subcategoria. Verifique se ela ainda não está em uso por algum produto.');
      return;
    }
    loadData();
  };

  const subcategoriesFor = (categoryId) => subcategories.filter((s) => s.category_id === categoryId);

  const columns = [
    { key: 'name', label: 'Categoria', render: (c) => c.name },
    { key: 'slug', label: 'Slug', render: (c) => c.slug },
    {
      key: 'subcategories',
      label: 'Subcategorias',
      render: (c) => subcategoriesFor(c.id).map((s) => s.name).join(', ') || '—',
    },
    {
      key: 'actions',
      label: 'Ações',
      render: (c) => (
        <div className="flex gap-4">
          <button onClick={() => openCategoryModal(c)} className="font-medium text-accent hover:text-accent/80">
            Editar
          </button>
          <button
            onClick={() => setManagingCategory(c)}
            className="font-medium text-text-secondary hover:text-text-primary"
          >
            Subcategorias
          </button>
          <button onClick={() => handleDeleteCategory(c)} className="font-medium text-red-600 hover:text-red-500">
            Excluir
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Categorias</h2>
        <Button onClick={() => openCategoryModal()}>Adicionar Categoria</Button>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center text-text-secondary">Carregando…</div>
      ) : (
        <DataTable
          columns={columns}
          rows={categories}
          getRowId={(c) => c.id}
          emptyMessage="Nenhuma categoria cadastrada."
        />
      )}

      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title={editingCategoryId ? 'Editar Categoria' : 'Nova Categoria'}
      >
        <form onSubmit={handleSaveCategory} className="flex flex-col gap-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Nome da Categoria *</label>
            <input
              type="text"
              required
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-4 py-2 outline-none transition-colors focus:border-accent"
              placeholder="Ex: Térmicos Personalizados"
            />
          </div>
          <div className="mt-4 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsCategoryModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!managingCategory}
        onClose={() => setManagingCategory(null)}
        title={managingCategory ? `Subcategorias de ${managingCategory.name}` : ''}
      >
        {managingCategory && (
          <div className="flex flex-col gap-5">
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {subcategoriesFor(managingCategory.id).length === 0 ? (
                <li className="px-4 py-3 text-sm text-text-secondary">Nenhuma subcategoria cadastrada.</li>
              ) : (
                subcategoriesFor(managingCategory.id).map((s) => (
                  <li key={s.id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <span>{s.name}</span>
                    <button
                      onClick={() => handleDeleteSubcategory(s)}
                      className="font-medium text-red-600 hover:text-red-500"
                    >
                      Excluir
                    </button>
                  </li>
                ))
              )}
            </ul>

            <form onSubmit={handleAddSubcategory} className="flex gap-3">
              <input
                type="text"
                required
                value={newSubcategoryName}
                onChange={(e) => setNewSubcategoryName(e.target.value)}
                className="flex-1 rounded-lg border border-border bg-bg px-4 py-2 outline-none transition-colors focus:border-accent"
                placeholder="Nome da nova subcategoria"
              />
              <Button type="submit" disabled={savingSubcategory}>
                {savingSubcategory ? 'Adicionando...' : 'Adicionar'}
              </Button>
            </form>
          </div>
        )}
      </Modal>
    </div>
  );
}
