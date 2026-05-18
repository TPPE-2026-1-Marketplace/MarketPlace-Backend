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

## Resposta de erro padronizada

`AllExceptionsFilter` em `src/common/filters/`, registrado globalmente:

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

Para erros do Zod, mapear `error.errors` → `errors[]`. Para `HttpException`,
preservar `statusCode` e `message`.

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
| `nome`     | varchar(120)  | NOT NULL          |
| `email`    | varchar(160)  | UNIQUE, NOT NULL  |
| `telefone` | varchar(20)   | NULL              |
| `senha`    | varchar(120)  | NULL (hash bcrypt)|

**Notas:**
- `senha` é nullable para suportar cadastro pelo caixa (US11) — cliente sem
  senha não consegue fazer login (validação no AuthService).
- Hash bcrypt **ainda não aplicado** (issue #34, próxima da D0).

### Tabelas planejadas (ainda não implementadas)

Forma final esperada com base no diagrama ER. **Sempre que criar uma entity
nova, conferir aqui se a FK aponta pra coluna certa** (várias apontam pra
`person.cpf`, não `person.id`).

#### `employee` (D2)

Especialização 1:1 de `person`. PK = FK.

| Coluna               | Tipo          | Constraint                        |
| -------------------- | ------------- | --------------------------------- |
| `cpf`                | varchar(11)   | PK, FK → `person.cpf`             |
| `ativo`              | boolean       | DEFAULT true                      |
| `role_perfil`        | enum Role     | NOT NULL                          |
| `taxa_comissao`      | numeric(5,4)  | DEFAULT 0.025 (2,5%)              |
| `meta_vendas`        | numeric(12,2) | NULL                              |
| `codigo_funcionario` | varchar(20)   | UNIQUE                            |

#### `address` (D2)

| Coluna       | Tipo          | Constraint                        |
| ------------ | ------------- | --------------------------------- |
| `id`         | uuid / serial | PK                                |
| `cpf_pessoa` | varchar(11)   | FK → `person.cpf`                 |
| `cep`        | varchar(9)    | NOT NULL                          |
| `logradouro` | varchar       |                                   |
| `numero`     | varchar       |                                   |
| `complemento`| varchar       | NULL                              |
| `bairro`     | varchar       |                                   |
| `cidade`     | varchar       |                                   |
| `uf`         | varchar(2)    |                                   |

#### `category` (D1)

| Coluna        | Tipo  | Constraint |
| ------------- | ----- | ---------- |
| `id_categoria`| serial| PK         |
| `nome`        | varchar(80) | UNIQUE, NOT NULL |

#### `product` (D1)

| Coluna        | Tipo           | Constraint        |
| ------------- | -------------- | ----------------- |
| `id_produto`  | serial         | PK                |
| `titulo`      | varchar(180)   | NOT NULL          |
| `descricao`   | text           |                   |
| `destaque`    | boolean        | DEFAULT false     |
| `qual_medida` | varchar        |                   |
| `material`    | varchar        |                   |
| `composicao`  | varchar        |                   |
| `silhueta`    | varchar        |                   |
| `tags`        | text[] ou varchar |                |
| `preco_base`  | numeric(10,2)  | NOT NULL          |
| `sku`         | varchar        | UNIQUE            |

Relação N:N com `category` via `@ManyToMany` + `@JoinTable({ name: 'product_category' })`.
TypeORM cria a tabela de junção sozinho.

#### `product_variant` (D1)

| Coluna           | Tipo           | Constraint                  |
| ---------------- | -------------- | --------------------------- |
| `codigo_sku`     | varchar(40)    | PK                          |
| `id_produto`     | int            | FK → `product.id_produto`   |
| `preco_variante` | numeric(10,2)  | NOT NULL                    |
| `ativo`          | boolean        | DEFAULT true                |
| `cor`            | varchar        |                             |
| `tamanho`        | varchar        |                             |
| `medidas`        | jsonb          | Estrutura aberta (busto, cintura, quadril, comprimento, manga, pulso — em cm) |

#### `image` (D1)

| Coluna                  | Tipo           | Constraint |
| ----------------------- | -------------- | ---------- |
| `id_imagem`             | serial         | PK         |
| `url`                   | text           | NOT NULL   |
| `ordem`                 | int            |            |
| `descricao`             | varchar        |            |
| `local_renderizacao`    | varchar        |            |

#### `catalog_image` (D1)

| Coluna                | Tipo        | Constraint                        |
| --------------------- | ----------- | --------------------------------- |
| `id_imagem`           | int         | FK → `image.id_imagem`            |
| `codigo_sku`          | varchar(40) | FK → `product_variant.codigo_sku` |
| `ordem_no_catalogo`   | int         |                                   |

PK composta (id_imagem, codigo_sku).

#### `stock` (D3)

| Coluna             | Tipo        | Constraint                                       |
| ------------------ | ----------- | ------------------------------------------------ |
| `codigo_sku`       | varchar(40) | PK, FK → `product_variant.codigo_sku` (1:1)      |
| `qtd_online`       | int         | DEFAULT 0, CHECK >= 0                            |
| `qtd_loja_fisica`  | int         | DEFAULT 0, CHECK >= 0                            |

#### `stock_log` (D3)

| Coluna                    | Tipo                                          | Constraint |
| ------------------------- | --------------------------------------------- | ---------- |
| `id_log`                  | serial                                        | PK         |
| `codigo_sku`              | varchar(40)                                   | FK → `product_variant.codigo_sku` |
| `id_pedido`               | int                                           | FK → `orders.id_pedido`, NULL |
| `tipo_movimentacao`       | enum (entrada, saida, ajuste, venda)          | NOT NULL   |
| `quantidade_movimentada`  | int                                           | NOT NULL   |
| `data_criacao`            | timestamp                                     | DEFAULT now() |
| `valor_anterior_online`   | int                                           |            |
| `valor_novo_online`       | int                                           |            |
| `valor_anterior_loja`     | int                                           |            |
| `valor_novo_loja`         | int                                           |            |
| `origem`                  | varchar (cpf do usuário ou identificador)     |            |

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
make dev-shell     # shell no container da API
make db-shell      # psql no container do postgres
make dev-reset     # derruba tudo e apaga volumes (banco incluso)
```

---

## Pontos abertos (afetam código)

Decisões pendentes que mudam a forma da implementação. Confirmar antes:

- **Carrinho (D6/US06):** persistido no backend ou só frontend? Default
  atual: frontend-only — `POST /api/orders` recebe a lista pronta.
- **Bônus de comissão (D9/US20-21):** ao bater meta, taxa muda de 2,5%
  para X% em **todas** as vendas ou só nas **acima** da meta? Confirmar
  antes de implementar `EmployeesService.calculateCommission`.
- **Frete (D8/US17):** API dos Correios é instável. Plano B em
  `src/shipping/data/cep-ranges.ts` se a integração não estiver de pé até
  20/05 14h.

---

## Convenções de commit

Conventional Commits no título: `feat(orders):`, `chore(auth):`,
`fix(inventory):`. Fechar issues via commit: `feat(orders): criar entity
(closes #42)`.
