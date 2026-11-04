# Loja virtual (/store) — ligar frete e pagamento

A loja já funciona sem nada disso (só **retirada na loja**, pagamento combinado
com a equipe). Para ligar a entrega pelos Correios e o pagamento online:

## 1. Painel → Loja virtual / Tokens → "Configurações da loja"
- **Endereço para retirada**: aparece pro cliente no carrinho.
- **Peso padrão**: usado quando o produto não tem o peso dele. Em Produtos, cada
  produto tem "Embalagem para frete" — preencher o **peso de 1 unidade embalada**.
- Marcar **Oferecer entrega pelos Correios na loja**.

## 2. Tabela de frete (Correios) — sem contrato, sem credencial
A empresa não tem contrato com os Correios, então não há API oficial: o frete
sai de uma tabela preenchida no Painel (card **Tabela de frete (Correios)**).
1. No simulador de preços dos Correios (correios.com.br), simule um pacote de
   1 kg saindo da sua cidade para uma cidade de cada estado — PAC e SEDEX.
2. Para cada estado (UF) preencha: **valor até 1 kg**, **valor do kg adicional**
   e **prazo** (dias úteis). A linha "Todos" + "Aplicar a todos" ajuda a
   preencher de uma vez e depois ajustar.
3. Estado com preço em branco = aquele serviço não aparece para esse estado.

Cálculo no carrinho: o estado vem do CEP do cliente; frete = valor até 1 kg +
(kg acima de 1, arredondado pra cima) × valor do kg adicional. O peso é a soma
dos produtos do carrinho. O servidor recalcula o frete ao finalizar.
Quando os Correios reajustarem a tabela, basta atualizar os valores no Painel.

## 3. Mercado Pago (Checkout Pro)
1. mercadopago.com.br/developers → Suas integrações → **Criar aplicação**
   (tipo "Pagamentos online", produto "Checkout Pro").
2. Copiar o **Access Token de produção** (começa com `APP_USR-`).
   Para testar antes, use o Access Token de **teste** e as contas de teste do MP.
3. No Supabase → Secrets → adicionar `MP_ACCESS_TOKEN` = o token.
4. A notificação de pagamento já vai automática em cada compra
   (`/functions/v1/mp-webhook`), não precisa cadastrar URL no painel do MP.

O segredo vale na hora, sem novo deploy. O card do Painel mostra "Conectado"
quando o Mercado Pago estiver configurado e "Tabela preenchida" quando houver
preço de frete em pelo menos um estado.

## Como o pedido anda
- Só brinde + retirada → pedido vai direto para **Em produção**.
- Tem valor a pagar (itens ou frete) → pedido fica **Pendente**; quando o
  Mercado Pago aprova, muda sozinho para **Em produção**.
- Na observação do pedido aparecem: brinde/token, retirada ou endereço de
  entrega e o frete escolhido.
