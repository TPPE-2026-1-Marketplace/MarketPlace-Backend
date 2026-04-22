# MarketPlace-Backend

## Docker

O fluxo oficial usa `make` como interface:

- `make dev-up` sobe API + Postgres para desenvolvimento
- `make dev-shell` abre shell no container da API
- `make dev-down` derruba o ambiente de desenvolvimento
- `make prod-up` sobe apenas a API com banco externo

Copie `.env.example` para `.env` e ajuste as variaveis. Em desenvolvimento, use `POSTGRES_HOST=postgres`. Em producao, aponte `POSTGRES_HOST` para o banco externo.

As builds exigem BuildKit habilitado. O `Makefile` exporta `DOCKER_BUILDKIT=1` e `COMPOSE_DOCKER_CLI_BUILD=1` para suportar cache mount do `pnpm`.
