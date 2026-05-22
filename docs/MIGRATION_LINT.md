# Migração das branches abertas para a nova base (CI + lint + constants)

> Doc temporário. Pode deletar quando todas as branches abaixo forem mergeadas em `dev`.

## Contexto

A branch `feat/implemenitng-cicd-lint` introduziu:

- ESLint estrito + Prettier + Husky (pre-commit roda lint-staged no container)
- `src/common/constants/` (paginação, bcrypt, Postgres ports, comissão padrão, etc.)
- Workflow GitHub Actions (`.github/workflows/ci.yml`) que valida lint + typecheck + format + testes em PR pra `dev`/`main`
- Reformatação massiva via `lint:fix` + `prettier` em ~80 arquivos do `src/`
- Fix do `images.integration.ts` (faltava setup de auth)

Branches abertas precisam puxar essa base antes do próximo merge em `dev`.

## Sequência geral

1. **Antes de qualquer coisa**: a branch `feat/implemenitng-cicd-lint` precisa virar PR e ser merged em `dev`. Sem isso, nada do que vem abaixo faz sentido.
2. Pra cada feature branch aberta, atualizar via `git merge origin/dev` (NÃO rebase em branch compartilhada).
3. Rodar `make dev-lint-fix` + `make dev-format` pra normalizar conflitos de estilo.
4. Rodar `make dev-check` localmente antes de pushar.
5. Substituir magic numbers conhecidos pelas constantes de `src/common/constants/` (ver checklist abaixo).

## Branches abertas conhecidas

Identificadas via `git branch -r`. Confirmar quais ainda estão ativas (algumas podem já ter sido fechadas sem merge):

| Branch | Escopo aparente | Status |
|---|---|---|
| `26-d4-avaliações-reviews` | D4 (reviews) + D5 (coupons) + D6 (orders) — 1 commit grande | **ABERTA** |
| `30-d8-entrega-frete-shipping` | D8 — módulo shipping | Verificar |
| `74-featshipping-criar-módulo-shipping` | sub-tarefa D8 | Verificar |
| `75-featshipping-integração-com-api-dos-correios` | sub-tarefa D8 | Verificar |
| `76-featshipping-endpoint-post-apishippingcalculate` | sub-tarefa D8 | Verificar |
| `77-choreshipping-fallback-de-cálculo-por-faixas-de-cep-plano-b2` | sub-tarefa D8 (plano B) | Verificar |

Todas as demais (`22-`, `23-`, `24-`, `25-`, `33-` até `49-`) já foram merged em PRs anteriores — ignorar.

## Foco atual: `26-d4-avaliações-reviews`

Arquivos que essa branch toca (29 no total):

**Módulos novos** (sem conflito de existência, vão entrar inteiros):
- `src/coupons/` (controller, service, module, entity, 2 DTOs, integration test)
- `src/orders/` (controller, service, module, 2 entities, 5 DTOs, integration test)
- `src/reviews/` (controller, service, module, entity, DTO, integration test)

**Módulos existentes que ela altera** (conflito esperado com a base nova):
- `CLAUDE.md` — você adicionou seções de lint/CI na base; a 26 provavelmente adicionou seções de reviews/orders/coupons. Resolver manualmente, mantendo ambos.
- `src/people/people.controller.ts` — base usa `PAGINATION_*` constants; 26 pode ter adicionado endpoints novos.
- `src/people/people.service.ts` — base centralizou `BCRYPT_ROUNDS` e `PG_UNIQUE_VIOLATION` em `src/common/constants`; 26 pode ter adicionado métodos.
- `src/people/people.integration.ts` — não existia na base, é novo da 26.
- `src/products/entities/product.entity.ts` — base só reformatou; 26 deve ter adicionado relação com `Review`/`OrderItem`.

### Procedimento para a 26-d4

```bash
# 1. Pré-requisito: feat/implemenitng-cicd-lint precisa estar merged em dev
git fetch origin
git checkout 26-d4-avaliações-reviews

# 2. Trazer a base nova
git merge origin/dev
# vai dar conflito em CLAUDE.md, src/people/*, src/products/entities/product.entity.ts
# resolver manualmente — pra estilo (prettier/imports) aceite a versão de dev,
# pra LÓGICA da 26 mantenha a versão da feature.

# 3. Subir o container (precisa pra lint-staged no pre-commit funcionar)
make dev-up

# 4. Normalizar estilo
make dev-lint-fix
make dev-format

# 5. Substituir magic numbers nos arquivos novos
# Procurar e trocar:
#   default(20) / default(1) / max(100)  →  PAGINATION_* de src/common/constants
#   bcrypt.hash(senha, 10)                →  BCRYPT_ROUNDS
#   bcrypt.genSalt(10)                    →  BCRYPT_ROUNDS
#   '23505' (códigos PG)                  →  PG_UNIQUE_VIOLATION
#   process.env.POSTGRES_PORT ?? 5432    →  DEFAULT_POSTGRES_PORT
#   0.025 (taxa comissão)                 →  EMPLOYEE_DEFAULT_COMMISSION_RATE
# Comando útil:
grep -rn "default(20)\|default(1)\|max(100)\|genSalt(10)\|hash(.*, 10)\|'23505'\|?? 5432" src/coupons src/orders src/reviews

# 6. Integration tests novos (coupons/orders/reviews) provavelmente vão ter o
# mesmo problema que images.integration tinha: faltar AuthModule + setup de
# admin pra fazer requests autenticados. Replicar o padrão de
# src/images/images.integration.ts (beforeAll cria Person+Employee admin e
# obtém JWT via POST /api/auth/login).

# 7. Validar tudo
make dev-check
make dev-test
make dev-test-integration

# 8. Commit + push
git add -u
git commit -m "chore(merge): integrar base de lint/CI na branch 26-d4"
git push
```

### Checklist por arquivo (26-d4)

Marcar conforme for atualizando:

- [ ] `CLAUDE.md` — resolver merge mantendo ambas as seções (lint/CI da base + reviews/orders/coupons da 26)
- [ ] `src/coupons/coupons.controller.ts` — magic numbers de paginação
- [ ] `src/coupons/coupons.service.ts` — `PG_UNIQUE_VIOLATION`, paginação, bcrypt se aplicável
- [ ] `src/coupons/dtos/*.dto.ts` — `PAGINATION_*`
- [ ] `src/coupons/coupons.integration.ts` — replicar setup de auth de `images.integration.ts`
- [ ] `src/orders/orders.controller.ts` — magic numbers de paginação
- [ ] `src/orders/orders.service.ts` — `PG_UNIQUE_VIOLATION`, paginação, datas/timeouts
- [ ] `src/orders/dtos/*.dto.ts` — `PAGINATION_*`
- [ ] `src/orders/orders.integration.ts` — replicar setup de auth
- [ ] `src/reviews/reviews.controller.ts` — magic numbers de paginação, `nota` 1-5 fica nas DTOs (override ESLint já permite)
- [ ] `src/reviews/reviews.service.ts` — `PG_UNIQUE_VIOLATION`, paginação
- [ ] `src/reviews/dtos/create-review.dto.ts` — magic numbers OK nas DTOs (override ativo)
- [ ] `src/reviews/reviews.integration.ts` — replicar setup de auth
- [ ] `src/people/people.controller.ts` — manter mudanças da 26, aceitar imports/format da base
- [ ] `src/people/people.service.ts` — idem
- [ ] `src/people/people.integration.ts` — replicar setup de auth (arquivo novo)
- [ ] `src/products/entities/product.entity.ts` — manter relações novas da 26, aceitar format da base
- [ ] `make dev-check` passa (0 errors)
- [ ] `make dev-test` passa
- [ ] `make dev-test-integration` passa
- [ ] CI verde no PR

## Procedimento genérico (outras branches D8/shipping)

Mesmo fluxo da 26, com adaptações:

```bash
git checkout <branch>
git merge origin/dev
make dev-up
make dev-lint-fix && make dev-format
# substituir magic numbers (grep acima)
# replicar setup de auth nos integration tests novos
make dev-check && make dev-test && make dev-test-integration
git push
```

## Dica: limpar `git blame` do commit massivo

Pra não poluir `git blame` com o commit `b9c8b0d` (reformatação + lint:fix em 86 arquivos), criar `.git-blame-ignore-revs` na raiz do repo:

```
# Reformatação massiva pós-introdução de ESLint + Prettier
b9c8b0d
```

E pedir pra cada dev configurar localmente:

```bash
git config blame.ignoreRevsFile .git-blame-ignore-revs
```

GitHub web e ferramentas como `git blame --ignore-revs-file` respeitam isso automaticamente.
