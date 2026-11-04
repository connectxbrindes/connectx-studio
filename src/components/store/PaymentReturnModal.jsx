import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

export const LAST_PAYMENT_KEY = 'store-last-payment';

const PAYMENT_MESSAGES = {
  aprovado: {
    title: 'Pagamento aprovado!',
    text: 'Recebemos seu pagamento e seu pedido já foi para produção. Avisaremos pelo seu celular quando estiver pronto.',
  },
  pendente: {
    title: 'Pagamento em análise',
    text: 'Seu pedido foi registrado. Assim que o Mercado Pago confirmar o pagamento (Pix/boleto podem levar alguns minutos), ele entra em produção automaticamente.',
  },
  falhou: {
    title: 'Pagamento não concluído',
    text: 'Seu pedido foi registrado, mas o pagamento não foi aprovado. Você pode tentar de novo pelo botão abaixo.',
  },
};

const readLastPayment = () => {
  try {
    return JSON.parse(localStorage.getItem(LAST_PAYMENT_KEY) || 'null');
  } catch {
    return null;
  }
};

/** Volta do Mercado Pago (/store?pagamento=aprovado|pendente|falhou). */
export default function PaymentReturnModal() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [result] = useState(() => searchParams.get('pagamento'));
  const [lastPayment] = useState(readLastPayment);
  const [open, setOpen] = useState(Boolean(PAYMENT_MESSAGES[result]));

  useEffect(() => {
    if (!result) return;
    setSearchParams({}, { replace: true });
    if (result === 'aprovado') {
      try {
        localStorage.removeItem(LAST_PAYMENT_KEY);
      } catch {
        /* ignora */
      }
    }
  }, [result, setSearchParams]);

  const message = PAYMENT_MESSAGES[result];
  if (!message) return null;
  const canRetry = result === 'falhou' && lastPayment?.url;

  return (
    <Modal isOpen={open} onClose={() => setOpen(false)} title={message.title} maxWidthClass="max-w-md">
      <div className="flex flex-col gap-4 text-sm">
        <p className="text-text-secondary">
          {result === 'falhou' && !canRetry
            ? 'O pagamento não foi aprovado. Fale com a nossa equipe para concluir o seu pedido.'
            : message.text}
        </p>
        {lastPayment?.orders?.length > 0 && (
          <p>
            Pedido: <span className="font-mono font-semibold">{lastPayment.orders.join(', ')}</span>
          </p>
        )}
        {canRetry ? (
          <Button onClick={() => { window.location.href = lastPayment.url; }}>Tentar pagar novamente</Button>
        ) : (
          <Button onClick={() => setOpen(false)}>Continuar</Button>
        )}
      </div>
    </Modal>
  );
}
