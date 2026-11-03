# Integração Studio → Corrida (campanha de vendedores)

O banco do Studio avisa a Corrida a cada item de pedido feito por um revendedor
com o campo **Vendedor** preenchido. A Corrida não tem acesso ao banco do Studio.

- Gatilho: `trg_order_corrida_brindes` em `orders` (função `notify_corrida_brindes`)
- Destino: `https://sdrjltuedkmynkdtcdjz.supabase.co/functions/v1/corrida-brindes`
- Cabeçalho: `x-chave` (lido do Vault do Studio, segredo `corrida_brindes_key`)
- Não envia dados do cliente (nome, telefone, e-mail).
- Só envia pedidos das unidades listadas na tabela `corrida_resellers`.

## Unidades participantes

Hoje: KingCase Unidade Espanha, as duas "Kingcase Comercio De Acessorios…" (Kingcase ESPANHA e Kingcase JK),
ASSIST CARREFOUR (ASSIST SMART EXPRESS LTDA.) e Mr Magri.

```sql
-- ver
select r.name, r.short_name from corrida_resellers c join resellers r on r.id = c.reseller_id;
-- incluir / tirar
insert into corrida_resellers (reseller_id) select id from resellers where short_name = 'APELIDO';
delete from corrida_resellers where reseller_id = (select id from resellers where short_name = 'APELIDO');
```

## Ligar

No Supabase do Studio (projeto Gerenciador) › SQL Editor:

```sql
select vault.create_secret('COLE_A_CHAVE_AQUI', 'corrida_brindes_key');
```

Sem esse segredo o gatilho não envia nada. Para trocar a chave:

```sql
select vault.update_secret(id, 'NOVA_CHAVE') from vault.secrets where name = 'corrida_brindes_key';
```

## Quando envia

| Situação no Studio | `type` enviado |
|---|---|
| Pedido novo com vendedor | `INSERT` |
| Vendedor ou quantidade alterados | `UPDATE` |
| Pedido cancelado (ou apagado) | `DELETE` (deve sair da pontuação) |
| Pedido cancelado volta a valer | `INSERT` |
| Pedido sem vendedor (Master, loja virtual) ou de unidade fora da campanha | nada |

Mudanças de status comuns (em produção, concluído…) não geram envio.

## Formato (igual ao Database Webhook do Supabase)

```json
{
  "type": "INSERT",
  "table": "orders",
  "schema": "public",
  "record": {
    "id": "uuid", "order_number": "PED-…", "sequence_number": 108,
    "vendedor": "João", "seller_name": "João",
    "unidade": "Nome da unidade", "reseller_id": "uuid", "reseller_name": "Nome da unidade",
    "data": "2026-11-01", "created_at": "2026-11-01T13:00:00+00:00",
    "quantidade": 1, "quantity": 1, "status": "pending"
  },
  "old_record": null
}
```

Em `DELETE`, `record` é `null` e os dados vêm em `old_record`. `data` é o dia do
pedido no horário de Brasília. Cada linha é um item do pedido; `quantidade` é o número de peças.

## Conferir envios

As respostas ficam guardadas por cerca de 6 horas. A tabela também tem respostas de outros jobs
(sincronização Tiny); as da Corrida são as que não citam "tiny":

```sql
select id, status_code, left(content, 200), error_msg, created from net._http_response
where coalesce(content, '') not ilike '%tiny%' order by created desc limit 20;
```
