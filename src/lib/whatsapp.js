/**
 * Notificação por WhatsApp quando o status de um pedido muda. Ainda sem
 * provedor configurado (Z-API, Meta Cloud API, Twilio, etc) — por enquanto
 * só monta a mensagem certa e loga no console, sem enviar de verdade.
 *
 * Pra ligar um provedor de verdade depois: troca só o corpo de `sendWhatsApp`
 * por uma chamada fetch() pra API do provedor escolhido. Todo o resto (quando
 * disparar, qual mensagem) já fica pronto.
 */

const MESSAGE_BUILDERS = {
  pending: ({ customerName, sequenceNumber }) =>
    `O pedido de ${customerName}, número #${sequenceNumber}, está com uma pendência. Entre em contato com o setor de produção.`,
  canceled: ({ customerName, sequenceNumber }) =>
    `O pedido de ${customerName}, número #${sequenceNumber}, foi cancelado.`,
  completed: ({ customerName, sequenceNumber }) =>
    `Eba! O pedido de ${customerName}, número #${sequenceNumber}, já está pronto para ser retirado.`,
};

/** Status que disparam notificação. "producing" fica de fora de propósito —
 * a unidade só acompanha esse status olhando a tela de Pedidos dela, sem
 * precisar de mensagem. */
export function shouldNotifyStatus(status) {
  return status in MESSAGE_BUILDERS;
}

export function buildStatusMessage(status, { customerName, sequenceNumber }) {
  const build = MESSAGE_BUILDERS[status];
  if (!build) return null;
  return build({ customerName, sequenceNumber });
}

/** Envia a notificação — hoje é um stub (só loga), até um provedor ser
 * configurado. Retorna { sent: false, reason: 'not_configured' } nesse caso,
 * pra quem chamar poder avisar o usuário que nada foi enviado de verdade. */
export async function sendWhatsAppNotification({ phone, message }) {
  if (!phone) {
    console.warn('WhatsApp not sent: unidade sem telefone cadastrado.', { message });
    return { sent: false, reason: 'no_phone' };
  }

  // TODO: plugar um provedor real aqui (Z-API, Meta Cloud API, Twilio...).
  console.info('[WhatsApp stub] Envio não configurado ainda. Mensagem que seria enviada:', {
    phone,
    message,
  });
  return { sent: false, reason: 'not_configured' };
}
