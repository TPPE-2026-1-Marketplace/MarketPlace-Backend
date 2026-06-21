# Melhor Envio — obtenção e renovação de token

Guia operacional pro shipping. Para o desenho da integração, ver `CLAUDE.md`
seção "Pontos abertos / Frete".

## Visão geral

O módulo `shipping` usa a API Melhor Envio em sandbox
(`https://sandbox.melhorenvio.com.br`). Autenticação é OAuth2 com fluxo
`authorization_code` na primeira vez (obtém access + refresh tokens), e
`refresh_token` daí em diante.

Resumo do que vive em `.env.development`:

| Variável | Origem | Validade |
|---|---|---|
| `MELHOR_ENVIO_BASE_URL` | fixo | — |
| `MELHOR_ENVIO_USER_AGENT` | livre, identifica nosso app | — |
| `MELHOR_ENVIO_CLIENT_ID` | painel sandbox → Área do Desenvolvedor → Aplicativo | permanente |
| `MELHOR_ENVIO_CLIENT_SECRET` | painel, idem | permanente |
| `MELHOR_ENVIO_REFRESH_TOKEN` | fluxo OAuth2 (passo 3 abaixo) | sem expiração documentada — renovado por rotação |
| `MELHOR_ENVIO_ACCESS_TOKEN` | fluxo OAuth2 ou primeira renovação | **30 dias** |
| `MELHOR_ENVIO_SERVICE_ID` (opcional) | livre — 1=PAC, 2=SEDEX, etc. | — |

O `MelhorEnvioTokenManager` renova o `access_token` automaticamente via
`refresh_token`, então quando OAuth2 está configurado, **você nunca precisa
substituir o ACCESS_TOKEN à mão** — basta o seed inicial.

## Cadastro inicial (uma vez por aplicativo)

1. Criar conta no sandbox em <https://sandbox.melhorenvio.com.br>.
2. No painel logado, ir em **Área do Desenvolvedor → Aplicativos → Novo**.
3. Preencher:
   - **Nome da plataforma**: `DK Fashion Backend`
   - **Site da plataforma**: URL do projeto (pode ser localhost durante dev)
   - **E-mail de contato** + **suporte técnico**: e-mail real (Melhor Envio
     contacta pra avisos)
   - **URL do ambiente de testes**: `http://127-0-0-1.nip.io:3000` (ou outro
     domínio que resolva pra 127.0.0.1 — Melhor Envio rejeita `localhost`
     direto na redirect_uri)
   - **URL de redirecionamento após autorização**: `http://127-0-0-1.nip.io:3000/callback`
   - **Descrição**: livre
4. Salvar. Anotar `client_id` e `client_secret` que aparecem.

## Fluxo OAuth2: obter o primeiro par de tokens

Esse passo é manual — só na primeira vez ou quando o refresh_token for
revogado.

### Passo 1: autorização (browser)

Abrir no browser:

```
https://sandbox.melhorenvio.com.br/oauth/authorize?
  client_id=<CLIENT_ID>
  &redirect_uri=http://127-0-0-1.nip.io:3000/callback
  &response_type=code
  &state=qualquer-string
  &scope=shipping-calculate
```

Estando logado no sandbox, aprovar o app. Vai redirecionar para
`http://127-0-0-1.nip.io:3000/callback?code=def50200...&state=...`.

O `code` aparece na URL — copiar (é uma string longa de ~600 chars). Tem
validade curta (~10 min) e só pode ser usado uma vez.

### Passo 2: trocar code por tokens

```bash
curl -X POST https://sandbox.melhorenvio.com.br/oauth/token \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "authorization_code",
    "client_id": "<CLIENT_ID>",
    "client_secret": "<CLIENT_SECRET>",
    "redirect_uri": "http://127-0-0-1.nip.io:3000/callback",
    "code": "<CODE_DO_PASSO_1>"
  }'
```

Resposta:

```json
{
  "token_type": "Bearer",
  "expires_in": 2592000,
  "access_token": "eyJ0eXAiOiJKV1Q...",
  "refresh_token": "def502004e483..."
}
```

### Passo 3: salvar em `.env.development`

```env
MELHOR_ENVIO_CLIENT_ID=<CLIENT_ID do passo 1 do cadastro>
MELHOR_ENVIO_CLIENT_SECRET=<CLIENT_SECRET do cadastro>
MELHOR_ENVIO_REFRESH_TOKEN=<refresh_token retornado>
MELHOR_ENVIO_ACCESS_TOKEN=<access_token retornado>
```

Reiniciar a API (`make dev-restart`). Daqui em diante o
`MelhorEnvioTokenManager` cuida da renovação sozinho.

## Renovação automática (rotina normal)

O `MelhorEnvioTokenManager`:

1. Lê `MELHOR_ENVIO_ACCESS_TOKEN` como seed inicial e decodifica o JWT pra
   extrair `exp`.
2. Antes de cada chamada à Melhor Envio, checa: faltam menos que 5 min pra
   expirar? Se sim, chama `POST /oauth/token` com `grant_type=refresh_token`
   automaticamente.
3. O novo `access_token` fica em memória até o próximo restart (não é
   gravado no env).

**Restart preserva o fluxo**: o seed antigo no env vai expirar em algum
momento, mas o refresh_token continua válido — o token manager renova no
primeiro request após restart sem problema. Pode esquecer do
`MELHOR_ENVIO_ACCESS_TOKEN` por dias/semanas.

## Quando intervir manualmente

### Sinal: log `WARN Melhor Envio rotacionou o refresh_token`

A Melhor Envio pode emitir um `refresh_token` novo ao renovar. Quando isso
acontece, o token manager loga warning. **Você precisa pegar esse novo
refresh_token e atualizar o env** — senão na próxima vez que a API
reiniciar, o refresh_token antigo (no env) não funciona mais.

Como capturar o novo refresh_token? Não está exposto na API atual. Duas
saídas:

- Refazer o fluxo OAuth2 (passo 1 e 2 acima) periodicamente, antes que o
  refresh rotacione.
- Ou expor `MelhorEnvioTokenManager.getCurrentRefreshToken()` num endpoint
  admin protegido (não implementado ainda).

**Em prática, para uso de disciplina (entrega 22/05), o token inicial é
suficiente.** A rotação só vira problema se o sistema rodar continuamente
por semanas.

### Sinal: `ERROR Melhor Envio retornou 401 — token inválido`

Token revogado ou refresh_token invalidado. Refazer o fluxo OAuth2 completo
do zero (passo 1 → 2 → 3).

### Sinal: muitos `WARN Melhor Envio indisponível ... frete calculado via fallback`

Possíveis causas:
- **API da Melhor Envio fora**: nada a fazer no nosso lado, fallback de
  faixas de CEP cobre. Conferir <https://status.melhorenvio.com.br>.
- **Token expirado e refresh falhando**: cheque os logs de `WARN` próximos
  pro motivo (revogação? rotation perdida?). Refazer o fluxo OAuth2 se
  necessário.

## Sandbox vs produção

Sandbox retorna **preços fictícios** — não são tabelas reais dos Correios.
Pra demo/disciplina está OK. Para uso real:

1. Trocar `MELHOR_ENVIO_BASE_URL` para `https://www.melhorenvio.com.br`.
2. Criar app no painel **de produção** (cadastro separado, exige CNPJ).
3. Refazer o fluxo OAuth2 com as credenciais de produção.
4. **Atenção**: as cotações de produção dependem de saldo/contratos da
   conta Melhor Envio. Conta pessoal de teste pode não cotar Correios sem
   cadastro de contrato.

## Referência rápida de troubleshooting

| Sintoma | Provável causa | Ação |
|---|---|---|
| `401 Unauthenticated` no `/calculate` | Token expirado/inválido | Conferir env, refazer OAuth se necessário |
| `429 Too Many Requests` | Rate limit excedido | Aumentar TTL do cache; raríssimo em uso normal |
| `422` no `/calculate` | Payload malformado | Não é problema de token — é o cliente da DK Fashion mandando dados ruins |
| Resposta 200 com array vazio ou todos com `error` | Sem cotações pra essa rota/dimensão | Esperado — fallback assume |
| `make dev-restart` e API não sobe | Token manager achou config OAuth2 incompleta E sem static token | Conferir as 4 envs ME no `.env.development` |
