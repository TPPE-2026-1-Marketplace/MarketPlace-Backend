# API de Pagamentos — DK Fashion

Como funciona o módulo de pagamentos (`src/payments/`) e passo a passo para usá-lo.

## Visão geral

O pagamento é desacoplado do provedor por meio de um **Strategy Pattern**. O
`PaymentsService` depende da interface `IPaymentGateway`
(`src/payments/providers/payment-gateway.interface.ts`) e o provedor concreto é
escolhido em tempo de boot pela variável de ambiente
`PAYMENT_GATEWAY_PROVIDER`:

| Valor                      | Provedor               | Comportamento                                            |
| -------------------------- | ---------------------- | -------------------------------------------------------- |
| `mock` (padrão)            | `MockPaymentProvider`  | Aprova na hora (`PAID`). Sem chamada externa. Dev/testes. |
| `infinitepay`              | `InfinitePayProvider`  | Cria link de checkout hospedado e fica `PENDING` até o webhook. |

Os testes de integração forçam `mock` (`src/jest-setup-envs.js`).

## Métodos de captura e parcelas

`captureMethod` ∈ `pix` | `credit_card` | `debit_card`.

- `pix` e `debit_card`: **sempre 1 parcela** (validado no `CreatePaymentSchema`).
- `credit_card`: 1 a 12 parcelas.

## Estados

`PaymentStatus`: `pending` → `paid` | `failed` | `refunded`.
O pagamento espelha o status no pedido (`OrderStatus`): aprovação leva o pedido a
`paid`; falha/cancelamento leva a `cancelled` **e estorna o estoque**.

## Endpoints

Todos sob o prefixo `/api`.

### 1. Criar pagamento — `POST /api/payments`

Autenticado (`JwtAuthGuard`). Cliente só paga o próprio pedido; funcionários podem
pagar qualquer pedido.

```jsonc
// body
{ "idPedido": 1, "captureMethod": "pix", "installments": 1 }
```

Fluxo (transacional/atômico em `PaymentsService.create`):
1. Valida que o pedido existe, pertence ao usuário (se cliente) e está `pending`.
2. Chama `gateway.charge(valorTotal, captureMethod, installments, order)`.
3. Persiste o `Payment` com o status retornado.
4. Se o gateway retornou `paid`, marca o pedido como `paid` na mesma transação.

Respostas de erro: `404` pedido inexistente, `403` pedido de outro cliente,
`409` já pago, `400` pedido não está pendente.

Com `infinitepay`, a resposta traz `redirectUrl` (link de checkout) e o status
fica `pending` até o webhook confirmar.

### 2. Consultar pagamento do pedido — `GET /api/payments/order/:idPedido`

Autenticado. Retorna o pagamento mais recente do pedido. Cliente só consulta o
próprio pedido. Erros: `404` pedido/pagamento inexistente, `403` sem permissão.

### 3. Webhook — `POST /api/payments/webhook`

**Público** (chamado pela InfinitePay). Processa a notificação de forma idempotente:

- Já `paid` → ignora (evita duplicidade).
- Aprovado (`status` em `approved`/`paid`, ou `event=payment.approved`, ou
  `paid_amount > 0`) → marca pagamento e pedido como `paid`. `paid_amount` chega
  em **centavos** e é convertido para reais (`CENTS_PER_CURRENCY_UNIT`).
- Falha/cancelado/expirado → marca pagamento `failed`, pedido `cancelled` e
  **estorna os itens ao estoque** (com lock pessimista + log de movimentação).

## Passo a passo (modo mock, via curl)

Pré-requisitos: ambiente no ar (`make dev-up`), um pedido `pending` existente e um
token JWT do dono do pedido. O script `make demo` executa todo o fluxo
automaticamente (cadastro → catálogo → pedido → pagamento).

```bash
API=http://localhost:3001/api

# 1. Login (obtém o token)
TOKEN=$(curl -s -X POST $API/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"cliente@demo.com","senha":"cliente123"}' \
  | grep -oP '"access_token":"\K[^"]+')

# 2. Pagar o pedido #1 via PIX
curl -s -X POST $API/payments \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"idPedido":1,"captureMethod":"pix","installments":1}'
# -> { ..., "status": "paid", "paidAmount": ... }  (mock aprova na hora)

# 3. Consultar o pagamento
curl -s $API/payments/order/1 -H "Authorization: Bearer $TOKEN"
```

## Produção com InfinitePay

1. Defina `PAYMENT_GATEWAY_PROVIDER=infinitepay`, `INFINITEPAY_HANDLE` e
   `INFINITEPAY_REDIRECT_URL`.
2. `POST /api/payments` retorna `redirectUrl` → redirecione o cliente ao checkout.
3. Configure o webhook da InfinitePay apontando para `POST /api/payments/webhook`.
4. Ao concluir o pagamento, a InfinitePay chama o webhook e o pedido é confirmado.

> **Ponto aberto:** o webhook é público e confia no `order_nsu`/`invoice_slug`.
> Para produção real, considere validar uma assinatura HMAC do provedor.

## Frete (Melhor Envio)

O cálculo de frete que alimenta o `valorFrete` do pedido fica no módulo
`src/shipping/`. A obtenção e renovação do token OAuth2 estão documentadas em
[`melhor-envio-token.md`](./melhor-envio-token.md).
