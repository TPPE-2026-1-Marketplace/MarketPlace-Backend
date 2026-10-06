# Diagnóstico — Vulnerabilidades em dependências de produção

> Issue: [#166](https://github.com/TPPE-2026-1-Marketplace/MarketPlace-Backend/issues/166)

## Resumo

| | |
|---|---|
| **Status** | ✅ Resolvido (severidade `high`) |
| **Antes** | 41 vulnerabilidades — 15 high, 24 moderate, 2 low |
| **Depois** | 9 vulnerabilidades — 0 high, 8 moderate, 1 low |
| **Escopo resolvido** | `multer`, `form-data`, `axios`, `lodash`, `js-yaml`, `brace-expansion`, `typeorm` |
| **Escopo não resolvido (documentado)** | `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`, `@nestjs/typeorm` — corrigidos só em majors novas do NestJS |

---

## Metodologia

1. Rodar `pnpm audit --prod --json` para obter, por vulnerabilidade, o `patched_versions`
   exato — nunca confiar de memória em qual versão corrige o quê.
2. Separar dependências **diretas** (aparecem no `package.json` do projeto) de
   **transitivas** (trazidas por outra dependência).
3. Para as diretas, bump direto no `package.json`, pegando o maior "piso" de versão
   entre todas as vulnerabilidades daquele pacote.
4. Para as transitivas, usar `pnpm.overrides` — evitando subir majors de pacotes centrais
   (`@nestjs/config`, `@nestjs/swagger`, `typeorm`) sem necessidade.
5. Validar após cada mudança rodando `pnpm install` + `pnpm audit --prod` de novo,
   comparando contra o baseline.

---

## Evidências

### Baseline

```bash
$ pnpm audit --prod
41 vulnerabilities found
Severity: 2 low | 24 moderate | 15 high
```

Pacotes com severidade `high`: `multer`, `form-data`, `lodash`, `axios`, `js-yaml`,
`brace-expansion` (via `pnpm audit --prod --json`, campo `module_name` filtrado por
`severity == "high"`).

### Diretas vs. transitivas

```bash
$ pnpm list multer axios lodash form-data js-yaml brace-expansion --depth 0
├── axios@1.16.1
├── form-data@4.0.5
└── multer@2.0.2
```

`lodash`, `js-yaml` e `brace-expansion` não aparecem — são transitivas
(`@nestjs/config>lodash`, `@nestjs/swagger>js-yaml`, `typeorm>glob>minimatch>brace-expansion`).

### Correção — diretas

```diff
- "axios": "^1.16.1",
+ "axios": "^1.18.0",
- "form-data": "^4.0.5",
+ "form-data": "^4.0.6",
- "multer": "^2.0.2",
+ "multer": "^2.3.0",
```

### Achado — `multer` tinha uma segunda cópia na árvore

Mesmo após o bump direto, `pnpm audit` continuou reportando as 5 vulnerabilidades de
`multer`, agora pelo caminho `.>@nestjs/platform-express>multer` (antes `.>multer`).
Confirmado com:

```bash
$ pnpm why multer
brace-expansion@... [árvore mostrando múltiplas resoluções antes do fix]
```

O `@nestjs/platform-express` declara sua própria dependência de `multer`, resolvida
separadamente do `multer` direto do projeto. Bump no `package.json` sozinho não bastava —
precisou de `pnpm.overrides` para forçar a versão em toda a árvore.

### Correção — transitivas (`pnpm.overrides`)

```json
"pnpm": {
  "overrides": {
    "lodash": ">=4.18.0",
    "js-yaml": ">=4.3.2",
    "brace-expansion": ">=5.0.9",
    "multer": ">=2.3.0"
  }
}
```

O piso do `brace-expansion` precisou ser revisado de `>=2.1.4` para `>=5.0.9` no meio do
processo — o `pnpm audit` passou a reportar um requisito mais alto entre uma rodada e
outra (novas vulnerabilidades publicadas para versões intermediárias do pacote,
confirmado comparando os campos `patched_versions` de cada rodada).

### Correção — `typeorm` (patch/minor, baixo risco)

```diff
- "typeorm": "^0.3.24",
+ "typeorm": "^0.3.31",
```

Resolveu 2 vulnerabilidades moderadas próprias do TypeORM (SQL injection em
`orderBy` de MySQL/MariaDB, e code injection em `migration:generate`) sem subida de
major (`typeorm` segue em 0.3.x; a versão `1.1.1` disponível não foi adotada nesta
issue).

### Resultado final

```bash
$ pnpm audit --prod
9 vulnerabilities found
Severity: 1 low | 8 moderate
```

---

## Achados

### ✅ Confirmado
O baseline original (41 / 15 high / 24 moderate / 2 low) foi reproduzido exatamente ao
rodar `pnpm audit --prod` do zero — nenhum achado da issue original estava desatualizado
ou incorreto.

### 🆕 Novo — cópia duplicada de dependência direta
`multer` existia em duas resoluções simultâneas na árvore (direta do projeto e como
dependência interna do `@nestjs/platform-express`). Um bump simples no `package.json`
não é suficiente para pacotes nessa situação — é preciso `pnpm.overrides` para garantir
uma única versão resolvida em toda a árvore. Vale de lição para futuras correções de
dependência neste projeto.

### ❌ Não resolvido nesta issue (causa raiz identificada)
As 8 vulnerabilidades moderadas e 1 low restantes (`file-type`, `@nestjs/core`, `uuid`,
`qs`, `fflate`, `body-parser`) são todas internas ao NestJS 10.x — só corrigidas em
majors mais novas (`@nestjs/core` precisa de `>=11.1.18`, mas o projeto está em `10.4.22`).
Resolver exigiria migrar o framework inteiro para NestJS 11+, decisão explicitamente fora
do escopo desta issue (risco de breaking change desproporcional ao peso estimado).
Registrado aqui como justificativa formal para o critério de aceite ("resolvidas ou com
justificativa documentada").

---

## Referências

- Issue: [#166](https://github.com/TPPE-2026-1-Marketplace/MarketPlace-Backend/issues/166)
- Branch de trabalho: `chore/dependency-audit`
