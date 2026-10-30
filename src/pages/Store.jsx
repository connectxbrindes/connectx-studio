import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { fetchCampaignProductIds, fetchStoreCustomer, onStoreAuthChange } from '../lib/storeApi';
import Storefront from './Storefront';
import SupabaseNotConfigured from './admin/SupabaseNotConfigured';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';

const LAST_PAYMENT_KEY = 'store-last-payment';

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

// Loja virtual de varejo: o mesmo Studio, aberto pra qualquer pessoa (sem
// login). O cadastro/login do cliente só é pedido ao finalizar a compra.
export default function Store() {
  const setCampaignProductIds = useStore((s) => s.setCampaignProductIds);
  const setStoreCustomer = useStore((s) => s.setStoreCustomer);
  const [searchParams, setSearchParams] = useSearchParams();
  const [paymentResult] = useState(() => searchParams.get('pagamento'));
  const [lastPayment] = useState(readLastPayment);
  const [showPayment, setShowPayment] = useState(Boolean(PAYMENT_MESSAGES[paymentResult]));

  useEffect(() => {
    document.title = 'Loja ConnectX Brindes — Personalize o seu';
    fetchCampaignProductIds().then(setCampaignProductIds);
    fetchStoreCustomer().then(setStoreCustomer);
    return onStoreAuthChange(() => {
      fetchStoreCustomer().then(setStoreCustomer);
    });
  }, [setCampaignProductIds, setStoreCustomer]);

  // Volta do Mercado Pago: limpa a URL (os parâmetros do MP) e, se aprovado,
  // esquece o link de pagamento guardado.
  useEffect(() => {
    if (!paymentResult) return;
    setSearchParams({}, { replace: true });
    if (paymentResult === 'aprovado') {
      try { localStorage.removeItem(LAST_PAYMENT_KEY); } catch { /* ignora */ }
    }
  }, [paymentResult, setSearchParams]);

  if (!isSupabaseConfigured) return <SupabaseNotConfigured />;

  const message = PAYMENT_MESSAGES[paymentResult];
  return (
    <>
      <Storefront channel="store" />
      {message && (
        <Modal isOpen={showPayment} onClose={() => setShowPayment(false)} title={message.title} maxWidthClass="max-w-md">
          <div className="flex flex-col gap-4 text-sm">
            <p className="text-text-secondary">
              {paymentResult === 'falhou' && !lastPayment?.url
                ? 'O pagamento não foi aprovado. Fale com a nossa equipe para concluir o seu pedido.'
                : message.text}
            </p>
            {lastPayment?.orders?.length > 0 && (
              <p>
                Pedido: <span className="font-mono font-semibold">{lastPayment.orders.join(', ')}</span>
              </p>
            )}
            {paymentResult === 'falhou' && lastPayment?.url ? (
              <Button onClick={() => { window.location.href = lastPayment.url; }}>Tentar pagar novamente</Button>
            ) : (
              <Button onClick={() => setShowPayment(false)}>Continuar</Button>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
