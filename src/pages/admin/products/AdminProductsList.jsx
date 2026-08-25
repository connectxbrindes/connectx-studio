import { useEffect, useState } from 'react';
import {
  fetchAdminProducts,
  fetchCategories,
  fetchSubcategories,
  fetchBrands,
  saveProduct,
  deleteProduct,
  replaceProductChildren,
  replaceProductModelVariants,
} from '../../../lib/api';
import { slugify } from '../../../utils/slugify';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import DataTable from '../../../components/admin/DataTable';
import ProductFormModal from './ProductFormModal';

const STATUS_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Ativos' },
  { value: 'inactive', label: 'Inativos' },
];

function normalize(value) {
  return (value || '').toString().trim().toLowerCase();
}

function nameSet(items) {
  return (items || [])
    .map((item) => normalize(item.name))
    .filter(Boolean)
    .sort()
    .join(',');
}

/** Considera duplicado quando categoria/subcategoria/marca/descrição/nome, os
 * conjuntos de cores/tamanhos e o uso de marca/modelo de aparelho batem
 * exatamente com outro produto já cadastrado. */
function findDuplicate(form, products, excludeId) {
  const signature = {
    name: normalize(form.name),
    category_id: form.category_id || null,
    subcategory_id: form.subcategory_id || null,
    brand_id: form.brand_id || null,
    description: normalize(form.description),
    colors: nameSet(form.colors),
    sizes: nameSet(form.sizes),
    uses_device_models: Boolean(form.uses_device_models),
  };

  return (
    products.find(
      (p) =>
        p.id !== excludeId &&
        normalize(p.name) === signature.name &&
        (p.category_id || null) === signature.category_id &&
        (p.subcategory_id || null) === signature.subcategory_id &&
        (p.brand_id || null) === signature.brand_id &&
        normalize(p.description) === signature.description &&
        nameSet(p.colors) === signature.colors &&
        nameSet(p.sizes) === signature.sizes &&
        Boolean(p.uses_device_models) === signature.uses_device_models
    ) || null
  );
}

export default function AdminProductsList() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pendingDuplicate, setPendingDuplicate] = useState(null);

  const loadData = async () => {
    setLoading(true);
    const [productRows, categoryRows, subcategoryRows, brandRows] = await Promise.all([
      fetchAdminProducts(),
      fetchCategories(),
      fetchSubcategories(),
      fetchBrands(),
    ]);
    setProducts(productRows);
    setCategories(categoryRows);
    setSubcategories(subcategoryRows);
    setBrands(brandRows);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingProduct(null);
    setIsFormOpen(true);
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    setIsFormOpen(true);
  };

  const handleDelete = async (product) => {
    if (!confirm(`Excluir o produto "${product.name}"? Essa ação não pode ser desfeita.`)) return;
    const { error } = await deleteProduct(product.id);
    if (error) {
      alert('Erro ao excluir produto.');
      return;
    }
    loadData();
  };

  const performSave = async (form) => {
    setSaving(true);

    const payload = {
      name: form.name,
      description: form.description || null,
      base_price: parseFloat(form.base_price),
      reseller_price:
        form.reseller_price === '' || form.reseller_price == null ? null : parseFloat(form.reseller_price),
      min_order_qty:
        form.min_order_qty === '' || form.min_order_qty == null ? 1 : Math.max(1, parseInt(form.min_order_qty, 10) || 1),
      status: form.status,
      category_id: form.category_id || null,
      subcategory_id: form.subcategory_id || null,
      brand_id: form.brand_id || null,
      cover_image_url: form.cover_image_url || null,
      personalization_area: form.personalization_area,
      has_3d_viewer: form.has_3d_viewer,
      model_3d_url: form.has_3d_viewer ? form.model_3d_url || null : null,
      uses_device_models: form.uses_device_models,
    };

    let result;
    if (editingProduct) {
      result = await saveProduct(editingProduct.id, payload);
    } else {
      const baseSlug = slugify(form.name);
      result = await saveProduct(null, { ...payload, slug: baseSlug });
      if (result.error?.code === '23505') {
        const suffix = Math.random().toString(36).slice(2, 6);
        result = await saveProduct(null, { ...payload, slug: `${baseSlug}-${suffix}` });
      }
    }

    if (result.error) {
      setSaving(false);
      alert('Erro ao salvar produto.');
      return;
    }

    const productId = editingProduct ? editingProduct.id : result.data.id;
    const [{ error: childrenError }, { error: variantsError }] = await Promise.all([
      replaceProductChildren(productId, { colors: form.colors, sizes: form.sizes }),
      replaceProductModelVariants(productId, form.variants),
    ]);

    setSaving(false);
    if (childrenError || variantsError) {
      alert('Produto salvo, mas houve um erro ao salvar cores/tamanhos/estoque por modelo.');
    }

    setIsFormOpen(false);
    setPendingDuplicate(null);
    loadData();
  };

  const handleFormSubmit = (form) => {
    const duplicate = findDuplicate(form, products, editingProduct?.id);
    if (duplicate) {
      setPendingDuplicate({ form, duplicate });
      return;
    }
    performSave(form);
  };

  const filteredProducts = products.filter((p) => statusFilter === 'all' || p.status === statusFilter);

  const columns = [
    { key: 'name', label: 'Produto', render: (p) => p.name },
    {
      key: 'description',
      label: 'Descrição',
      render: (p) => {
        const categoryPath = [p.category?.name, p.subcategory?.name].filter(Boolean).join(' › ');
        const parts = [
          categoryPath,
          p.brand?.name,
          p.sizes?.length ? p.sizes.map((s) => s.name).join('/') : null,
          p.colors?.length ? p.colors.map((c) => c.name).join('/') : null,
          p.uses_device_models ? 'Marca/Modelo' : null,
        ].filter(Boolean);
        return parts.join(' · ') || '—';
      },
    },
    { key: 'base_price', label: 'Preço Base', render: (p) => `R$ ${Number(p.base_price).toFixed(2).replace('.', ',')}` },
    {
      key: 'status',
      label: 'Status',
      render: (p) => (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            p.status === 'active'
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
          }`}
        >
          {p.status === 'active' ? 'Ativo' : 'Inativo'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Ações',
      render: (p) => (
        <div className="flex gap-4">
          <button onClick={() => openEditModal(p)} className="font-medium text-accent hover:text-accent/80">
            Editar
          </button>
          <button onClick={() => handleDelete(p)} className="font-medium text-red-600 hover:text-red-500">
            Excluir
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Catálogo de Produtos</h2>
        <Button onClick={openCreateModal}>Adicionar Produto</Button>
      </div>

      <div className="mb-6 flex w-fit rounded-lg border border-border p-1">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.value}
            onClick={() => setStatusFilter(filter.value)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === filter.value ? 'bg-text-primary text-white' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center text-text-secondary">Carregando…</div>
      ) : (
        <DataTable
          columns={columns}
          rows={filteredProducts}
          getRowId={(p) => p.id}
          emptyMessage="Nenhum produto encontrado."
        />
      )}

      <ProductFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleFormSubmit}
        editingProduct={editingProduct}
        categories={categories}
        subcategories={subcategories}
        brands={brands}
        saving={saving}
      />

      <Modal
        isOpen={!!pendingDuplicate}
        onClose={() => setPendingDuplicate(null)}
        title="Produto já cadastrado"
      >
        {pendingDuplicate && (
          <div className="flex flex-col gap-5">
            <p className="text-sm text-text-secondary">
              Já existe um produto muito parecido com este: <strong>{pendingDuplicate.duplicate.name}</strong>{' '}
              (mesma categoria, subcategoria, marca, descrição, cores e tamanhos). Deseja salvar mesmo assim?
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setPendingDuplicate(null)}>
                Cancelar
              </Button>
              <Button onClick={() => performSave(pendingDuplicate.form)} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar mesmo assim'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
