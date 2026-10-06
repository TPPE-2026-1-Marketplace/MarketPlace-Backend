# Diagnóstico — Schema de `orders`/`sales_goal` divergente das migrations versionadas

> Issue: [#173](https://github.com/TPPE-2026-1-Marketplace/MarketPlace-Backend/issues/173)

## Resumo

| | |
|---|---|
| **Status** | ✅ Confirmado |
| **Severidade** | Crítica (continuidade/disaster recovery) — sem impacto ativo hoje |
| **Escopo** | `orders`, `sales_goal` |
| **Ambiente comparado** | Postgres local (Docker, limpo) vs. Neon produção (somente leitura) |

Colunas de cliente avulso/endereço de entrega foram adicionadas em `orders`, e uma coluna
de `sales_goal` foi renomeada, diretamente em produção — sem que uma migration
correspondente fosse elaborada. Se o banco de produção precisar ser recriado do zero hoje
(troca de provedor, disaster recovery, novo ambiente de CI/staging), o resultado ficaria
incompatível com as entities atuais.

---

## Metodologia

1. Verificar, pelo histórico do git, se existe alguma migration cobrindo essas colunas.
2. Recriar localmente um banco **limpo**, aplicando só as migrations hoje versionadas no
   repositório (`migration:run`, sem `synchronize`).
3. Extrair o schema completo (`pg_dump --schema-only`) desse banco local e do banco de
   produção real (Neon).
4. Comparar as duas extrações (`diff`) sem presumir de antemão quais tabelas divergem.

---

## Evidências

### 1. Nenhuma migration cobre essas colunas

```bash
$ git log --all --oneline -- src/database/migrations/
4de1c74 (origin/alteraBanco) feat: primeira versão do cd
```

Único commit em todo o histórico (`--all`) que tocou o diretório de migrations.
Conferido o conteúdo desse commit:

```bash
$ git show 4de1c74 --stat
...
 src/database/migrations/1781916000000-InitialSchema.ts | 291 +++++++++++++++...
...
```

Esse commit adicionou só a `InitialSchema`. Nenhum outro commit, em nenhuma branch,
versiona uma migration para as colunas de cliente avulso/endereço ou para o rename em
`sales_goal`.

### 2. Banco local limpo (só `InitialSchema`) vs. produção real

Banco local recriado do zero, rodando **apenas** `migration:run` (sem subir a aplicação,
para não deixar o `synchronize` do ambiente de desenvolvimento mascarar o teste):

```bash
$ docker compose -f compose.dev.yml down -v
$ docker compose -f compose.dev.yml --env-file .env.development up -d postgres
$ POSTGRES_HOST=localhost POSTGRES_PORT=5432 POSTGRES_USER=marketplace_dev \
  POSTGRES_PASSWORD=*** POSTGRES_DB=marketplace_dev pnpm migration:run

1 migrations are new migrations must be executed.
Migration InitialSchema1781916000000 has been executed successfully.
```

Dump do schema local e de produção, e diff cru entre os dois:

```bash
$ docker compose -f compose.dev.yml exec postgres pg_dump -U marketplace_dev \
  -d marketplace_dev --schema-only --no-owner --no-privileges \
  > schema_local_migration_only.sql

$ docker run --rm -e DBURL="$DATABASE_URL" postgres:18-alpine sh -c \
  'pg_dump "$DBURL" --schema-only --no-owner --no-privileges' > schema_prod.sql

$ diff schema_local_migration_only.sql schema_prod.sql
```

Trecho relevante da diff (`>` = só em produção):

```diff
     "orders" (
       ...
+    cliente_nome_avulso character varying(150),
+    cliente_cpf_avulso character varying(11),
+    cliente_email_avulso character varying(255),
+    cliente_telefone character varying(20),
+    endereco_cep character varying(9),
+    endereco_rua character varying(255),
+    endereco_numero character varying(20),
+    endereco_complemento character varying(100),
+    endereco_bairro character varying(100),
+    endereco_cidade character varying(100),
+    endereco_estado character varying(2),
       ...
     "sales_goal" (
-    taxa_comissao_bonus numeric(5,4),
+    valor_bonus numeric(5,4),
```

---

## Achados

### ✅ Achado 1 — Confirmado
**Schema "só com migrations" diverge de produção.** `orders` fica sem as 11 colunas de
cliente avulso/endereço, e `sales_goal` mantém o nome antigo (`taxa_comissao_bonus`) em
vez de `valor_bonus`. Prova direta de que recriar produção hoje, só com `migration:run`,
gera um banco incompatível com as entities (`Order`, `SalesGoal`) — a aplicação quebraria
com 500 em qualquer endpoint que toque `Order` completo ou `sales_goal`.

### 🆕 Achado 2 — Novo (fora do escopo desta issue)
**A `InitialSchema` versionada não reflete como produção foi realmente construída.**
Todos os nomes de constraint em produção seguem o padrão de hash automático do TypeORM
(`PK_264b7cad...`, `CHK_c8ea7a5a...`), enquanto a `InitialSchema.ts` commitada usa nomes
manuais (`pk_person`, `chk_orders_subtotal`...). Ou seja, mesmo a migration inicial que
está versionada nunca foi, de fato, o que criou o schema atual de produção — produção foi
montada por outro caminho (provavelmente `synchronize`, em algum momento anterior ao
controle de migrations). Não afeta a correção desta issue (a migration de rename/adição
de coluna não referencia nomes de constraint), mas é risco lateral para futuras migrations
que venham a alterar constraints por nome. Registrado como issue separada de tech-debt.

### ❌ Hipótese descartada
Suspeita inicial de que `sales_goal` teria **duas** constraints unique redundantes em
produção (uma com nome manual, outra com nome hash). Verificado diretamente no dump:
existe apenas uma (`UQ_ae7936bd7a81f28087c32c7365f`) — a diferença observada na diff era
só de nome, não de constraint duplicada. Descartado após confirmação.

---

## Referências

- Issue: [#173](https://github.com/TPPE-2026-1-Marketplace/MarketPlace-Backend/issues/173)
- Branch de trabalho: `feat/align-orders-goal-migration`
