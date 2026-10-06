# Cobertura de branches — decisão (issue #160)

## Números medidos

Rodado com `pnpm test:cov` dentro do container de dev (`make dev-test-cov`),
41 suites / 498 testes, todos passando:

| Métrica | Antes | Depois desta mudança | Piso do CI |
| --- | --- | --- | --- |
| Statements | 89,24% | 89,36% | 85% |
| Branches | 71,04% | **71,35%** | 70% |
| Functions | 84,69% | 85,51% | 80% |
| Lines | 89,37% | 89,50% | 85% |

## O que foi feito

`src/people/people.controller.ts` era o arquivo citado na issue com menor
cobertura de branch (67,85%). Investigando, `exportPeople`, `findAll`,
`findOne`, `update` e `remove` não tinham **nenhum** teste — só
`registerPerson`/`registerUser` eram cobertos. Em especial, os fallbacks
`p.nome || ''` e `p.telefone || ''` do CSV de exportação nunca tinham os
dois lados (presente/ausente) exercitados.

Adicionados em `src/people/people.controller.spec.ts`: testes de guard/role
para os 5 endpoints sem cobertura, testes de delegação para `findAll`/
`findOne`/`update`/`remove`, e dois testes para `exportPeople` cobrindo
ambos os branches dos fallbacks (nome/telefone presentes vs. ausentes).
Resultado: `people.controller.ts` foi de 67,85% para **75%** de branch
coverage.

## Achado colateral: `.env.development` local quebrava os testes de integração

Rodar `pnpm test:cov` dentro do container de dev (o fluxo documentado neste
CLAUDE.md) falhava 9 suites de integração com `AggregateError` de conexão ao
Postgres. Causa: o `.env.development` local (arquivo gitignored, não é
código versionado) tinha uma linha `POSTGRES_HOST=localhost` sobrando — o
próprio cabeçalho do arquivo e do `compose.dev.yml` documentam que essa
variável **não deve estar lá**, porque o Compose já injeta
`POSTGRES_HOST=postgres` no container. `src/jest-setup-envs.js` lê o
`.env.development` e sobrescreve todo `process.env` com o que está no
arquivo — então o `localhost` do arquivo pisava no `postgres` injetado pelo
Docker, e o container tentava conectar ao Postgres na própria loopback (onde
não há Postgres nenhum).

Corrigido localmente removendo a linha (o arquivo não é commitado, então
isso não faz parte desta branch nem de nenhum PR). Provavelmente é uma
configuração que sobrou de alguém tendo rodado os testes direto no host em
algum momento — vale um alerta pro time revisar o próprio `.env.development`
de cada um caso vejam o mesmo erro.

## Decisão

Alcançar >75% de branch coverage **globalmente** (a barra sugerida pela
issue para nova margem de segurança) exigiria testar branches hoje
descobertos em vários módulos (`payments.service.ts` 57,3%,
`reviews.service.ts` 62,8%, `products.controller.ts` 75%, DTOs de
query com `0%` em `query-products.dto.ts`/`query-product-variants.dto.ts`
etc.) — investimento maior do que cabe numa única mudança pontual.

**Decisão registrada:** por ora, aceitar a margem atual (71,35%, acima do
piso de 70%) como piso real, tendo fechado o gap mais crítico apontado pela
issue (`people.controller.ts`). Os módulos listados acima ficam como
candidatos prioritários da próxima rodada de investimento em testes, para
quem quiser reabrir esta frente.

Relacionado: issue #160.
