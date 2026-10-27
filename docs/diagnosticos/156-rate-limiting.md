# Diagnóstico — Ausência de rate limiting (login e cadastro)

> Issue: [#156](https://github.com/TPPE-2026-1-Marketplace/MarketPlace-Backend/issues/156)

## Resumo

| | |
|---|---|
| **Classe** | Falta de proteção contra força bruta / abuso de recurso (OWASP API4:2023 — Unrestricted Resource Consumption) |
| **Antes** | `@nestjs/throttler` instalado, mas sem `ThrottlerModule`/`@Throttle` em `src/`. Nenhum endpoint limitado |
| **Alvos** | `POST /auth/login` (força bruta de senha), `POST /people/register-user` (spam de cadastro) |
| **Depois** | `ThrottlerGuard` + `@Throttle` só nos endpoints de ação manual (login, cadastro, checkout); `429` ao exceder o limite |
| **Status** | ✅ Resolvido |

---

## Limites adotados

| Alvo | Janela | Limite | Racional |
|---|---|---|---|
| `POST /auth/login` | 15 min | 5 | Anti-força-bruta |
| `POST /people/register-user` | 15 min | 5 | Anti-spam de cadastro |
| `POST /orders`, `/orders/guest`, `/payments`, `/payments/guest` | 1 min | 10 | Criação sensível (checklist) |
| Demais rotas (catálogo, health, webhook, painel) | — | sem limite | Sem guard global (ver Decisões) |

Valores centralizados em `src/common/config/throttle.config.ts` (fáceis de ajustar).

---

## Decisões

- **Guard por rota (`@UseGuards(ThrottlerGuard)` + `@Throttle`)**, sem guard global. A primeira versão usava `APP_GUARD` com teto de 60 req/min, mas a verificação do release candidate mostrou que isso derrubava o catálogo (ver "Revisão: guard global removido"). O limite fica só nas rotas acionadas manualmente pelo usuário, que não geram rajadas legítimas.
- **Teste de proteção da regra** (`src/common/config/throttle.routes.spec.ts`): sem guard global, um `@Throttle` sem `ThrottlerGuard` não limita nada, em silêncio. O spec exige o guard em toda rota com `@Throttle` e garante que as rotas do catálogo não têm limite.
- **`app.set('trust proxy', 1)` no `main.ts`**: em produção a API fica atrás do proxy do Render. Sem confiar no primeiro salto de `X-Forwarded-For`, o throttler enxergaria sempre o IP do proxy e o limite viraria **global** (todos os clientes somando na mesma contagem) em vez de por cliente.
- **Webhook sem limite**: é chamado pelo provedor de pagamento (volume e origem imprevisíveis) e já é autenticado pelo segredo `x-webhook-secret`; um 429 ali derrubaria reconciliação de pagamento legítima.

---

## Metodologia

1. Confirmar a ausência via leitura estática (`grep` por `ThrottlerModule`/`@Throttle` em `src/` → zero) e teste de runtime (vários logins seguidos sem bloqueio).
2. Registrar `ThrottlerModule.forRoot`; aplicar `ThrottlerGuard` + `@Throttle` nas rotas da tabela.
3. Provar o `429` com teste automatizado e com lote de evidência simétrico (antes/depois).

---

## Evidências

### Baseline — sem rate limiting (código vulnerável)

12 logins consecutivos com credenciais inválidas, todos aceitos sem bloqueio:

```
tentativa  1 -> 401
tentativa  2 -> 401
...
tentativa 12 -> 401
```

Nenhum `429` — confirma a ausência de limite.

### Teste automatizado do 429

`src/auth/auth.throttle.spec.ts`: sobe `AuthController` real + `ThrottlerModule`, sem guard global (o guard vem da própria rota), com `AuthService` mockado (sem banco), e martela `POST /auth/login`:

- as primeiras 5 requisições → `200`;
- a 6ª → `429`.

### Lote simétrico — antes × depois

Script `scripts/evidencia-156.sh` (rodar uma vez por lado; o limite é por IP/15 min).

| Alvo | ANTES | DEPOIS |
|---|---|---|
| `POST /auth/login` (7×) | 7× 401 | 5× 401, depois 429 |
| `POST /people/register-user` (7×) | 7× 201 | 5× 201, depois 429 |
| `GET /health` (3×) | 3× 200 | 3× 200 (sem limite) |

### Verificação

```
pnpm typecheck   -> ok
pnpm lint        -> ok
pnpm test        -> 430 testes, 35 suítes, todos passando
```

---

## Revisão: guard global removido

Achado na verificação do release candidate (`dev` + #198 + #201 + #197) com a imagem de produção. O `fetchProducts` do frontend (`src/lib/catalog.ts`) faz 1 requisição da lista + 2 por variante (`/inventory/:sku` e `/images/catalog/:sku`). O `@nestjs/throttler` conta por IP **e por handler**, então o guard global limitava cada um desses endpoints a 60 variantes/min por IP. Acima disso, o frontend recebe `429`, cai no `Promise.allSettled` e mostra o produto **sem estoque e sem imagem**, sem erro visível. Afeta catálogo, painel do gerente (100 produtos), conta/favoritos (200) e o caixa (POS), onde todos os terminais da loja saem pelo mesmo IP.

Script: `scripts/evidencia-156-catalogo.sh` (simula uma carga de catálogo de um único IP).

```
<colar aqui a saída de: bash scripts/evidencia-156-catalogo.sh ANTES>
```

```
<colar aqui a saída de: bash scripts/evidencia-156-catalogo.sh DEPOIS>
```

---

## Observações

- **`trust proxy = 1` ainda não verificado no Render.** Se houver mais de um proxy na frente da API (relatos citam Cloudflare + balanceador), o `req.ip` vira o IP de um proxy e o limite de login passa a ser compartilhado entre clientes. Confirmar o número de saltos antes de levar a `main`.

- O rate limiting por IP é mitigação, não barreira absoluta: um atacante distribuído (muitos IPs) contorna. Para login, a próxima camada natural é bloqueio/lockout por conta após N falhas — fora do escopo desta issue.
- Os limites são um ponto de partida conservador; ajustar em `throttle.config.ts` conforme telemetria real de uso.
