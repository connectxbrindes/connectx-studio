import { useEffect, useState } from 'react';
import { fetchAllBrandModels } from '../../../lib/api';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import ImageUploader from '../../../components/admin/ImageUploader';
import Model3DUploader from '../../../components/admin/Model3DUploader';

const EMPTY_AREA = { x: 25, y: 20, width: 50, height: 50 };

function emptyForm() {
  return {
    name: '',
    description: '',
    base_price: '',
    status: 'active',
    category_id: '',
    subcategory_id: '',
    brand_id: '',
    cover_image_url: '',
    personalization_area: { ...EMPTY_AREA },
    has_3d_viewer: false,
    model_3d_url: '',
    uses_device_models: false,
    colors: [],
    sizes: [],
    variants: [],
  };
}

function formFromProduct(product) {
  return {
    name: product.name || '',
    description: product.description || '',
    base_price: product.base_price ?? '',
    status: product.status || 'active',
    category_id: product.category_id || '',
    subcategory_id: product.subcategory_id || '',
    brand_id: product.brand_id || '',
    cover_image_url: product.cover_image_url || '',
    personalization_area: product.personalization_area || { ...EMPTY_AREA },
    has_3d_viewer: Boolean(product.has_3d_viewer),
    model_3d_url: product.model_3d_url || '',
    uses_device_models: Boolean(product.uses_device_models),
    colors: (product.colors || []).map((c) => ({
      name: c.name,
      hex: c.hex,
      image_url: c.image_url || '',
      stock_quantity: c.stock_quantity ?? '',
      bling_sku: c.bling_sku || '',
    })),
    sizes: (product.sizes || []).map((s) => ({ name: s.name })),
    variants: (product.variants || []).map((v) => ({
      brandModelId: v.brand_model_id,
      brandName: v.brand_model?.brand?.name || '',
      modelName: v.brand_model?.name || '',
      stockQuantity: v.stock_quantity,
      blingSku: v.bling_sku || '',
    })),
  };
}

function NameListEditor({ label, items, onChange, placeholder }) {
  const updateItem = (index, name) => {
    onChange(items.map((item, i) => (i === index ? { name } : item)));
  };
  const removeItem = (index) => onChange(items.filter((_, i) => i !== index));
  const addItem = () => onChange([...items, { name: '' }]);

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-text-secondary">{label}</label>
      <div className="flex flex-col gap-2">
        {items.map((item, index) => (
          <div key={index} className="flex gap-2">
            <input
              type="text"
              required
              value={item.name}
              onChange={(e) => updateItem(index, e.target.value)}
              placeholder={placeholder}
              className="flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
            />
            <button
              type="button"
              onClick={() => removeItem(index)}
              className="rounded-lg border border-border px-3 text-sm text-red-600 hover:border-red-300"
            >
              Remover
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addItem}
          className="w-fit rounded-lg border border-dashed border-border px-3 py-2 text-sm text-text-secondary hover:border-text-primary hover:text-text-primary"
        >
          + Adicionar
        </button>
      </div>
    </div>
  );
}

function ColorListEditor({ items, onChange }) {
  const updateItem = (index, patch) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };
  const removeItem = (index) => onChange(items.filter((_, i) => i !== index));
  const addItem = () =>
    onChange([...items, { name: '', hex: '#000000', image_url: '', stock_quantity: '', bling_sku: '' }]);

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-text-secondary">Cores</label>
      <div className="flex flex-col gap-4">
        {items.map((item, index) => (
          <div key={index} className="flex items-start gap-3 rounded-lg border border-border p-3">
            <input
              type="color"
              value={item.hex}
              onChange={(e) => updateItem(index, { hex: e.target.value })}
              className="h-10 w-10 flex-shrink-0 cursor-pointer rounded border border-border"
            />
            <div className="flex flex-1 flex-col gap-2">
              <input
                type="text"
                required
                value={item.name}
                onChange={(e) => updateItem(index, { name: e.target.value })}
                placeholder="Nome da cor (ex: Rosa)"
                className="rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="mb-1 block text-xs text-text-secondary">Estoque</span>
                  <input
                    type="number"
                    min="0"
                    value={item.stock_quantity}
                    onChange={(e) => updateItem(index, { stock_quantity: e.target.value })}
                    placeholder="Sem controle"
                    className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
                  />
                </div>
                <div>
                  <span className="mb-1 block text-xs text-text-secondary">SKU Olist/Tiny</span>
                  <input
                    type="text"
                    value={item.bling_sku}
                    onChange={(e) => updateItem(index, { bling_sku: e.target.value.toUpperCase().replace(/\s+/g, '') })}
                    placeholder="ex: IPHONE11"
                    className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
                  />
                </div>
              </div>
              <ImageUploader
                label="Foto do produto nessa cor"
                value={item.image_url}
                onChange={(url) => updateItem(index, { image_url: url })}
              />
            </div>
            <button
              type="button"
              onClick={() => removeItem(index)}
              className="flex-shrink-0 rounded-lg border border-border px-3 py-2 text-sm text-red-600 hover:border-red-300"
            >
              Remover
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addItem}
          className="w-fit rounded-lg border border-dashed border-border px-3 py-2 text-sm text-text-secondary hover:border-text-primary hover:text-text-primary"
        >
          + Adicionar cor
        </button>
      </div>
    </div>
  );
}

function VariantListEditor({ items, onChange, allBrandModels }) {
  const [selectedToAdd, setSelectedToAdd] = useState('');
  const availableToAdd = allBrandModels.filter((bm) => !items.some((v) => v.brandModelId === bm.id));

  const updateItem = (index, patch) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };
  const removeItem = (index) => onChange(items.filter((_, i) => i !== index));
  const addItem = () => {
    const bm = allBrandModels.find((m) => m.id === selectedToAdd);
    if (!bm) return;
    onChange([
      ...items,
      {
        brandModelId: bm.id,
        brandName: bm.brand?.name || '',
        modelName: bm.name,
        stockQuantity: 0,
        // Herda o SKU do modelo (auto). Fallback: deriva do nome (maiúsc/sem espaço).
        blingSku: bm.bling_sku || (bm.name || '').toUpperCase().replace(/\s+/g, ''),
      },
    ]);
    setSelectedToAdd('');
  };

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-text-secondary">Estoque por Modelo</label>
      <p className="mb-3 text-xs text-text-secondary">
        A prévia (mockup + máscara) de cada modelo é cadastrada na aba Modelo e reaproveitada automaticamente aqui —
        só o estoque é específico deste produto.
      </p>
      <div className="flex flex-col gap-3">
        {items.map((item, index) => (
          <div key={item.brandModelId} className="flex flex-col gap-3 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">
                {item.brandName} · {item.modelName}
              </p>
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="text-sm font-medium text-red-600 hover:text-red-500"
              >
                Remover
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="mb-1 block text-xs text-text-secondary">Estoque</span>
                <input
                  type="number"
                  min="0"
                  value={item.stockQuantity}
                  onChange={(e) => updateItem(index, { stockQuantity: Number(e.target.value) })}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
                />
              </div>
              <div>
                <span className="mb-1 block text-xs text-text-secondary">SKU Olist/Tiny</span>
                <input
                  type="text"
                  value={item.blingSku || ''}
                  onChange={(e) => updateItem(index, { blingSku: e.target.value.toUpperCase().replace(/\s+/g, '') })}
                  placeholder="ex: IPHONE11"
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
                />
              </div>
            </div>
          </div>
        ))}

        {availableToAdd.length > 0 ? (
          <div className="flex gap-2">
            <select
              value={selectedToAdd}
              onChange={(e) => setSelectedToAdd(e.target.value)}
              className="flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
            >
              <option value="">Selecione marca/modelo...</option>
              {availableToAdd.map((bm) => (
                <option key={bm.id} value={bm.id}>
                  {bm.brand?.name} · {bm.name}
                </option>
              ))}
            </select>
            <Button type="button" variant="secondary" onClick={addItem} disabled={!selectedToAdd}>
              + Adicionar
            </Button>
          </div>
        ) : (
          items.length === 0 && (
            <p className="text-sm text-text-secondary">
              Nenhum modelo cadastrado nas abas Marca/Modelo ainda. Cadastre lá antes de vincular aqui.
            </p>
          )
        )}
      </div>
    </div>
  );
}

export default function ProductFormModal({
  isOpen,
  onClose,
  onSubmit,
  editingProduct,
  categories,
  subcategories,
  brands,
  saving,
}) {
  const [form, setForm] = useState(emptyForm());
  const [allBrandModels, setAllBrandModels] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    setForm(editingProduct ? formFromProduct(editingProduct) : emptyForm());
  }, [isOpen, editingProduct]);

  useEffect(() => {
    if (!isOpen) return;
    fetchAllBrandModels().then(setAllBrandModels);
  }, [isOpen]);

  const subcategoryOptions = subcategories.filter((s) => s.category_id === form.category_id);

  const updateField = (patch) => setForm((prev) => ({ ...prev, ...patch }));
  const updateArea = (patch) =>
    setForm((prev) => ({ ...prev, personalization_area: { ...prev.personalization_area, ...patch } }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingProduct ? `Editar ${editingProduct.name}` : 'Novo Produto'}
    >
      <form onSubmit={handleSubmit} className="flex max-h-[70vh] flex-col gap-6 overflow-y-auto pr-1">
        <div>
          <label className="mb-1 block text-sm font-medium text-text-secondary">Nome do Produto *</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => updateField({ name: e.target.value })}
            className="w-full rounded-lg border border-border bg-bg px-4 py-2 outline-none transition-colors focus:border-accent"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-text-secondary">Descrição</label>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => updateField({ description: e.target.value })}
            className="w-full rounded-lg border border-border bg-bg px-4 py-2 outline-none transition-colors focus:border-accent"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Categoria *</label>
            <select
              required
              value={form.category_id}
              onChange={(e) => updateField({ category_id: e.target.value, subcategory_id: '' })}
              className="w-full rounded-lg border border-border bg-bg px-4 py-2 outline-none transition-colors focus:border-accent"
            >
              <option value="">Selecione...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Subcategoria</label>
            <select
              value={form.subcategory_id}
              onChange={(e) => updateField({ subcategory_id: e.target.value })}
              disabled={subcategoryOptions.length === 0}
              className="w-full rounded-lg border border-border bg-bg px-4 py-2 outline-none transition-colors focus:border-accent disabled:opacity-50"
            >
              <option value="">Nenhuma</option>
              {subcategoryOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Marca</label>
            <select
              value={form.brand_id}
              onChange={(e) => updateField({ brand_id: e.target.value })}
              className="w-full rounded-lg border border-border bg-bg px-4 py-2 outline-none transition-colors focus:border-accent"
            >
              <option value="">Nenhuma</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Preço Base (R$) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={form.base_price}
              onChange={(e) => updateField({ base_price: e.target.value })}
              className="w-full rounded-lg border border-border bg-bg px-4 py-2 outline-none transition-colors focus:border-accent"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-text-secondary">Status</label>
          <select
            value={form.status}
            onChange={(e) => updateField({ status: e.target.value })}
            className="w-full rounded-lg border border-border bg-bg px-4 py-2 outline-none transition-colors focus:border-accent"
          >
            <option value="active">Ativo (Visível na loja)</option>
            <option value="inactive">Inativo (Oculto)</option>
          </select>
        </div>

        <ImageUploader
          label="Imagem de capa"
          value={form.cover_image_url}
          onChange={(url) => updateField({ cover_image_url: url })}
        />

        <div>
          <label className="mb-2 block text-sm font-medium text-text-secondary">
            Área de personalização (% da imagem)
          </label>
          <div className="grid grid-cols-4 gap-3">
            {['x', 'y', 'width', 'height'].map((key) => (
              <div key={key}>
                <span className="mb-1 block text-xs uppercase text-text-secondary">{key}</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.personalization_area[key]}
                  onChange={(e) => updateArea({ [key]: Number(e.target.value) })}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
                />
              </div>
            ))}
          </div>
        </div>

        <ColorListEditor items={form.colors} onChange={(colors) => updateField({ colors })} />
        <NameListEditor label="Tamanhos" items={form.sizes} onChange={(sizes) => updateField({ sizes })} placeholder="Ex: 500ml" />

        <div className="rounded-lg border border-border p-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={form.uses_device_models}
              onChange={(e) => updateField({ uses_device_models: e.target.checked })}
              className="h-4 w-4 rounded border-border"
            />
            Usa seleção de marca/modelo de aparelho
          </label>
          <p className="mt-2 text-xs text-text-secondary">
            O cliente escolhe a marca no Studio e vê só os modelos dela (catálogo das abas Marca/Modelo). Pra cada
            modelo que este produto realmente atende, defina abaixo o estoque e o mockup específico dele.
          </p>
        </div>

        {form.uses_device_models &&
          (editingProduct ? (
            <VariantListEditor
              items={form.variants}
              onChange={(variants) => updateField({ variants })}
              allBrandModels={allBrandModels}
            />
          ) : (
            <p className="rounded-lg border border-dashed border-border p-4 text-sm text-text-secondary">
              Salve o produto primeiro pra poder vincular estoque e mockup por modelo.
            </p>
          ))}

        <div className="rounded-lg border border-border p-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={form.has_3d_viewer}
              onChange={(e) => updateField({ has_3d_viewer: e.target.checked })}
              className="h-4 w-4 rounded border-border"
            />
            Ativar Visualizador 3D
          </label>
          {form.has_3d_viewer && (
            <div className="mt-4">
              <Model3DUploader value={form.model_3d_url} onChange={(url) => updateField({ model_3d_url: url })} />
            </div>
          )}
        </div>

        <div className="sticky bottom-0 mt-2 flex justify-end gap-3 border-t border-border bg-panel pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
