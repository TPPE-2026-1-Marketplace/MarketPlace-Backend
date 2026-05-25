# Contexto do Projeto — Marketplace Backend (DK Fashion)

> Este documento é a fonte da verdade do projeto. Foi escrito para ser colado
> no início de uma conversa com um assistente de IA (Claude, Copilot, etc.)
> para que ele tenha todo o contexto necessário para ajudar no desenvolvimento.

---

## Visão Geral

API REST de um marketplace de moda (DK Fashion) construída com NestJS,
integrando catálogo de produtos com variantes, gestão de estoque (online +
loja física), pedidos com múltiplas formas de pagamento, cálculo de frete via
Correios, sistema de avaliações, cupons de desconto, comissões de vendedores
e gamificação por metas.

**Status atual:** projeto vazio. Nenhum módulo implementado.
A entrega completa do backend está planejada para **22/05/2026**, com 7 dias
de desenvolvimento (16-22/05) divididos em 11 epics no GitHub Project #2.

---

## Stack

| Camada | Tecnologia | Versão |
|---|---|---|
| Linguagem | TypeScript | 5.7 |
| Framework | NestJS | 10 |
| ORM | TypeORM | 0.3 |
| Validação | **Zod** (via `nestjs-zod`) | latest |
| Banco de dados | PostgreSQL | 16 |
| Naming strategy (DB) | `typeorm-naming-strategies` (SnakeNamingStrategy) | latest |
| Documentação | Swagger (`@nestjs/swagger`) | latest |
| Autenticação | JWT (`@nestjs/jwt` + `@nestjs/passport` + `passport-jwt`) | latest |
| Hash de senha | bcrypt | latest |
| Package manager | pnpm | 10 |
| Runtime | Node.js | 22 (Alpine) |
| Containerização | Docker + Docker Compose | — |
| Testes | Jest + Supertest | — |

### Dependências que NÃO usar

-  `class-validator` e `class-transformer` — substituídos por Zod
-  DTOs com decorators (`@IsString()`, `@IsInt()`, etc.) — substituídos por schemas Zod

---

## Dependências do Projeto

Lista completa de bibliotecas a instalar. Recomenda-se instalar tudo no
**D0 (sábado 16/05)** para evitar interrupções de "ah, faltou instalar X"
durante o desenvolvimento.

### Essenciais (uso obrigatório)

```bash
# Validação (Zod via nestjs-zod — substitui class-validator)
pnpm add nestjs-zod zod

# Naming strategy do banco (snake_case automático)
pnpm add typeorm-naming-strategies

# Autenticação JWT
pnpm add @nestjs/jwt @nestjs/passport passport passport-jwt
pnpm add -D @types/passport-jwt

# Hash de senha
pnpm add bcrypt
pnpm add -D @types/bcrypt

# Configuração de ambiente
pnpm add @nestjs/config
```

### Segurança (instalar no D0)

```bash
# Headers de segurança (CSP, HSTS, X-Frame-Options, etc.)
pnpm add helmet

# Rate limiting (proteção de força bruta no /auth/login)
pnpm add @nestjs/throttler
```

Aplicar `helmet()` globalmente no `main.ts`. Para `@nestjs/throttler`,
configurar `5 requests por 15 minutos` para o endpoint de login.

### Para domínios específicos

```bash
# D5 - Export CSV de clientes (US12)
pnpm add fast-csv

# D5, D9 - Manipulação de datas (cupons, comissões, períodos)
pnpm add date-fns

# D8 - Integração com API dos Correios (US17)
pnpm add @nestjs/axios axios

# Geração de IDs únicos (códigos de verificação, etc.)
pnpm add uuid
pnpm add -D @types/uuid
```

> **Sobre datas:** `date-fns` é tree-shakeable e moderno. Não usar `moment`
> (deprecated). Alternativa válida: `dayjs`.

### Logging estruturado (recomendado)

```bash
pnpm add nestjs-pino pino-http
pnpm add -D pino-pretty
```

Configurar no `app.module.ts`. Em dev, `pino-pretty` produz logs coloridos;
em prod, JSON puro pronto para parsers (Datadog, Grafana, etc.).

### Testes (já configurados pelo NestJS)

`@nestjs/testing` + `jest` + `supertest` vêm por default. Opcional para D10:

```bash
# Postgres real em testes E2E (em vez de mockar Repository)
pnpm add -D testcontainers
```

Para a MVP, mockar `Repository` com `jest.fn()` é aceitável se o tempo for
curto.

### Instalação completa em um comando

```bash
pnpm add nestjs-zod zod typeorm-naming-strategies \
  @nestjs/jwt @nestjs/passport passport passport-jwt \
  bcrypt @nestjs/config helmet @nestjs/throttler \
  fast-csv date-fns @nestjs/axios axios uuid \
  nestjs-pino pino-http

pnpm add -D @types/passport-jwt @types/bcrypt @types/uuid pino-pretty
```

### Bibliotecas **NÃO** recomendadas para esta entrega

Evitar — adicionam complexidade sem ganho proporcional no prazo de 7 dias:

-  `class-validator` / `class-transformer` (decisão arquitetural — Zod no lugar)
-  `@nestjs/graphql` (frontend usa REST)
-  `@nestjs/microservices` (monolito é suficiente)
-  `@nestjs/cqrs` (overhead arquitetural não justificado)
-  `@nestjs/schedule` (cron jobs — calcular comissão sob demanda basta)
-  `@nestjs/terminus` (health checks — adicionar quando for pra prod real)
-  Mongoose / Prisma (já decidido TypeORM)

### Para iteração futura (pós-22/05)

Bibliotecas que agregam valor mas estão fora do escopo da entrega inicial:

- `@nestjs/cache-manager` — cache de respostas (frete, listagem de produtos)
- `compression` — compressão gzip/brotli das respostas
- `@nestjs/terminus` — health check em `/health`
- `@nestjs/schedule` — invalidação automática de cupons expirados
- `nestjs-cls` — request context global (auditoria sem passar `Request` manualmente)
- Cloudinary SDK — quando a integração de upload de imagens for real

---

## Estrutura de Pastas

Cada módulo segue o padrão gerado por `nest g resource`, mantendo o controller
e o service na raiz e usando subpastas só para conjuntos de arquivos
(múltiplos DTOs, entities, interfaces):

```
src/
├── main.ts                        # bootstrap, Swagger, prefixo /api
├── app.module.ts                  # módulo raiz — TypeORM, ConfigModule, todos os módulos
├── common/                        # filters, decorators, utils compartilhados
│   ├── filters/
│   │   └── all-exceptions.filter.ts
│   ├── decorators/
│   │   ├── current-user.decorator.ts
│   │   └── roles.decorator.ts
│   └── pipes/
│       └── zod-validation.pipe.ts (se nestjs-zod não for usado direto)
└── people/                        # exemplo de módulo
    ├── dtos/
    │   ├── create-person.dto.ts   # schema Zod + classe DTO no mesmo arquivo
    │   └── update-person.dto.ts
    ├── entities/
    │   └── person.entity.ts
    ├── interfaces/
    │   └── person.interface.ts
    ├── people.controller.ts
    ├── people.module.ts
    └── people.service.ts
```

**Quando criar subpasta `controllers/` ou `services/`:** apenas quando o
módulo tiver mais de um arquivo desse tipo (ex: um controller público + um
admin). Não criar profilaticamente.

---

## Padrão Arquitetural

```
Request → Controller → Service → Repository (TypeORM) → PostgreSQL
```

- **Controller**: recebe a requisição, valida payload via `ZodValidationPipe`,
  aplica guards (`JwtAuthGuard`, `RolesGuard`), delega ao service. Não contém
  lógica de negócio.
- **Service**: contém toda a lógica de negócio, transações, validações de
  domínio. Acessa o banco via `Repository<T>` injetado.
- **DTO**: schema Zod + classe `extends createZodDto(schema)`. Mesmo arquivo.
- **Entity**: mapeia a tabela no banco. Usa decorators do TypeORM.
- **Interface**: contratos internos (ex: `IUserValidation` — retorno sem senha).

---

## Convenções

### Validação com Zod (`nestjs-zod`)

Schema Zod e classe DTO no mesmo arquivo. Exemplo:

```typescript
// src/people/dtos/create-person.dto.ts
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreatePersonSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(8),
  cpf: z.string().regex(/^\d{11}$/).optional(),
  telefone: z.string().optional(),
  nome: z.string().optional(),
});

export class CreatePersonDto extends createZodDto(CreatePersonSchema) {}
```

O `nestjs-zod` automaticamente:
- Valida o payload no controller via pipe
- Gera o schema OpenAPI/Swagger a partir do Zod
- Aplica `transform` antes de o service receber o DTO

No `main.ts`, configurar globalmente:

```typescript
import { ZodValidationPipe } from 'nestjs-zod';
app.useGlobalPipes(new ZodValidationPipe());
```

### Tradução de exemplos `class-validator` → Zod

Como o plano de tasks foi escrito antes da decisão pelo Zod, algumas tasks
mencionam decorators do `class-validator`. Tradução direta:

| `class-validator` | Zod equivalente |
|---|---|
| `@IsString()` | `z.string()` |
| `@IsEmail()` | `z.string().email()` |
| `@IsInt()` | `z.number().int()` |
| `@Min(1) @Max(5)` | `z.number().min(1).max(5)` |
| `@MaxLength(2000)` | `z.string().max(2000)` |
| `@IsOptional()` | `.optional()` |
| `@IsEnum(MyEnum)` | `z.nativeEnum(MyEnum)` |
| `@IsUUID()` | `z.string().uuid()` |
| `@IsPositive()` | `z.number().positive()` |

### Naming Strategy do Banco

Configurar `SnakeNamingStrategy` no `TypeOrmModule.forRoot()`:

```typescript
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

TypeOrmModule.forRoot({
  // ...
  namingStrategy: new SnakeNamingStrategy(),
  autoLoadEntities: true,
})
```

Resultado: entity `ProductVariant` vira tabela `product_variant`,
campo `precoVariante` vira coluna `preco_variante`, etc. **Não usar
`@Entity('nome_manual')`** — deixar a naming strategy resolver.

### Resposta de Erro Padronizada

Criar `AllExceptionsFilter` em `src/common/filters/` e registrar globalmente
no `main.ts`. Formato padrão da resposta:

```json
{
  "statusCode": 400,
  "timestamp": "2026-05-16T14:32:10.123Z",
  "path": "/api/people",
  "method": "POST",
  "message": "Validation failed",
  "errors": [
    { "field": "email", "message": "Invalid email format" }
  ]
}
```

Para erros do Zod, extrair `error.errors` e mapear para o formato `errors[]`.
Para erros do NestJS (`HttpException`), preservar `statusCode` e `message`.

### Paginação

Padrão único para todos os endpoints de listagem:

- **Query params:** `?page=1&limit=20`
- **Default:** `page=1`, `limit=20`
- **Limite máximo:** `limit=100`
- **Resposta:**

```json
{
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 142,
    "totalPages": 8
  }
}
```

Criar um DTO/utility compartilhado em `src/common/` para reusar entre todos os
módulos. Schema Zod sugerido:

```typescript
export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
```

### Versionamento de API

Prefixo único: `/api`. Sem `/v1` por enquanto. Se houver breaking change no
futuro, aí sim migra para `/api/v1` / `/api/v2`.

### Swagger

- Configurado em `main.ts` via `SwaggerModule.setup('docs', app, document)`
- Acessível em `/docs`
- `.addBearerAuth()` habilitado — botão "Authorize" funcional
- Schemas gerados automaticamente pelo `nestjs-zod` (não precisa duplicar
  com `@ApiProperty`)
- Usar `@ApiTags()` nos controllers e `@ApiOperation()` em cada endpoint
- Usar `@ApiResponse()` para documentar status codes não óbvios (409, 422)

### Autenticação e Autorização

- Login via `POST /api/auth/login` retorna `{ access_token }`
- Token JWT contém: `sub` (id), `email`, `role`
- Endpoints protegidos: `@UseGuards(JwtAuthGuard)`
- Endpoints com role específica: `@UseGuards(JwtAuthGuard, RolesGuard)` +
  `@Roles('admin', 'gerente')`
- Decorator `@CurrentUser()` para acessar o user autenticado no controller
- Senhas hasheadas com bcrypt antes de persistir

**Roles disponíveis** (definidas como enum em `src/common/`):

```typescript
export enum Role {
  CAIXA = 'caixa',
  VENDEDOR = 'vendedor',
  GERENTE = 'gerente',
  ADMINISTRADOR = 'administrador',
}
```

Hierarquia (cada nível tem acesso ao anterior):
- `caixa`: registro de vendas, associar vendedores
- `vendedor`: tudo de caixa + participação em ranking e comissão
- `gerente`: tudo de vendedor + controle de estoque + dashboards
- `administrador`: tudo de gerente + gestão de funcionários, cupons, dados

### Configuração e Ambiente

- Variáveis de ambiente via `@nestjs/config`
- Arquivos: `.env.development`, `.env.production`
- `synchronize: true` apenas em dev (auto-migração do schema)
- `autoLoadEntities: true` — entidades dos módulos carregadas automaticamente
- Variáveis obrigatórias:
  - `DATABASE_URL` (ou `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`)
  - `JWT_SECRET`
  - `JWT_EXPIRES_IN` (default: `7d`)
  - `LOJA_CEP_ORIGEM` (CEP da loja para cálculo de frete)

---

## Módulos do Backend

12 módulos cobrindo todo o domínio. **Nomenclatura em inglês.**

| Módulo | Entities | Responsabilidade |
|---|---|---|
| `auth` | — | JWT, login, guards (`JwtAuthGuard`, `RolesGuard`), decorators |
| `people` | `Person` | Cadastro de pessoas (clientes + base para funcionários) |
| `addresses` | `Address` | Endereços associados a pessoas (N:1) |
| `employees` | `Employee` | Especialização 1:1 de `Person` com role, comissão, meta |
| `categories` | `Category` | Categorias de produtos |
| `images` | `Image`, `CatalogImage` | Imagens dos produtos + ordenação em catálogo |
| `products` | `Product` | Produtos. Relação N:N com `Category` via `@JoinTable` |
| `product-variants` | `ProductVariant` | SKU, cor, tamanho, medidas (JSONB), preço |
| `inventory` | `Stock`, `StockLog` | Estoque online + loja física + log de movimentações |
| `coupons` | `Coupon` | Cupons de desconto com associação a produtos |
| `reviews` | `Review` | Avaliações de produto (1-5 estrelas + comentário) |
| `orders` | `Order`, `OrderItem` | Pedidos (online e presencial) com checkout |
| `payments` | `Payment` | Pagamentos (Pix, crédito, débito) com pasta `providers/` pra gateway futuro |
| `shipping` | — | Cálculo de frete via Correios (com fallback de faixas de CEP) |
| `sales-goals` | `SalesGoal` | Metas mensais por vendedor para gamificação |

**Lógica de comissão** mora em `employees` (não em módulo próprio), porque é
um service que lê de `orders` e aplica a taxa do `Employee`. Endpoints de
ranking e progresso também ficam em `employees` e `sales-goals` respectivamente.

---

## Diagrama de Domínio (Nomes em Inglês)

Mapeamento do diagrama original (português) para a implementação (inglês):

| Português (diagrama) | Inglês (código) |
|---|---|
| `Pessoa` | `Person` |
| `Endereco` | `Address` |
| `Funcionario` | `Employee` |
| `Categoria` | `Category` |
| `Produto` | `Product` |
| `Produto_Categoria` | (tabela de junção N:N criada automaticamente pelo TypeORM) |
| `Variante_Produto` | `ProductVariant` |
| `Imagem` | `Image` |
| `Imagem_Catalogo` | `CatalogImage` |
| `Estoque` | `Stock` |
| `Log_Estoque` | `StockLog` |
| `Cupom` | `Coupon` |
| `Pedido` | `Order` |
| `Item_Pedido` | `OrderItem` |
| `Pagamento` | `Payment` |
| `Avaliacao_Produto` | `Review` |
| (nova) | `SalesGoal` |

**Colunas das entities mantêm os nomes do diagrama em português** (`cpf`,
`nome`, `email`, `senha`, `id_pedido`, `data_pedido`, `valor_total`,
`tipo_retirada`, etc.) porque o SnakeNamingStrategy já mapeia camelCase →
snake_case e os nomes refletem o domínio de negócio em português.

Exemplo:

```typescript
@Entity()
export class Person {
  @PrimaryColumn()
  cpf: string;

  @Column()
  nome: string;

  @Column({ unique: true })
  email: string;

  @Column()
  telefone: string;

  @Column()
  senha: string; // será hasheada com bcrypt antes de persistir
}
```

Tabela gerada: `person`, colunas: `cpf`, `nome`, `email`, `telefone`, `senha`.

---

## Rotas Esperadas

Prefixo global: `/api`. Swagger em `/docs`.

### Autenticação
- `POST /api/auth/login` — login, retorna `{ access_token }`

### Pessoas
- `POST /api/people/register` (público) — cadastro de cliente com senha
- `POST /api/people` (caixa+) — cadastro de cliente sem senha (caixa cria)
- `GET /api/people` (admin) — listagem paginada
- `GET /api/people/:cpf` (admin) — busca por CPF
- `GET /api/people/export` (admin) — exporta CSV para tráfego pago

### Funcionários
- `POST /api/employees` (admin) — cadastra funcionário
- `GET /api/employees` (admin)
- `GET /api/employees/:cpf` (admin)
- `PATCH /api/employees/:cpf` (admin)
- `GET /api/employees/ranking?mes=&ano=` (caixa+) — ranking de vendedores

### Catálogo
- `GET /api/products` (público) — listagem com filtros (categoria, destaque, preço)
- `GET /api/products/:id` (público)
- `POST /api/products` (gerente+)
- `PATCH /api/products/:id` (gerente+)
- `DELETE /api/products/:id` (admin)
- `POST /api/products/:id/categories/:categoryId` (gerente+)
- `DELETE /api/products/:id/categories/:categoryId` (gerente+)
- `GET /api/product-variants/:sku` (público)
- `GET /api/categories` (público)
- `POST /api/categories` (admin)
- `POST /api/images` (gerente+)
- `POST /api/images/catalog` (gerente+)
- `GET /api/images/catalog/:variantSku` (público)

### Estoque
- `GET /api/inventory/:variantSku` (público)
- `PATCH /api/inventory/:variantSku` (gerente+)
- `GET /api/inventory/:variantSku/logs` (admin)

### Avaliações
- `POST /api/reviews` (autenticado)
- `GET /api/reviews/product/:productId` (público)
- `DELETE /api/reviews/:clienteId/:produtoId` (gerente+)

### Cupons
- `POST /api/coupons` (admin)
- `GET /api/coupons` (admin)
- `GET /api/coupons/validate/:numero` (público)
- `GET /api/coupons/by-influencer/:nome` (admin)
- `PATCH /api/coupons/:numero` (admin)
- `DELETE /api/coupons/:numero` (admin)

### Pedidos
- `POST /api/orders` (autenticado) — checkout online
- `POST /api/orders/in-store` (caixa+) — venda presencial
- `GET /api/orders/:id` (autenticado — dono ou funcionário)
- `GET /api/orders/:id/verification-code` (autenticado)
- `PATCH /api/orders/:id/tracking` (vendedor+)

### Pagamentos
- `POST /api/payments` (autenticado)

### Frete
- `POST /api/shipping/calculate` (público)

### Metas & Gamificação
- `POST /api/sales-goals` (admin)
- `GET /api/sales-goals?mes=&ano=` (admin)
- `PATCH /api/sales-goals/:id` (admin)
- `DELETE /api/sales-goals/:id` (admin)
- `GET /api/sales-goals/progress?mes=&ano=` (admin)

---

## Docker

Multi-stage build (5 estágios):

- `base` — Node 22 Alpine + pnpm
- `deps` — instala todas as dependências
- `dev` — herda de `deps`, roda `pnpm start:dev` (hot reload)
- `prod-deps` — apenas dependências de produção
- `runner` — imagem final mínima, usuário não-root `nestjs`

`compose.dev.yml` monta `.:/app` como volume. Em Linux, `nest start --watch`
às vezes não detecta mudanças; usar `make dev-restart` se necessário.

---

## Comandos Úteis (Makefile)

```bash
make dev-up        # sobe ambiente Docker dev
make dev-restart   # reinicia containers sem rebuild
make dev-logs      # acompanha logs
make dev-shell     # shell dentro do container da API
make db-shell      # psql no container do postgres
make dev-reset     # derruba tudo e apaga volumes (banco incluso)
```

---

## Pontos de Atenção e Decisões Pendentes

Estes pontos foram identificados durante o planejamento e **precisam ser
confirmados antes de implementar**:

### 1. Carrinho (US06): persistido ou frontend-only?

A US06 fala em "adicionar ao carrinho". A implementação difere:
- **Frontend-only:** carrinho vive em localStorage do front; backend só recebe
  a lista pronta no `POST /api/orders`. Recomendação atual.
- **Backend-persistido:** módulo `cart` separado, com endpoints de
  add/remove item. Mais complexo.

**Confirmar com a equipe de frontend na segunda 18/05.**

### 2. Cálculo de frete (US17): Correios pode falhar

A API dos Correios tem histórico de instabilidade. Plano:
- Implementar integração real
- Implementar fallback por faixas de CEP fixas
- Se até quarta 20/05 14h a API não responder consistentemente, ativar
  fallback como solução principal

### 3. Bônus de comissão (US20/US21)

A regra "2,5% sobre acumulado mensal" (US20) + "taxa adicional ao bater meta"
(US21) deixa ambíguo:
- A taxa muda de 2,5% para X% ao bater meta?
- Aplica para todas as vendas do mês ou só para as acima da meta?

**Confirmar com Product Owner antes de implementar.**

---

## Plano de Entrega

A entrega está organizada em **11 epics (D0 a D10)** rastreadas no GitHub
Project #2 (https://github.com/orgs/TPPE-2026-1-Marketplace/projects/2).

| Epic | Domínio | Quando | Responsável |
|---|---|---|---|
| D0 | Setup (auth + refactor people) | Sáb 16/05 | Mob (todos) |
| D1 | Catálogo | Dom 17/05 | Mob (todos) |
| D2 | Identidade complementar | Seg 18/05 | Bruno |
| D3 | Estoque | Seg 18/05 | Pablo |
| D4 | Avaliações | Seg 18/05 | Gabriel |
| D5 | CRM & Cupons | Ter 19/05 | Pablo |
| D6 | Pedidos & Checkout | Ter-Qua 19-20 | Bruno |
| D7 | Pagamento | Qua 20/05 | Bruno |
| D8 | Entrega & Frete | Ter-Qua 19-20 | Gabriel |
| D9 | Vendas & Gamificação | Qua-Qui 20-21 | Pablo |
| D10 | Integração final | Sex 22/05 | Mob (todos) |

**Estratégia:** mob programming (3 pessoas juntas) em D0 e D1 para alinhar
padrão arquitetural. Depois, trabalho individual com PRs revisados. Volta a
mob no D10 para integração final.

**Equipe:**
- Bruno (`BrunoBReis`)
- Pablo (`Pabloserrapxx`)
- Gabriel (`SAnjos3`)

**Buffer:** sáb 23 → seg 25/05 para repasse ao frontend e correção de bugs.

---

## Observações Operacionais

- **Daily assíncrona** via mensagens no grupo, com 2 postagens diárias
  (meio-dia e fim do dia): o que foi feito, o que vai fazer, o que travou.
- **PRs** precisam de 1 aprovação antes do merge. Revisão em até 4h.
- **Conventional Commits** nos títulos: `feat(orders):`, `chore(auth):`, etc.
- **Fechar issues automaticamente** via commit: `feat(orders): criar entity (closes #42)`.
- Todo endpoint precisa estar **documentado no Swagger** antes de fechar a issue.

---

## Histórico de decisões

| Decisão | Quando | Razão |
|---|---|---|
| Renomear `users` → `people` | 15/05/2026 | Convenção de inglês + alinhamento com diagrama (Pessoa) |
| Nomenclatura toda em inglês | 15/05/2026 | Decisão de equipe, depois de implementação preliminar |
| Endereço como módulo separado (não sub-recurso) | 15/05/2026 | Endereço cresce de escopo (frete, cobrança, entrega) |
| `payments` único, com pasta `providers/` | 15/05/2026 | Só há um gateway previsto; YAGNI para módulos separados |
| `inventory` engloba `StockLog` | 15/05/2026 | Log é escrito pelo mesmo service; sem API pública separada |
| `images` engloba `CatalogImage` | 15/05/2026 | Mesmo domínio operacional (upload + ordenação) |
| Zod via `nestjs-zod` | 15/05/2026 | Schema único para validação + geração Swagger automática |
| `SnakeNamingStrategy` global | 15/05/2026 | Evita decorar cada entity manualmente |
| Mob em D0-D1, individual no resto | 15/05/2026 | Equipe sem domínio forte de NestJS — investimento inicial em alinhamento arquitetural |
| Dependências consolidadas no D0 | 16/05/2026 | Evitar interrupções de "faltou instalar X" durante desenvolvimento de domínios |
| `helmet` + `@nestjs/throttler` obrigatórios | 16/05/2026 | Endpoints com dados sensíveis (CPF, senhas, cupons) exigem hardening básico |
| `date-fns` em vez de `moment` | 16/05/2026 | Tree-shakeable e moderno; moment está deprecated |
| `nestjs-pino` em vez do logger default | 16/05/2026 | Logs estruturados (JSON) para futura observabilidade |
