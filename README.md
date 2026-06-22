# Marketplace Backend — DK Fashion

API REST de um marketplace de moda, construída em **NestJS + TypeScript + TypeORM +
PostgreSQL**. Projeto da disciplina **TPPE (UnB)**.

- Documentação interativa (Swagger): `http://localhost:3001/docs` com o ambiente no ar.
- Convenções de código e estado do banco: [`CLAUDE.md`](./CLAUDE.md).
- Plano de entrega e contexto do produto: [`docs/CONTEXT.md`](./docs/CONTEXT.md).

---

## Stack

| Camada      | Tecnologia                                          |
| ----------- | --------------------------------------------------- |
| Linguagem   | TypeScript 5.7                                      |
| Framework   | NestJS 10                                           |
| ORM / Banco | TypeORM 0.3 + PostgreSQL 16 (`SnakeNamingStrategy`) |
| Validação   | Zod via `nestjs-zod` (sem `class-validator`)        |
| Auth        | JWT (`@nestjs/jwt` + `passport-jwt`), bcrypt, roles |
| Docs        | `@nestjs/swagger` em `/docs`                        |
| Infra       | Docker Compose, pnpm 10, Node 22 Alpine             |

Integrações externas: **Melhor Envio** (frete), **InfinitePay** (pagamento),
**ImgBB** (upload de imagens) — todas com mock/fallback para desenvolvimento.

---

## Como começar

Pré-requisitos: **Docker + Docker Compose** e **make**. Não é necessário Node/pnpm
no host — tudo roda em container.

```bash
# 1. Criar os arquivos de ambiente a partir dos exemplos
make env-setup

# 2. Gerar um JWT_SECRET aleatório nos .env
make gen-secrets

# 3. Subir API + Postgres (dev, com hot-reload)
make dev-up

# 4. Verificar saúde
curl http://localhost:3001/api/health      # -> {"status":"ok",...}
#    Swagger em http://localhost:3001/docs

# 5. Rodar os testes
make dev-test                # unitários
make dev-test-integration    # integração (Postgres real)

# 6. (Opcional) Rodar o fluxo de compra ponta-a-ponta
make demo
```

`make demo` recria o ambiente, semeia um admin, cria catálogo, cadastra um cliente
e executa **frete → pedido → pagamento (mock) → status**. É o jeito mais rápido de
ver a API funcionando de ponta a ponta.

### Variáveis de ambiente

Os `.env.*.example` documentam cada variável. Obrigatórias para o boot (validadas
por `src/common/config/env.validation.ts`, falha rápida se faltarem):
`POSTGRES_HOST/PORT/USER/PASSWORD/DB` e `JWT_SECRET`. As integrações externas
(Melhor Envio, InfinitePay, ImgBB) são opcionais — sem elas, usam mock/fallback.

Em desenvolvimento, `POSTGRES_HOST=postgres` (nome do serviço no compose).

---

## Comandos úteis (Makefile)

`make help` lista todos. Principais:

| Comando                     | O que faz                                           |
| --------------------------- | --------------------------------------------------- |
| `make dev-up` / `dev-down`  | Sobe / derruba o ambiente de desenvolvimento        |
| `make dev-shell`            | Shell no container da API                           |
| `make dev-logs-api`         | Logs apenas da API                                  |
| `make dev-test path=<mod>`  | Testes unitários (filtrando por módulo)             |
| `make dev-test-integration` | Testes de integração                                |
| `make dev-check`            | lint + typecheck + format:check (espelha o CI)      |
| `make dev-reset`            | Derruba tudo e **apaga os volumes** (banco incluso) |
| `make db-shell`             | `psql` no Postgres                                  |
| `make db-backup`            | Dump SQL do banco                                   |
| `make demo`                 | Fluxo de compra ponta-a-ponta                       |

> Testes e comandos pnpm sempre rodam **dentro do container** (o `node_modules` é
> um volume Docker). Use os alvos `dev-*` do `Makefile`.

---

## Arquitetura

NestJS modular, em três camadas por módulo: **Controller → Service → Repository
(TypeORM)**.

- **Controllers** expõem as rotas (`/api/...`), documentam via Swagger e aplicam
  guards de auth/role.
- **Services** concentram a regra de negócio. Operações que tocam várias tabelas
  usam `dataSource.transaction` para garantir atomicidade (ex.: pedido + estoque +
  log; pagamento + webhook + estorno).
- **DTOs** definem schema Zod + classe no mesmo arquivo; o `ZodValidationPipe`
  global valida toda entrada automaticamente.
- **Entities** mapeiam as tabelas. O `SnakeNamingStrategy` converte camelCase →
  snake_case (ex.: `ProductVariant` → `product_variant`), então não há
  `@Entity('nome')` manual (exceção: `orders`, palavra reservada no SQL).
- **Auth**: login devolve um JWT com `sub` (cpf), `email` e `role`. Rotas usam
  `@UseGuards(JwtAuthGuard)` e, quando há papel, `RolesGuard` + `@Roles(...)`.

Papéis (`src/common/enums/role.enum.ts`): `cliente`, `caixa`, `vendedor`,
`gerente`, `administrador` (hierarquia crescente).

---

## Estrutura de arquivos

```
src/
├── main.ts                 # Bootstrap: pipes/prefixo globais, Swagger
├── app.module.ts           # Raiz: ConfigModule (valida env), TypeORM, módulos
│
├── common/                 # Código compartilhado
│   ├── config/             # Validação das variáveis de ambiente (Zod)
│   ├── constants/          # Constantes de domínio (sem magic numbers)
│   ├── decorators/         # @CurrentUser(), @Roles()
│   ├── enums/              # Role
│   ├── guards/             # JwtAuthGuard, RolesGuard
│   └── utils/              # Helpers puros (ex.: intervalo de mês)
│
├── health/                 # GET /api/health (liveness, sem auth)
│
└── <módulo>/               # Um diretório por domínio. Ex.: people/
    ├── dtos/               # Schema Zod + classe DTO
    ├── entities/           # Entities TypeORM
    ├── interfaces/         # Tipos auxiliares (quando necessário)
    ├── <módulo>.controller.ts
    ├── <módulo>.service.ts
    ├── <módulo>.module.ts
    ├── <módulo>.service.spec.ts     # testes unitários
    └── <módulo>.integration.ts      # testes de integração (E2E com banco)
```

**Módulo canônico de referência:** `src/people/` — siga o mesmo padrão ao criar um
módulo novo (detalhes em `CLAUDE.md`).

Módulos de domínio: `people`, `addresses`, `employees`, `categories`, `products`,
`product-variants`, `inventory`, `coupons`, `reviews`, `orders`, `payments`,
`auth`, `images`, `sales-goals`, `shipping`, `health`.

---

## Principais fluxos e endpoints

| Domínio    | Exemplos de rota                                         |
| ---------- | -------------------------------------------------------- |
| Auth       | `POST /api/auth/login`                                   |
| Cadastro   | `POST /api/people/register-user` (auto-cadastro público) |
| Catálogo   | `GET /api/products`, `GET /api/product-variants/:sku`    |
| Estoque    | `GET /api/inventory/:sku`, `PATCH /api/inventory/:sku`   |
| Frete      | `POST /api/shipping/calculate`                           |
| Pedidos    | `POST /api/orders`, `GET /api/orders/my`                 |
| Pagamentos | `POST /api/payments`, `POST /api/payments/webhook`       |

Documentação detalhada de pagamentos: [`docs/payments.md`](./docs/payments.md).
Frete e token do Melhor Envio: [`docs/melhor-envio-token.md`](./docs/melhor-envio-token.md).

---

## Testes

- **Unitários** (`*.spec.ts`): rápidos, com mocks de repositório/transação. Incluem
  testes parametrizados (`it.each`) para regras como parcelas de pagamento,
  validação de cupom e faixas de frete.
- **Integração** (`*.integration.ts`): sobem o `AppModule` real contra um Postgres,
  limpam o estado entre testes e cobrem jornadas E2E (checkout, webhook, comissão).
  São **herméticos**: mockam as APIs externas (Melhor Envio, ImgBB, InfinitePay),
  então rodam sempre igual e não dependem de credencial nem da internet — por isso
  são seguros no CI, mas **não validam a integração real**.

```bash
make dev-test                      # todos os unitários
make dev-test path=payments        # filtra por módulo
make dev-test-integration          # integração
make dev-test-cov                  # unitários + relatório de cobertura
```

### Validação das integrações reais (fora do CI)

`make smoke-real` sobe o app e bate nos endpoints de **frete, imagem e pagamento**
contra as APIs **reais** (usando as credenciais do `.env.development`). Não reseta
o banco e não é rodado pelo CI. Cada integração é reportada como
`REAL` / `FALLBACK` / `SKIP` / `FAIL`. Use sua própria imagem com
`make smoke-real image=caminho/foto.png` (sem isso, gera um PNG 1x1).

### Cobertura

`make dev-test-cov` roda **unitários + integração** com `--coverage` (precisa do
Postgres no ar, como a integração). Assim os testes de integração contam na métrica.
O relatório vai para `coverage/` na raiz (gitignored): resumo no terminal e o HTML em
`coverage/lcov-report/index.html`. O `coverageThreshold` no `package.json` trava o
piso (statements/lines 85, functions 80, branches 70). Para iterar rápido sem banco,
use `make dev-test` (sem coverage).

---

## CI/CD

`.github/workflows/ci.yml` roda em PR/push para `dev` e `main`: `lint` (typecheck +
format:check), `build`, `test-unit` (rápido, sem banco) e `coverage`
(`pnpm test:cov` = unit + integração com Postgres de service, falhando se a
cobertura cair abaixo do `coverageThreshold`; publica o relatório como artefato).

Após os checks da `main` passarem, o workflow `CD` publica uma imagem imutável no
GHCR, envia o digest exato ao Render, aguarda o deploy ficar `live` e executa um
smoke test em `/api/health/ready`. Veja [`docs/cd.md`](./docs/cd.md).

---

## Troubleshooting

- **API não sobe / erro de variável de ambiente:** a validação no boot lista as
  variáveis faltantes. Rode `make env-setup` + `make gen-secrets` e confira o `.env.development`.
- **Erro de permissão no `node_modules`/store:** ele é um volume Docker; não rode
  `pnpm install` no host. Use `make dev-shell` ou `make dev-rebuild`.
- **Banco "sujo" ou schema desatualizado:** `make dev-reset` recria do zero
  (apaga os volumes).
- **Hot-reload não pega mudança:** `make dev-restart`.
