import { useEffect, useState } from 'react';
import { supabaseAdmin } from '../../lib/supabaseClient';
import { fetchStoreSettings, saveStoreSettings } from '../../lib/storeApi';
import Button from '../../components/ui/Button';

const inputClass = 'w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-text-primary';

const NUMBER_FIELDS = [
  ['default_weight_kg', 'Peso (kg)', '0.01'],
  ['default_height_cm', 'Altura (cm)', '0.1'],
  ['default_width_cm', 'Largura (cm)', '0.1'],
  ['default_length_cm', 'Comprimento (cm)', '0.1'],
];

/** Configuração da loja virtual: CEP de origem do frete, endereço de
 * retirada e embalagem padrão (usada quando o produto não tem medidas). */
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
    const cep = (form.origin_cep || '').replace(/\D/g, '');
    if (cep && cep.length !== 8) {
      setMessage('CEP de origem precisa ter 8 números.');
      return;
    }
    setSaving(true);
    const { error } = await saveStoreSettings({
      origin_cep: cep || null,
      pickup_address: form.pickup_address?.trim() || null,
      shipping_enabled: Boolean(form.shipping_enabled),
      ...Object.fromEntries(NUMBER_FIELDS.map(([key]) => [key, Number(form[key]) || 0])),
    });
    setSaving(false);
    setMessage(error ? 'Não foi possível salvar.' : 'Salvo!');
  };

  const status = (on) => (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${on ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
      {on ? 'Conectado' : 'Falta configurar'}
    </span>
  );

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-4 rounded-xl border border-border bg-panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-bold">Entrega e pagamento da loja</h3>
        {integrations && (
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="flex items-center gap-2">Frete (Melhor Envio) {status(integrations.shipping)}</span>
            <span className="flex items-center gap-2">Pagamento (Mercado Pago) {status(integrations.payment)}</span>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          CEP de origem (de onde sai o envio)
          <input value={form.origin_cep || ''} onChange={(e) => setForm({ ...form, origin_cep: e.target.value })} placeholder="00000-000" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          Endereço para retirada (aparece pro cliente)
          <input value={form.pickup_address || ''} onChange={(e) => setForm({ ...form, pickup_address: e.target.value })} placeholder="Rua, número – bairro – cidade · horário" className={inputClass} />
        </label>
      </div>

      <div>
        <p className="mb-2 text-sm">Embalagem padrão (quando o produto não tem medidas próprias)</p>
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
        Oferecer entrega pelos Correios na loja (precisa do CEP de origem e do Melhor Envio conectado)
      </label>

      <div className="flex items-center justify-end gap-3">
        {message && <span className="text-sm text-text-secondary">{message}</span>}
        <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</Button>
      </div>
    </form>
  );
}
