# Continuous Delivery — DK Fashion

Como funciona o pipeline de CD (`.github/workflows/cd.yml`) e sua relação com o CI.

## Visão geral

O CD automatiza o empacotamento da aplicação em uma imagem Docker de produção
e a publicação no GitHub Container Registry (GHCR). Ele não duplica o CI —
assume que lint, typecheck, testes e coverage já passaram e se limita à
entrega do artefato.

| Etapa | O que faz |
|---|---|
| `gate` | Verifica se o CI concluiu com sucesso |
| `docker` | Builda a imagem (multi-stage, target `runner`) e publica no GHCR |

## CI vs CD

| Aspecto | CI | CD |
|---|---|---|
| Objetivo | Validar qualidade do código | Empacotar e entregar artefato |
| Quando executa | Push e PR em `dev` e `main` | Somente após CI com sucesso na `main` |
| O que produz | Relatório de coverage | Imagem Docker publicada |

## Quando o CD executa

O CD é acionado exclusivamente quando um push na `main` faz o CI concluir
com sucesso. O GitHub Actions dispara o evento `workflow_run`:

```yaml
on:
  workflow_run:
    workflows: ["CI"]      # nome exato do workflow de CI
    types: [completed]     # dispara ao finalizar (sucesso ou falha)
    branches: [main]       # somente na main
```

O `workflow_run` dispara mesmo quando o CI falha. Por isso o job `gate`
verifica `conclusion == 'success'` antes de prosseguir.

| Cenário | CI roda? | CD roda? |
|---|---|---|
| Push na `dev` | sim | nao |
| PR para `main` | sim | nao |
| Push na `main` + CI falha | sim | nao |
| Push na `main` + CI passa | sim | sim |
| Tag semver na `main` + CI passa | sim | sim (com tags de versao) |

## Tags geradas

| Tipo | Exemplo | Quando |
|---|---|---|
| `latest` | `ghcr.io/org/repo:latest` | Todo push na `main` |
| `sha-*` | `ghcr.io/org/repo:sha-a1b2c3d` | Todo push na `main` |
| semver | `ghcr.io/org/repo:1.2.3` | Quando ha tag git `v1.2.3` |

## Docker multi-stage

O Dockerfile usa 5 estagios. O CD builda apenas o target `runner`:

| Estagio | Proposito | Na imagem final? |
|---|---|---|
| `base` | Node 22-alpine + corepack | sim (base) |
| `deps` | Instala todas as dependencias | nao |
| `dev` | Ambiente de desenvolvimento | nao |
| `prod-deps` | Instala apenas deps de producao | sim (node_modules) |
| `build` | Compila TypeScript → JavaScript | sim (dist/) |
| `runner` | Imagem final otimizada | sim |

A imagem final contem apenas `dist/`, `node_modules` de producao e
`package.json`. Roda como usuario nao-root (`nestjs:nodejs`), com
healthcheck embutido (`/api/health`).

## Por que `workflow_run`

Usar `workflow_run` em vez de colocar tudo no `ci.yml`:

- Separa responsabilidades: CI valida, CD entrega.
- O CI roda em PRs sem acionar o CD naturalmente.
- Permissoes isoladas: o CI nao precisa de `packages:write`.
- Cada pipeline evolui de forma independente.

## Cache

O build usa `cache-from: type=gha` / `cache-to: type=gha,mode=max`. Isso
persiste layers Docker entre runs usando o storage nativo do GitHub Actions.
`mode=max` exporta todas as layers intermediarias para maximo
reaproveitamento.

## Como testar localmente

```bash
# Espelha o CI
make ci-local

# Espelha o CD (build Docker standalone, mesmo target do workflow)
make docker-build

# Ou via Docker direto
docker build --target runner -t marketplace-backend:local .

# Verificar que a imagem roda
docker run --rm marketplace-backend:local node -e "console.log('OK')"

# Via Docker Compose (com banco e envs)
make prod-up
```

## Evoluindo o pipeline

Sugestoes para futuras equipes:

- **Deploy staging**: adicionar job `deploy-staging` com `environment: staging`
  e pull da imagem no servidor.
- **Aprovacao manual**: usar GitHub Environments com protection rules para
  exigir aprovacao antes de deploy em producao.
- **Smoke tests**: job pos-deploy que faz `curl --fail` no healthcheck.
- **Notificacoes**: integrar Discord/Slack com
  `sarisia/actions-status-discord`.
- **Multi-arch**: adicionar `platforms: linux/amd64,linux/arm64` no
  build-push-action.
- **Vulnerability scanning**: Trivy ou Grype na imagem antes do push.

## Referencia rapida

| Action | Versao | Proposito |
|---|---|---|
| `actions/checkout` | v4 | Checkout do codigo |
| `docker/setup-buildx-action` | v3 | Buildx com cache avancado |
| `docker/login-action` | v3 | Autenticacao no GHCR |
| `docker/metadata-action` | v5 | Tags e labels OCI automaticos |
| `docker/build-push-action` | v6 | Build e push da imagem |
