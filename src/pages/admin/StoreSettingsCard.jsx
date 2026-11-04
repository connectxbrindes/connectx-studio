import { useEffect, useState } from 'react';
import { supabaseAdmin } from '../../lib/supabaseClient';
import { fetchStoreSettings, saveStoreSettings } from '../../lib/storeApi';
import Button from '../../components/ui/Button';

const inputClass = 'w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-text-primary';

// Dados da empresa: aparecem no rodapé da loja (exigência do e-commerce).
const COMPANY_FIELDS = [
  ['company_name', 'Razão social / nome da empresa', 'ConnectX Brindes LTDA'],
  ['cnpj', 'CNPJ', '00.000.000/0001-00'],
  ['company_address', 'Endereço da empresa', 'Rua, número – bairro – cidade/UF – CEP'],
  ['contact_whatsapp', 'WhatsApp de atendimento', '(00) 00000-0000'],
  ['contact_email', 'E-mail de atendimento', 'contato@empresa.com.br'],
  ['business_hours', 'Horário de atendimento', 'Seg a sex, 9h às 18h'],
];

const NUMBER_FIELDS = [
  ['default_weight_kg', 'Peso padrão do produto embalado (kg)', '0.01'],
];

/** Configuração da loja virtual: endereço de retirada, entrega pelos Correios
 * (preços na Tabela de frete) e peso padrão (quando o produto não tem o dele). */
export default function StoreSettingsCard() {
  const [form, setForm] = useState(null);
  const [integrations, setIntegrations] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchStoreSettings().then((s) => setForm(s || {}));
    supabaseAdmin.functions
      .invoke('store-checkout', { body: { action: 'config' } })
      .then(({ data }) => setIntegrations(data || null));
  }, []);

  if (!form) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await saveStoreSettings({
      pickup_address: form.pickup_address?.trim() || null,
      shipping_enabled: Boolean(form.shipping_enabled),
      ...Object.fromEntries(COMPANY_FIELDS.map(([key]) => [key, form[key]?.trim() || null])),
      exchange_policy: form.exchange_policy?.trim() || null,
      privacy_policy: form.privacy_policy?.trim() || null,
      ...Object.fromEntries(NUMBER_FIELDS.map(([key]) => [key, Number(form[key]) || 0])),
    });
    setSaving(false);
    setMessage(error ? 'Não foi possível salvar.' : 'Salvo!');
  };

  const status = (on, onLabel = 'Conectado', offLabel = 'Falta configurar') => (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${on ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
      {on ? onLabel : offLabel}
    </span>
  );

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-4 rounded-xl border border-border bg-panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-bold">Configurações da loja</h3>
        {integrations && (
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="flex items-center gap-2">Frete (Correios) {status(integrations.shipping, 'Tabela preenchida', 'Falta a tabela')}</span>
            <span className="flex items-center gap-2">Pagamento (Mercado Pago) {status(integrations.payment)}</span>
          </div>
        )}
      </div>

      <div className="grid gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Endereço para retirada (aparece pro cliente)
          <input value={form.pickup_address || ''} onChange={(e) => setForm({ ...form, pickup_address: e.target.value })} placeholder="Rua, número – bairro – cidade · horário" className={inputClass} />
        </label>
      </div>

      <div>
        <p className="mb-2 text-sm">Peso para o frete (quando o produto não tem o peso cadastrado)</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {NUMBER_FIELDS.map(([key, label, step]) => (
            <label key={key} className="flex flex-col gap-1 text-xs text-text-secondary">
              {label}
              <input type="number" min="0" step={step} value={form[key] ?? ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className={inputClass} />
            </label>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={Boolean(form.shipping_enabled)} onChange={(e) => setForm({ ...form, shipping_enabled: e.target.checked })} />
        Oferecer entrega pelos Correios na loja (usa os preços da Tabela de frete abaixo)
      </label>

      <div className="border-t border-border pt-4">
        <h4 className="font-bold">Dados da empresa (rodapé da loja)</h4>
        <p className="mb-3 text-xs text-text-secondary">A lei do e-commerce pede CNPJ, endereço e um contato visíveis na loja. Campos vazios não aparecem.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {COMPANY_FIELDS.map(([key, label, placeholder]) => (
            <label key={key} className="flex flex-col gap-1 text-sm">
              {label}
              <input value={form[key] || ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={placeholder} className={inputClass} />
            </label>
          ))}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Trocas e devoluções
            <textarea rows={6} value={form.exchange_policy || ''} onChange={(e) => setForm({ ...form, exchange_policy: e.target.value })} placeholder="Texto da política de trocas (aparece em /store/ajuda/trocas)" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Política de privacidade
            <textarea rows={6} value={form.privacy_policy || ''} onChange={(e) => setForm({ ...form, privacy_policy: e.target.value })} placeholder="Texto da política de privacidade (aparece em /store/ajuda/privacidade)" className={inputClass} />
          </label>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        {message && <span className="text-sm text-text-secondary">{message}</span>}
        <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</Button>
      </div>
    </form>
  );
}
