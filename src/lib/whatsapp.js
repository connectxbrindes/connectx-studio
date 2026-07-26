import { supabaseAdmin } from './supabaseClient';

/**
 * Notificação por WhatsApp quando o status do pedido muda. O envio de verdade
 * acontece na Edge Function `notify-order-status` (API oficial da Meta, token
 * em segredo do servidor). Aqui só decidimos QUANDO notificar e disparamos.
 */

// Status que geram notificação pra unidade. "producing" fica de fora — a
// unidade acompanha esse na própria tela de Pedidos, sem precisar de mensagem.
const NOTIFYING_STATUSES = new Set(['pending', 'canceled', 'completed']);

export function shouldNotifyStatus(status) {
  return NOTIFYING_STATUSES.has(status);
}

/** Dispara a notificação do pedido. A function lê o pedido + telefone da
 * unidade no servidor e envia o template certo pro status atual. Retorna
 * `{ sent, reason }` — `reason` é 'not_configured' enquanto a Meta não
 * estiver configurada (nada é enviado, mas nada quebra). */
export async function notifyOrderStatus(orderId) {
  const { data, error } = await supabaseAdmin.functions.invoke('notify-order-status', {
    body: { orderId },
  });
  if (error) {
    console.error('Error invoking notify-order-status:', error);
    return { sent: false, reason: 'invoke_error' };
  }
  return { sent: Boolean(data?.sent), reason: data?.reason || null };
}
