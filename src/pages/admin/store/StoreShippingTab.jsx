import ShippingRatesCard from '../ShippingRatesCard';

/** Frete da loja. A entrega pelos Correios está oculta no carrinho até a API
 * oficial dos Correios ser liberada; a tabela abaixo fica pronta como reserva. */
export default function StoreShippingTab() {
  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        A entrega pelos Correios está <strong>oculta na loja</strong> por enquanto: o cliente só vê “Retirar na loja”.
        Ela volta quando a API dos Correios for liberada. A tabela abaixo fica guardada como reserva.
      </p>
      <ShippingRatesCard />
    </div>
  );
}
