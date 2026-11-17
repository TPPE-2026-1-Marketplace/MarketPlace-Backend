# Envio de e-mail (Gmail)

A API envia dois e-mails: o **link de recuperação de senha** (#250, seção
própria abaixo) e o **código de 6 dígitos de retirada na loja** (#247):

- **Automaticamente**, quando o pagamento de um pedido `tipoRetirada = "loja"` é
  confirmado (webhook da InfinitePay, aprovação imediata do gateway mock ou
  reconciliação). O envio acontece depois do commit da transação e nunca desfaz
  nem atrasa a confirmação: se falhar, fica só o aviso no log.
- **Sob demanda**, pelo painel (`Enviar código 2FA` / `Reenviar código`):
  `POST /api/orders/:id/send-pickup-code` (Caixa, Gerente ou Administrador,
  limite de 5 envios por minuto).

Destino: `person.email` da cliente cadastrada ou, no pedido de convidado,
`orders.cliente_email_avulso`. O código reenviado é sempre o mesmo gravado no
pedido (`codigo_verificacao_retirada`), o que o `confirm-pickup` valida.

| Resposta do endpoint | Quando |
| --- | --- |
| `200 { idPedido, destinatario, enviadoEm }` | Enviado. `destinatario` vem mascarado (`ma***@gmail.com`). |
| `400` | Pedido não é de retirada na loja, não está `paid`, é venda do PDV (sem código) ou não tem e-mail. |
| `404` | Pedido não existe. |
| `429` | Mais de 5 envios por minuto. |
| `503` | E-mail não configurado no servidor, ou o Gmail recusou/não respondeu (detalhe só no log). |

O código fica em `src/mail/` (`MailService` + template) e
`OrdersService.sendPickupCode` / `notifyPickupCode`.

## Recuperação de senha (#250)

O mesmo `MailService` envia o link de "Esqueci minha senha":

1. `POST /api/auth/forgot-password` `{ email }` (público, 5 por 15 min). Resposta
   **sempre** `200 { message: "Se o e-mail estiver cadastrado..." }`, exista a conta
   ou não; a geração do token e o envio rodam fora da resposta, então nem o
   tempo revela se o e-mail tem conta. Sem e-mail configurado no servidor: `503`.
2. O e-mail traz `${FRONTEND_URL}/redefinir-senha?token=...`. O token tem 32
   bytes aleatórios, vale **30 minutos** e é de **uso único**; no banco
   (`password_reset_token`) fica só o hash SHA-256. Pedir um link novo invalida
   os anteriores.
3. `POST /api/auth/reset-password` `{ token, novaSenha }` (8 a 72 caracteres):
   grava a senha com bcrypt e invalida todos os links pendentes da pessoa.
   Link inexistente, usado ou vencido: `400`.

Serve clientes e funcionários (mesmo login) e permite que a cliente cadastrada
pelo caixa, que ainda não tem senha, defina a primeira. Contas anonimizadas
(LGPD) são ignoradas. Os JWT já emitidos continuam válidos até expirar (24 h):
a API não tem revogação de token.

`FRONTEND_URL` (sem barra final) define o domínio do link; padrão
`http://localhost:3000`.

## Escolha do transporte

| `MAIL_TRANSPORT` | Como envia | Onde funciona |
| --- | --- | --- |
| `smtp` | `smtp.gmail.com` com **senha de app** | Local, Docker, Render **pago** |
| `gmail-api` | Mesma conta, via HTTPS (OAuth2 + Gmail API) | Qualquer lugar, inclusive Render **free** |

> **O plano free do Render bloqueia a saída para as portas SMTP (25, 465 e 587)**
> desde setembro de 2025 ([changelog](https://render.com/changelog/free-web-services-will-no-longer-allow-outbound-traffic-to-smtp-ports)).
> O serviço `dk-fashion-api-image` está no plano free, então em produção use
> `gmail-api` (ou suba o plano e use `smtp`).

Sem `MAIL_TRANSPORT`, a API usa o transporte cujas credenciais estiverem
completas (SMTP primeiro). Sem nenhuma, o envio fica desabilitado: o boot loga
um aviso, o endpoint responde 503 e o resto da API funciona normalmente.

## Opção 1 — Gmail via SMTP (senha de app)

1. Na conta Gmail da loja, ative a **verificação em duas etapas**
   (<https://myaccount.google.com/security>).
2. Gere uma **senha de app** em <https://myaccount.google.com/apppasswords>
   (nome: "DK Fashion API"). O Google mostra 16 letras em blocos; os espaços
   são ignorados pela API.
3. Preencha no `.env.development` (ou no ambiente do servidor):

   ```env
   MAIL_TRANSPORT=smtp
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=conta-da-loja@gmail.com
   SMTP_PASS=abcd efgh ijkl mnop
   # Opcional; padrão: "DK Fashion" <SMTP_USER>
   MAIL_FROM='DK Fashion <conta-da-loja@gmail.com>'
   ```

   A porta 465 usa TLS direto; com `SMTP_PORT=587` a conexão usa STARTTLS.
   `SMTP_SECURE=true|false` força um dos dois.
4. `make dev-restart` e confira no log: `Envio de e-mail habilitado (transporte: smtp)`.

Erros comuns no log: `EAUTH ... 535-5.7.8` = senha de app errada ou
verificação em duas etapas desligada; `ETIMEDOUT`/`ECONNECTION` = porta
bloqueada pela rede ou pelo host (caso do Render free).

O Gmail limita o envio a cerca de 500 destinatários por dia em contas
pessoais, mais que o suficiente para o volume da loja.

## Opção 2 — Gmail API via HTTPS (Render free)

Usa a mesma conta Gmail, mas autentica por OAuth2 e envia pela API REST
(porta 443), que o Render não bloqueia. Escopo pedido: só
`https://www.googleapis.com/auth/gmail.send` (enviar, sem ler a caixa).

1. Em <https://console.cloud.google.com/>, crie um projeto (ex.: "DK Fashion")
   e ative a **Gmail API** (APIs e serviços → Biblioteca).
2. **Tela de consentimento OAuth**: tipo *Externo*, adicione a conta da loja
   como usuário de teste e depois **publique o app** ("Em produção").
   Em modo *Teste* o refresh token expira em 7 dias. Como o único usuário é a
   própria loja, não é preciso passar pela verificação do Google (o aviso de
   "app não verificado" aparece só uma vez, ao autorizar).
3. **Credenciais → Criar ID do cliente OAuth** do tipo *Aplicativo da Web*, com
   URI de redirecionamento `https://developers.google.com/oauthplayground`.
   Guarde o *Client ID* e o *Client secret*.
4. No [OAuth 2.0 Playground](https://developers.google.com/oauthplayground):
   engrenagem → *Use your own OAuth credentials* (cole ID e secret) → no passo 1
   informe o escopo `https://www.googleapis.com/auth/gmail.send` → *Authorize
   APIs* entrando com a conta da loja → passo 2 *Exchange authorization code
   for tokens* → copie o **Refresh token**.
5. Configure no Render (Environment do serviço da API):

   ```env
   MAIL_TRANSPORT=gmail-api
   GMAIL_CLIENT_ID=...apps.googleusercontent.com
   GMAIL_CLIENT_SECRET=...
   GMAIL_REFRESH_TOKEN=1//...
   MAIL_FROM=DK Fashion <conta-da-loja@gmail.com>
   ```

   O `MAIL_FROM` precisa ser a própria conta (ou um alias dela); sem ele o
   Gmail usa o endereço da conta autorizada.

A API troca o refresh token por um access token (válido por ~1 h) e o
reaproveita até perto de expirar. `HTTP 400 "invalid_grant"` no log = refresh
token revogado ou expirado: repita o passo 4.

## Testar ponta a ponta (local)

```bash
make dev-up && make db-seed
# Login de funcionário (caixa/gerente/admin) e envio para um pedido "loja" pago:
TOKEN=$(curl -s localhost:3001/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@demo.com","senha":"admin123"}' | jq -r .access_token)
curl -s -X POST localhost:3001/api/orders/<id>/send-pickup-code -H "Authorization: Bearer $TOKEN"
```

Para receber o e-mail de verdade, o pedido precisa ter o e-mail de uma caixa
que você acessa (`person.email` da cliente ou `cliente_email_avulso`).

## Segurança

- Senha de app, client secret e refresh token são credenciais da conta Gmail:
  só em variável de ambiente (nunca em commit) e revogue em
  <https://myaccount.google.com/apppasswords> /
  <https://myaccount.google.com/permissions> se vazarem.
- O log registra o envio com o e-mail mascarado e nunca o código.
- O código é o mesmo do pedido; reenviar não gera um novo.
