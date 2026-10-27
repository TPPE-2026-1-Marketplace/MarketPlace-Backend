# Swagger em produção — decisão

`GET /docs` expõe o Swagger UI (endpoints, schemas de request/response e
regras de permissão documentadas via `@ApiOperation`/`@ApiResponse`).

## Comportamento

- **Fora de produção** (`NODE_ENV` ausente, `development` ou `test`): Swagger
  sempre disponível em `/docs`.
- **Em produção** (`NODE_ENV=production`): Swagger **desligado por padrão**.
  Para religar, defina `SWAGGER_PUBLIC=true` no ambiente.

Controlado em `src/main.ts` (`swaggerEnabled = !isProduction || swaggerPublic`)
e validado em `src/common/config/env.validation.ts`.

## Decisão atual do time

Histórico do projeto: o Swagger público em produção já foi usado
conscientemente como "link de portfólio" durante o período de entrega da
disciplina. Antes desta mudança isso era o único comportamento possível —
não existia como desligar sem alterar código.

**Decisão registrada:** manter o Swagger público em produção pelo período de
portfólio, mas agora como escolha explícita e reversível — configure
`SWAGGER_PUBLIC=true` em `.env.production` (ou na env do serviço no Render)
enquanto essa decisão estiver valendo. Removendo a variável (ou setando
`false`), o Swagger fica indisponível em produção sem precisar de deploy de
código novo.

Relacionado: issue #163.
