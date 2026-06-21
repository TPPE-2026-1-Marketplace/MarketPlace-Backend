# CLAUDE.md — Marketplace Backend (DK Fashion)

Convenções de código e estado do banco. Para plano de entrega, equipe e datas,
ver `docs/PROJECT.md`.

---

## Stack

- **TypeScript 5.7** + **NestJS 10** + **TypeORM 0.3**
- **PostgreSQL 16**, naming strategy: `SnakeNamingStrategy` (de `typeorm-naming-strategies`)
- **Validação: Zod via `nestjs-zod`** (NÃO usar `class-validator` / `class-transformer`)
- **Auth:** JWT (`@nestjs/jwt` + `@nestjs/passport` + `passport-jwt`)
- **Hash de senha:** bcrypt
- **Swagger:** `@nestjs/swagger` em `/docs`
- **pnpm 10** + Node 22 Alpine + Docker Compose

### Dependências que NÃO usar

-  `class-validator` / `class-transformer` (substituídos por Zod)
-  `moment` (use `date-fns`)
-  Prisma, Mongoose (já decidido TypeORM)

---

## Padrões a seguir ao adicionar um módulo

**Antes de criar um módulo novo, leia `src/people/` como referência.** Ele é
o módulo canônico — repita o mesmo padrão.

### Estrutura de pastas

```
src/people/
├── dtos/
│   ├── create-person.dto.ts      # schema Zod + classe DTO no mesmo arquivo
│   └── update-person.dto.ts
├── entities/
│   └── person.entity.ts
├── interfaces/
│   └── person.interface.ts
├── people.controller.ts
├── people.module.ts
└── people.service.ts
```

Subpastas `controllers/` e `services/` só quando o módulo tiver mais de um
arquivo desse tipo. Não criar profilaticamente.

### Convenções

- **DTO + schema Zod no mesmo arquivo.** Schema exportado nomeadamente
  (`CreatePersonSchema`), classe `extends createZodDto(schema)`.
- **Entity sem `@Entity('nome_manual')`** — o SnakeNamingStrategy resolve
  (classe `ProductVariant` → tabela `product_variant`).
- **Colunas em português** (`cpf`, `nome`, `email`, `senha`, `id_pedido`,
  `data_pedido`, `valor_total`, `tipo_retirada`). Refletem o domínio.
  camelCase no TypeScript → snake_case no banco automaticamente.
- **Service nunca retorna senha.** Use método `stripPassword` ou interface
  `IPersonSafe` (ver `src/people/people.service.ts`).
- **Controller documentado:** `@ApiTags()` no controller, `@ApiOperation()`
  + `@ApiResponse()` em cada endpoint. Não precisa duplicar schema com
  `@ApiProperty` — o `nestjs-zod` gera a partir do Zod.
- **Paginação padrão:** `?page=1&limit=20`, max `limit=100`. Resposta:
  `{ data: [...], meta: { page, limit, total, totalPages } }`.
  Schema Zod usa `z.coerce.number()` (query params chegam como string).
  Service recebe `(page: number, limit: number)` separados — não o DTO inteiro.
  `PaginationSchema`/`PaginationDto` compartilhados vivem em
  `src/common/dtos/pagination.dto.ts` (importe via `from '../common/dtos'`).
  Usados em `people` e `employees`.
- **Versionamento:** prefixo único `/api`, sem `/v1`.

### Tradução `class-validator` → Zod

Documentos antigos do projeto e issues podem mencionar decorators do
`class-validator`. Tradução direta:

| `class-validator`        | Zod equivalente              |
| ------------------------ | ---------------------------- |
| `@IsString()`            | `z.string()`                 |
| `@IsEmail()`             | `z.string().email()`         |
| `@IsInt()`               | `z.number().int()`           |
| `@Min(1) @Max(5)`        | `z.number().min(1).max(5)`   |
| `@MaxLength(2000)`       | `z.string().max(2000)`       |
| `@IsOptional()`          | `.optional()`                |
| `@IsEnum(MyEnum)`        | `z.nativeEnum(MyEnum)`       |
| `@IsUUID()`              | `z.string().uuid()`          |
| `@IsPositive()`          | `z.number().positive()`      |

---

## Auth e roles

- Login: `POST /api/auth/login` retorna `{ access_token }`
- Payload do JWT: `sub` (cpf), `email`, `role`
- Endpoints protegidos: `@UseGuards(JwtAuthGuard)`
- Com role: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('admin', 'gerente')`
- `@CurrentUser()` decorator para acessar o user no controller
- Senhas hasheadas com bcrypt antes de persistir

### Roles (em `src/common/enums/role.enum.ts`)

```typescript
export enum Role {
  CLIENTE = 'cliente',
  CAIXA = 'caixa',
  VENDEDOR = 'vendedor',
  GERENTE = 'gerente',
  ADMINISTRADOR = 'administrador',
}
```

`CLIENTE` é role de acesso externo — qualquer `Person` sem vínculo com `Employee`.
Hierarquia de funcionários (cada nível inclui o anterior):

- `caixa`: registro de vendas, associar vendedores
- `vendedor`: + participação em ranking e comissão
- `gerente`: + controle de estoque + dashboards
- `administrador`: + gestão de funcionários, cupons, dados

---

## Pipes e filtros globais

`ZodValidationPipe` registrado globalmente em `main.ts` (`app.useGlobalPipes`).
Toda classe DTO que extends `createZodDto(schema)` é validada automaticamente
antes de chegar ao controller — sem precisar de `@UsePipes()` no endpoint.

### Validação de variáveis de ambiente (boot)

`ConfigModule.forRoot({ validate: validateEnv })` valida o `process.env` no boot
via Zod (`src/common/config/env.validation.ts`). Faltando uma variável obrigatória
(`POSTGRES_*`, `JWT_SECRET`), a app falha rápido com mensagem listando o que falta.
Integrações externas (Melhor Envio, InfinitePay, ImgBB) são opcionais. Ao adicionar
uma variável de ambiente nova e obrigatória, inclua-a nesse schema.

### Health check

`GET /api/health` (módulo `src/health/`, sem auth) retorna `{ status, timestamp }`.
É usado pelo `HEALTHCHECK` do `Dockerfile` (estágio `runner`) e pelo healthcheck do
serviço `api` no `compose.prod.yml`.

### Resposta de erro padronizada (pendente)

`AllExceptionsFilter` **ainda não implementado** — mencionado no design mas
ausente em `src/common/filters/`. Erros de validação do Zod retornam o formato
padrão do `nestjs-zod`. Formato alvo quando implementado:

```json
{
  "statusCode": 400,
  "timestamp": "2026-05-17T14:32:10.123Z",
  "path": "/api/people",
  "method": "POST",
  "message": "Validation failed",
  "errors": [{ "field": "email", "message": "Invalid email format" }]
}
```

---

## Estado do banco

**Naming strategy:** `SnakeNamingStrategy` global. Não usar `@Entity('nome')`.
**Dev:** `synchronize: true` + `autoLoadEntities: true` — schema reflete as
entities automaticamente. Apagar volume do Docker (`make dev-reset`) recria
do zero.

### Mapeamento diagrama ER → código

Diagrama em português, código em inglês. Colunas mantêm os nomes do diagrama.

| Diagrama (PT)         | Entity (EN)         | Tabela (banco)        |
| --------------------- | ------------------- | --------------------- |
| Pessoa                | `Person`            | `person`              |
| Endereco              | `Address`           | `address`             |
| Funcionario           | `Employee`          | `employee`            |
| Categoria             | `Category`          | `category`            |
| Produto               | `Product`           | `product`             |
| Produto_Categoria     | (junção N:N)        | `product_category`    |
| Variante_Produto      | `ProductVariant`    | `product_variant`     |
| Imagem                | `Image`             | `image`               |
| Imagem_Catalogo       | `CatalogImage`      | `catalog_image`       |
| Estoque               | `Stock`             | `stock`               |
| Log_Estoque           | `StockLog`          | `stock_log`           |
| Cupom                 | `Coupon`            | `coupon`              |
| Pedido                | `Order`             | `orders` *            |
| Item_Pedido           | `OrderItem`         | `order_item`          |
| Pagamento             | `Payment`           | `payment`             |
| Avaliacao_Produto     | `Review`            | `review`              |
| (nova)                | `SalesGoal`         | `sales_goal`          |

*Nota: `order` é palavra reservada no SQL. Usar `@Entity('orders')` é a única
exceção à regra de não nomear manualmente.

### Tabelas implementadas

#### `person` ✅ (issue #33)

PK: `cpf` (varchar 11, sem máscara).

| Coluna     | Tipo          | Constraint        |
| ---------- | ------------- | ----------------- |
| `cpf`      | varchar(11)   | PK                |
| `nome`     | varchar(120)  | NULL              |
| `email`    | varchar(160)  | UNIQUE, NOT NULL  |
| `telefone` | varchar(20)   | NULL              |
| `senha`    | varchar(120)  | NULL (hash bcrypt)|

**Notas:**
- `nome` é nullable para suportar auto-cadastro pelo website (US02) — usuário
  pode criar conta com só email + senha e preencher nome depois.
- `senha` é nullable para suportar cadastro pelo caixa (US11) — cliente sem
  senha não consegue fazer login (validação no AuthService).

#### `employee` ✅ (issue #46)

Especialização 1:1 de `person`. PK = FK.

| Coluna               | Tipo          | Constraint                        |
| -------------------- | ------------- | --------------------------------- |
| `cpf`                | varchar(11)   | PK, FK → `person.cpf`             |
| `ativo`              | boolean       | DEFAULT true                      |
| `role_perfil`        | enum Role     | NOT NULL                          |
| `taxa_comissao`      | numeric(5,4)  | DEFAULT 0.025 (2,5%)              |
| `meta_vendas`        | numeric(12,2) | NULL                              |
| `codigo_funcionario` | varchar(20)   | UNIQUE, NULL                      |

**Notas:**
- `create` retorna `senha_temporaria` em texto plano para o admin repassar ao funcionário.
- `eager: true` na relação com `Person` — sempre carrega person aninhada, sem senha.

#### `address` ✅ (issue #45)

| Coluna        | Tipo    | Constraint            |
| ------------- | ------- | --------------------- |
| `id`          | serial  | PK                    |
| `cpf_pessoa`  | varchar(11) | FK → `person.cpf` |
| `cep`         | varchar(8)  | NOT NULL              |
| `logradouro`  | varchar | NOT NULL              |
| `numero`      | varchar | NOT NULL              |
| `complemento` | varchar | NULL                  |
| `bairro`      | varchar | NOT NULL              |
| `cidade`      | varchar | NOT NULL              |
| `uf`          | varchar(2) | NOT NULL             |

**Notas:**
- Criada junto com `registerUser` (fluxo 2) quando `endereco` vem no payload.
- `AddressesService.create(cpf, dto)` é o método público — usado pelo `PeopleService`.

#### `category` ✅ (issue #D1)

| Coluna        | Tipo        | Constraint |
| ------------- | ----------- | ---------- |
| `id_categoria`| serial      | PK         |
| `nome`        | varchar(80) | NOT NULL   |

**Nota:** a constraint UNIQUE em `nome` prevista no diagrama **não foi aplicada** na entity — sem `unique: true` no `@Column`. Confirmar se é intencional.

#### `product` ✅ (issue #D1)

| Coluna        | Tipo           | Constraint        |
| ------------- | -------------- | ----------------- |
| `id_produto`  | serial         | PK                |
| `titulo`      | varchar(180)   | NOT NULL          |
| `descricao`   | text           | NULL              |
| `destaque`    | boolean        | DEFAULT false     |
| `qual_medida` | varchar(80)    | NULL              |
| `material`    | varchar(120)   | NULL              |
| `composicao`  | varchar(180)   | NULL              |
| `silhueta`    | varchar(120)   | NULL              |
| `tags`        | simple-array   | NULL (varchar CSV interno ao TypeORM) |
| `preco_base`  | numeric(10,2)  | NOT NULL          |
| `sku`         | varchar(80)    | UNIQUE, NOT NULL  |

Relação N:N com `category` via `@JoinTable({ name: 'product_category' })`.
Colunas da junção: `product_id` → `product.id_produto`, `category_id` → `category.id_categoria`.

#### `product_variant` ✅ (issue #D1)

| Coluna           | Tipo           | Constraint                  |
| ---------------- | -------------- | --------------------------- |
| `codigo_sku`     | varchar(**80**)| PK ⚠️ (diagrama dizia 40)   |
| `id_produto`     | int            | FK → `product.id_produto`   |
| `preco_variante` | numeric(12,2)  | NOT NULL                    |
| `ativo`          | boolean        | DEFAULT true                |
| `cor`            | varchar(80)    | NULL                        |
| `tamanho`        | varchar(40)    | NULL                        |
| `medidas`        | jsonb          | NULL (interface `Measurements` em `product-variants/interfaces/`) |

#### `image` ✅ (issue #D1)

| Coluna               | Tipo         | Constraint |
| -------------------- | ------------ | ---------- |
| `id_imagem`          | serial       | PK         |
| `url`                | text         | NOT NULL   |
| `ordem`              | int          | DEFAULT 0  |
| `descricao`          | varchar(255) | NULL       |
| `local_renderizacao` | varchar(120) | NULL       |

#### `catalog_image` ✅ (issue #D1)

PK composta (`id_imagem`, `codigo_sku`).

| Coluna            | Tipo        | Constraint                        |
| ----------------- | ----------- | --------------------------------- |
| `id_imagem`       | int         | PK, FK → `image.id_imagem`        |
| `codigo_sku`      | varchar(40) | PK, FK → `product_variant.codigo_sku` |
| `ordem_no_catalogo` | int       | DEFAULT 0                         |

#### `stock` ✅ (issues #50–52)

| Coluna            | Tipo        | Constraint                                  |
| ----------------- | ----------- | ------------------------------------------- |
| `codigo_sku`      | varchar(40) | PK, FK → `product_variant.codigo_sku` (1:1) |
| `qtd_online`      | int         | DEFAULT 0, CHECK >= 0                       |
| `qtd_loja_fisica` | int         | DEFAULT 0, CHECK >= 0                       |

**Notas:**
- Registro criado automaticamente no primeiro `adjust` caso a variante ainda não tenha estoque.
- `adjust` usa `dataSource.transaction` para garantir atomicidade com o `StockLog`.

#### `stock_log` ✅ (issues #50, #53–54)

| Coluna                   | Tipo                                     | Constraint                        |
| ------------------------ | ---------------------------------------- | --------------------------------- |
| `id_log`                 | serial                                   | PK                                |
| `codigo_sku`             | varchar(40)                              | FK → `product_variant.codigo_sku` |
| `id_pedido`              | int                                      | NULL (sem FK TypeORM até orders existir) |
| `tipo_movimentacao`      | enum (entrada, saida, ajuste, venda)     | NOT NULL                          |
| `quantidade_movimentada` | int                                      | NOT NULL                          |
| `data_criacao`           | timestamp                                | DEFAULT now()                     |
| `valor_anterior_online`  | int                                      |                                   |
| `valor_novo_online`      | int                                      |                                   |
| `valor_anterior_loja`    | int                                      |                                   |
| `valor_novo_loja`        | int                                      |                                   |
| `origem`                 | varchar(80)                              | NULL (cpf do usuário)             |
| `motivo`                 | varchar(200)                             | NULL                              |

**Notas:**
- Gerado automaticamente em toda alteração de `Stock`, na mesma transação.
- Quando o módulo `orders` for implementado, adicionar `@ManyToOne(() => Order)` em `id_pedido`.

### Demais tabelas (implementadas)

> **Status:** todas as tabelas abaixo (`coupon`, `review`, `orders`,
> `order_item`, `payment`, `sales_goal`) **já foram implementadas**. As definições
> a seguir descrevem a forma esperada pelo diagrama ER — use-as como referência ao
> manter o código. Detalhes que divergem do código real (ex.: tamanho de coluna)
> devem ser confirmados na entity correspondente em `src/<módulo>/entities/`.
> **Sempre que mexer numa entity, conferir aqui se a FK aponta pra coluna certa**
> (várias apontam pra `person.cpf`, não `person.id`).

#### `coupon` (D5)

| Coluna                | Tipo           | Constraint   |
| --------------------- | -------------- | ------------ |
| `numero_do_cupom`     | varchar(40)    | PK           |
| `tipo_cupom`          | enum (percentual, valor_fixo) | NOT NULL |
| `valor_desconto`      | numeric(10,2)  | NOT NULL     |
| `ativo`               | boolean        | DEFAULT true |
| `data_inicio`         | timestamp      | NOT NULL     |
| `data_fim`            | timestamp      | NOT NULL (CHECK > data_inicio) |
| `uso_maximo`          | int            | NULL (sem limite se NULL) |
| `nome_influenciador`  | varchar        | NULL         |

Relação N:N com `product` (cupons elegíveis para certos produtos).

#### `review` (D4)

PK composta (cpf_cliente, id_produto) — uma avaliação por cliente por produto.

| Coluna           | Tipo          | Constraint                  |
| ---------------- | ------------- | --------------------------- |
| `cpf_cliente`    | varchar(11)   | PK, FK → `person.cpf`       |
| `id_produto`     | int           | PK, FK → `product.id_produto` |
| `nota`           | int           | CHECK BETWEEN 1 AND 5       |
| `comentario`     | varchar(2000) | NULL                        |
| `data_avaliacao` | timestamp     | DEFAULT now()               |

#### `orders` (D6) — **nome de tabela manual**

`order` é palavra reservada. Usar `@Entity('orders')`.

| Coluna                          | Tipo                                                     | Constraint                          |
| ------------------------------- | -------------------------------------------------------- | ----------------------------------- |
| `id_pedido`                     | serial                                                   | PK                                  |
| `id_usuario`                    | varchar(11)                                              | FK → `person.cpf`, NULL (venda presencial pode não ter cliente cadastrado) |
| `id_cupom`                      | varchar(40)                                              | FK → `coupon.numero_do_cupom`, NULL |
| `data_pedido`                   | timestamp                                                | DEFAULT now()                       |
| `status`                        | enum (pending, paid, shipped, delivered, cancelled)      | NOT NULL                            |
| `subtotal`                      | numeric(12,2)                                            | NOT NULL                            |
| `valor_frete`                   | numeric(10,2)                                            | DEFAULT 0                           |
| `valor_total`                   | numeric(12,2)                                            | NOT NULL                            |
| `tipo_retirada`                 | enum (entrega, loja)                                     | NOT NULL                            |
| `codigo_verificacao_retirada`   | varchar(6)                                               | NULL (só se tipo_retirada=loja)     |
| `id_funcionario`                | varchar(11)                                              | FK → `employee.cpf`, NULL           |
| `codigo_rastreamento`           | varchar                                                  | NULL                                |

#### `order_item` (D6)

| Coluna              | Tipo          | Constraint                              |
| ------------------- | ------------- | --------------------------------------- |
| `id_item_pedido`    | serial        | PK                                      |
| `id_pedido`         | int           | FK → `orders.id_pedido`                 |
| `codigo_sku`        | varchar(40)   | FK → `product_variant.codigo_sku`       |
| `quantidade`        | int           | NOT NULL, CHECK > 0                     |
| `preco_unitario`    | numeric(10,2) | NOT NULL (snapshot do preço na compra)  |

#### `payment` (D7)

| Coluna            | Tipo                                       | Constraint                  |
| ----------------- | ------------------------------------------ | --------------------------- |
| `id_pagamento`    | serial                                     | PK                          |
| `id_pedido`       | int                                        | FK → `orders.id_pedido`     |
| `order_nsu`       | varchar                                    | gateway                     |
| `transaction_nsu` | varchar                                    | gateway                     |
| `invoice_slug`    | varchar                                    | gateway                     |
| `amount`          | numeric(12,2)                              | NOT NULL                    |
| `paid_amount`     | numeric(12,2)                              | NULL até confirmação        |
| `installments`    | int                                        | DEFAULT 1                   |
| `capture_method`  | enum (pix, credit_card, debit_card)        | NOT NULL                    |
| `status`          | enum (pending, paid, failed, refunded)     | NOT NULL                    |
| `receipt_url`     | text                                       | NULL                        |
| `redirect_url`    | text                                       | NULL                        |
| `webhook_url`     | text                                       | NULL                        |
| `created_at`      | timestamp                                  | DEFAULT now()               |
| `updated_at`      | timestamp                                  |                             |

Regras: `pix` e `debit_card` forçam `installments = 1`. `credit_card` aceita 1-12.

#### `sales_goal` (D9)

| Coluna                  | Tipo           | Constraint                        |
| ----------------------- | -------------- | --------------------------------- |
| `id_goal`               | serial         | PK                                |
| `cpf_funcionario`       | varchar(11)    | FK → `employee.cpf`, NULL (meta coletiva) |
| `mes`                   | int            | CHECK BETWEEN 1 AND 12            |
| `ano`                   | int            |                                   |
| `valor_meta`            | numeric(12,2)  | NOT NULL                          |
| `taxa_comissao_bonus`   | numeric(5,4)   | NULL (taxa adicional ao bater meta) |

UNIQUE (cpf_funcionario, mes, ano).

---

## Comandos do projeto

```bash
make dev-up        # sobe Docker dev
make dev-restart   # reinicia sem rebuild
make dev-logs      # acompanha logs
make dev-logs-api  # logs só da API (dev-logs-postgres p/ o banco)
make dev-shell     # shell no container da API
make db-shell      # psql no container do postgres
make db-backup     # dump SQL do banco (backup_<timestamp>.sql)
make dev-reset     # derruba tudo e apaga volumes (banco incluso)
make dev-test path=<modulo>  # roda testes de um módulo dentro do container
make demo          # fluxo de compra ponta-a-ponta (recria o ambiente)
```

**Testes:** sempre usar `make dev-test path=<modulo>` (ex: `make dev-test path=inventory`)
para unitários e `make dev-test-integration` para integração. Os testes rodam dentro
do container Docker — chamar `pnpm test` direto na máquina host não reflete o ambiente correto.

- **Unitários** (`*.spec.ts`): mocks de repositório/`dataSource.transaction` (ver
  `inventory.service.spec.ts` e `payments.service.spec.ts` como referência de
  mock de transação). Regras com múltiplos casos usam testes **parametrizados**
  (`it.each`) — ex.: `create-payment.dto.spec.ts` (parcelas), `coupons.service.spec.ts`
  (motivos de validação), `shipping.service.spec.ts` (faixas de CEP).
- **Integração** (`*.integration.ts`): sobem o `AppModule` contra Postgres real.
- Dívida conhecida: `reviews` e `sales-goals` ainda não têm spec unitário dedicado
  (cobertos por integração).

**Cobertura:** `make dev-test-cov` roda unitários **+ integração** com `--coverage`
(precisa do Postgres no ar). O `coverageThreshold` global no `package.json` trava o
piso (statements/lines 85, functions 80, branches 70) — não deixe cair abaixo disso.
Para iterar rápido sem banco, use `make dev-test` (sem coverage).

**Instalar dependências (pnpm):** sempre dentro do container.
```bash
docker compose -p marketplace-backend --env-file .env.development -f compose.dev.yml exec api pnpm add -D <pkg>
# ou via shell interativo:
make dev-shell  # depois: pnpm add ...
```
`node_modules` é volume Docker — rodar `pnpm install` no host gera divergência.

---

## Lint, format e clean code

```bash
# Dentro do container (make dev-shell ou docker compose exec api ...):
pnpm lint           # ESLint check (sem fix) — usado pelo CI
pnpm lint:fix       # ESLint + auto-fix
pnpm format         # Prettier write
pnpm format:check   # Prettier check (sem write) — usado pelo CI
pnpm typecheck      # tsc --noEmit
```

**Configuração:**
- ESLint flat config em `eslint.config.mjs` (regras: complexity, max-lines-per-function, no-magic-numbers, import/order, no-floating-promises).
- Prettier em `.prettierrc.json`.
- Pre-commit hook (`.husky/pre-commit`) roda `lint-staged` (eslint --fix + prettier --write nos arquivos staged) **dentro do container**. Requer container UP. Pra pular em emergência: `git commit --no-verify`.

### Constantes (sem magic numbers)

Constantes compartilhadas vivem em `src/common/constants/` (reexportadas em `index.ts`):
- `pagination.constants.ts` — `PAGINATION_DEFAULT_PAGE`, `PAGINATION_DEFAULT_LIMIT` (20), `PAGINATION_MAX_LIMIT` (100)
- `security.constants.ts` — `BCRYPT_ROUNDS` (10)
- `database.constants.ts` — `PG_UNIQUE_VIOLATION` ('23505')
- `business.constants.ts` — `EMPLOYEE_DEFAULT_COMMISSION_RATE`, `DEFAULT_API_PORT` (3001), `DEFAULT_POSTGRES_PORT` (5432), `PERCENTAGE_MAX` (100), `CENTS_PER_CURRENCY_UNIT` (100), `MAX_IMAGE_UPLOAD_BYTES`, `VERIFICATION_CODE_*`
- `http-status.constants.ts` — `HTTP_STATUS_UNAUTHORIZED` (401), `HTTP_STATUS_UNPROCESSABLE_ENTITY` (422)
- `shipping.constants.ts` — timeouts, TTL de cache e defaults de pacote do Melhor Envio

Para criar nova constante de domínio compartilhado, adicione no arquivo correspondente (ou crie novo `<topico>.constants.ts` e reexporte no `index.ts`). Importe via `from '../common/constants'`.

Helpers puros compartilhados vivem em `src/common/utils/` (ex.: `getMonthDateRange(ano, mes)` para filtros de período de vendas/comissão/metas). Importe via `from '../common/utils'`.

ESLint só impõe `no-magic-numbers` em services/controllers — `entities/`, `dtos/`, `*.spec.ts` e `*.integration.ts` têm override (números literais são domain-natural ou fixtures de teste).

---

## CI/CD

`.github/workflows/ci.yml` roda em PR/push para `dev` e `main`. Jobs em paralelo:

| Job | O que faz |
|---|---|
| `lint` | `pnpm lint` + `pnpm typecheck` + `pnpm format:check` |
| `build` | `pnpm build` (verifica compilação TS) |
| `test-unit` | `pnpm test` (specs com mocks, sem banco) — feedback rápido |
| `coverage` | `pnpm test:cov` (unit + integração) com Postgres 16 como service; falha se a cobertura cair abaixo do `coverageThreshold`. Sobe o relatório como artefato `coverage-report`. |

Tempo esperado total: ~3min.

### OpenAPI para o frontend

Swagger UI em `/docs` quando a app está rodando. Para gerar arquivo `openapi.json` versionável (não commitado — está no `.gitignore`):

```bash
pnpm openapi:export
```

Requer container/banco rodando (script instancia `AppModule` real).

---

## Pontos abertos (afetam código)

Decisões pendentes que mudam a forma da implementação. Confirmar antes:

- **Carrinho (D6/US06):** persistido no backend ou só frontend? Default
  atual: frontend-only — `POST /api/orders` recebe a lista pronta.
- **Bônus de comissão (D9/US20-21):** ao bater meta, taxa muda de 2,5%
  para X% em **todas** as vendas ou só nas **acima** da meta? Confirmar
  antes de implementar `EmployeesService.calculateCommission`.
- **Frete (D8/US17):** integração via **Melhor Envio sandbox** (provedor
  aglutinador — retorna cotações de Correios PAC/SEDEX, Jadlog e outras).
  Substitui a integração direta com Correios SIGEP (endpoint legado,
  descontinuado). Token via OAuth2 com refresh preemptivo (renova ~5 min
  antes de expirar) gerenciado por `MelhorEnvioTokenManager`; modo estático
  por env existe como fallback de debug. Por padrão usa a cotação mais
  barata entre as válidas (filtra entradas com `error`); `MELHOR_ENVIO_SERVICE_ID`
  fixa um serviço específico (1=PAC, 2=SEDEX, ...). Cache key inclui o
  service ID. Erros do provedor (timeout, 401, 5xx, todas cotações com
  erro) caem no fallback `src/shipping/data/cep-ranges.ts` (6 faixas
  regionais com origem em Brasília); 422 (payload inválido) sobe como
  `BadRequestException`. Como obter/renovar token: `docs/melhor-envio-token.md`.

---

## Convenções de commit

Conventional Commits no título: `feat(orders):`, `chore(auth):`,
`fix(inventory):`. Fechar issues via commit: `feat(orders): criar entity
(closes #42)`.
