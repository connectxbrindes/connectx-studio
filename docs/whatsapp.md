# Notificações por WhatsApp (Meta Cloud API)

Quando o status de um pedido muda para **Pendente**, **Cancelado** ou **Concluído**,
o sistema notifica a unidade (revendedor) pelo WhatsApp, usando a **API oficial
da Meta (WhatsApp Cloud API)**.

A estrutura de código já está pronta e publicada. Ela fica **inerte** até os
passos abaixo serem concluídos — enquanto isso, mudar status funciona normal e o
painel avisa "notificação ainda não está configurada". Depois de configurar, ela
**ativa sozinha, sem precisar de novo deploy**.

## Passo a passo (feito uma vez, na Meta)

1. **Conta**: acesse [business.facebook.com](https://business.facebook.com) e crie/verifique sua conta Meta Business.
2. **App WhatsApp**: em [developers.facebook.com](https://developers.facebook.com) → crie um app do tipo *Business* → adicione o produto **WhatsApp**.
3. **Número**: use o **número de teste** que a Meta fornece (envia para até 5 números verificados — ótimo para testar) ou cadastre/verifique o seu número próprio.
4. **Phone Number ID**: anote o **Phone Number ID** (aparece na tela de configuração da API do WhatsApp).
5. **Token**: para testes, use o token temporário da mesma tela. Para produção, crie um **System User** (Configurações do Business → Usuários do sistema) com um **token permanente** e as permissões `whatsapp_business_messaging` e `whatsapp_business_management`.
6. **Templates**: em *WhatsApp Manager → Modelos de mensagem*, crie **3 modelos**, categoria **Utility (Utilidade)**, idioma **Português (BR)**, com **2 variáveis** no corpo:

   | Nome do template (exato) | Corpo |
   |---|---|
   | `pedido_pendente` | `Olá! O pedido de {{1}}, número {{2}}, está com uma pendência. Entre em contato com o setor de produção.` |
   | `pedido_cancelado` | `Olá! O pedido de {{1}}, número {{2}}, foi cancelado.` |
   | `pedido_concluido` | `Eba! O pedido de {{1}}, número {{2}}, já está pronto para ser retirado.` |

   `{{1}}` = nome do cliente, `{{2}}` = número do pedido (ex.: `#0001`). Envie para aprovação (costuma sair em minutos/horas).

7. **Segredos no Supabase**: no painel do Supabase → *Project Settings → Edge Functions → Secrets*, adicione:
   - `WHATSAPP_TOKEN` = o token do passo 5
   - `WHATSAPP_PHONE_NUMBER_ID` = o Phone Number ID do passo 4
8. **Telefones das unidades**: em *Revendedores*, salve o telefone de cada unidade em **formato internacional** (só números, com código do país). Ex.: Brasil `5511999998888`, Espanha `34600112233`. O sistema já remove espaços/símbolos automaticamente.

## Como testar

- Cadastre uma unidade de teste com um número **verificado na Meta** (se estiver usando o número de teste).
- Mude um pedido dessa unidade para **Concluído** no painel → o WhatsApp deve receber a mensagem do template `pedido_concluido`.
- Repita para **Pendente** e **Cancelado**.

## Observações

- **Custo**: mensagem iniciada pela empresa consome uma "conversa" cobrada pela Meta (categoria Utility tem custo baixo/isento dentro de limites em muitas regiões).
- A parte técnica: Edge Function `notify-order-status` (envia via Graph API), disparada por `src/lib/whatsapp.js` a partir da tela de Pedidos (`src/pages/admin/AdminOrders.jsx`). Os textos ficam nos **templates da Meta**, não no código — para mudar o texto, edite o template no WhatsApp Manager.
