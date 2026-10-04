# Diagnóstico — Ausência de rate limiting (login e cadastro)

> Issue: [#156](https://github.com/TPPE-2026-1-Marketplace/MarketPlace-Backend/issues/156)

## Resumo

| | |
|---|---|
| **Classe** | Falta de proteção contra força bruta / abuso de recurso (OWASP API4:2023 — Unrestricted Resource Consumption) |
| **Antes** | `@nestjs/throttler` instalado, mas sem `ThrottlerModule`/`@Throttle` em `src/`. Nenhum endpoint limitado |
| **Alvos** | `POST /auth/login` (força bruta de senha), `POST /people/register-user` (spam de cadastro) |
| **Depois** | `ThrottlerGuard` global + `@Throttle` nos endpoints sensíveis; `429` ao exceder o limite |
| **Status** | ✅ Resolvido |

---

## Limites adotados

| Alvo | Janela | Limite | Racional |
|---|---|---|---|
| Global (default) | 1 min | 60 | Generoso; não atrapalha uso normal |
| `POST /auth/login` | 15 min | 5 | Anti-força-bruta |
| `POST /people/register-user` | 15 min | 5 | Anti-spam de cadastro |
| `POST /orders`, `/orders/guest`, `/payments`, `/payments/guest` | 1 min | 10 | Criação sensível (checklist) |
| `/health`, `/health/ready` | — | isento (`@SkipThrottle`) | Health-check do Render (alta frequência) |
| `POST /payments/webhook` | — | isento (`@SkipThrottle`) | Callback do provedor; tem auth própria por segredo |

Valores centralizados em `src/common/config/throttle.config.ts` (fáceis de ajustar).

---

## Decisões

- **Guard global (`APP_GUARD: ThrottlerGuard`)** em vez de guard por rota: garante um teto em toda a API por padrão (deny-by-default), com `@Throttle` apenas apertando os pontos sensíveis e `@SkipThrottle` isentando o que precisa.
- **`app.set('trust proxy', 1)` no `main.ts`**: em produção a API fica atrás do proxy do Render. Sem confiar no primeiro salto de `X-Forwarded-For`, o throttler enxergaria sempre o IP do proxy e o limite viraria **global** (todos os clientes somando na mesma contagem) em vez de por cliente.
- **Webhook isento**: é chamado pelo provedor de pagamento (volume e origem imprevisíveis) e já é autenticado pelo segredo `x-webhook-secret`; um 429 ali derrubaria reconciliação de pagamento legítima.

---

## Metodologia

1. Confirmar a ausência via leitura estática (`grep` por `ThrottlerModule`/`@Throttle` em `src/` → zero) e teste de runtime (vários logins seguidos sem bloqueio).
2. Registrar `ThrottlerModule.forRoot` + `ThrottlerGuard` global; aplicar `@Throttle`/`@SkipThrottle` conforme a tabela.
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

`src/auth/auth.throttle.spec.ts`: sobe `AuthController` real + `ThrottlerModule` + `ThrottlerGuard` global, com `AuthService` mockado (sem banco), e martela `POST /auth/login`:

- as primeiras 5 requisições → `200`;
- a 6ª → `429`.

### Lote simétrico — antes × depois

Script `scripts/evidencia-156.sh` (rodar uma vez por lado; o limite é por IP/15 min).

| Alvo | ANTES | DEPOIS |
|---|---|---|
| `POST /auth/login` (7×) | 7× 401 | 5× 401, depois 429 |
| `POST /people/register-user` (7×) | 7× 201 | 5× 201, depois 429 |
| `GET /health` (3×) | 3× 200 | 3× 200 (imune, `@SkipThrottle`) |

### Verificação

```
pnpm typecheck   -> ok
pnpm lint        -> ok
pnpm test        -> 430 testes, 35 suítes, todos passando
```

---

## Observações

- O rate limiting por IP é mitigação, não barreira absoluta: um atacante distribuído (muitos IPs) contorna. Para login, a próxima camada natural é bloqueio/lockout por conta após N falhas — fora do escopo desta issue.
- Os limites são um ponto de partida conservador; ajustar em `throttle.config.ts` conforme telemetria real de uso.
