# Loja virtual (/store) — ligar frete e pagamento

A loja já funciona sem nada disso (só **retirada na loja**, pagamento combinado
com a equipe). Para ligar a entrega pelos Correios e o pagamento online:

## 1. Painel → Loja virtual / Tokens → "Entrega e pagamento da loja"
- **CEP de origem**: de onde os pacotes saem.
- **Endereço para retirada**: aparece pro cliente no carrinho.
- **Embalagem padrão**: peso e medidas usados quando o produto não tem as dele.
  Em Produtos, cada produto tem "Embalagem para frete" (peso/altura/largura/comprimento
  de 1 unidade embalada) — preencher pelo menos o copo térmico e o chaveiro.

## 2. Melhor Envio (frete PAC/SEDEX)
1. Criar conta em melhorenvio.com.br (CNPJ da empresa).
2. Configurações → Permissões de acesso → **Gerar novo token**, marcando pelo
   menos `shipping-calculate` (cálculo de frete).
3. No Supabase: Project Settings → Edge Functions → **Secrets** → adicionar:
   - `MELHOR_ENVIO_TOKEN` = o token gerado
   - `MELHOR_ENVIO_CONTACT_EMAIL` = e-mail técnico de contato (o Melhor Envio pede)
   - (teste) `MELHOR_ENVIO_SANDBOX` = `true` se o token for do ambiente sandbox

## 3. Mercado Pago (Checkout Pro)
1. mercadopago.com.br/developers → Suas integrações → **Criar aplicação**
   (tipo "Pagamentos online", produto "Checkout Pro").
2. Copiar o **Access Token de produção** (começa com `APP_USR-`).
   Para testar antes, use o Access Token de **teste** e as contas de teste do MP.
3. No Supabase → Secrets → adicionar `MP_ACCESS_TOKEN` = o token.
4. A notificação de pagamento já vai automática em cada compra
   (`/functions/v1/mp-webhook`), não precisa cadastrar URL no painel do MP.

Os segredos valem na hora, sem novo deploy. O card do Painel mostra
"Conectado" quando cada um estiver configurado.

## Como o pedido anda
- Só brinde + retirada → pedido vai direto para **Em produção**.
- Tem valor a pagar (itens ou frete) → pedido fica **Pendente**; quando o
  Mercado Pago aprova, muda sozinho para **Em produção**.
- Na observação do pedido aparecem: brinde/token, retirada ou endereço de
  entrega e o frete escolhido.
