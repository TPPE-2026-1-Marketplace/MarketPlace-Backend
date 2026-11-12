# Makefile do backend. Mesmo esqueleto e mesmos nomes de comando do frontend
# (MarketPlace-Frontend): o que é comum aos dois fica nas seções Setup, Local,
# Desenvolvimento, Produção local e Utilidades; o que é só deste repositório
# fica em "Específicos do backend". `make help` é gerado a partir dos
# comentários `## ` de cada alvo e dos títulos `##@`.

COMPOSE_PROJECT := marketplace-backend
# DEBUG=1 soma o compose.debug.yml: mesma API de dev, com o inspector do Node
# em 127.0.0.1:9229 (ver docs/debug.md). Ex.: make dev-up DEBUG=1
COMPOSE_DEV := docker compose -p $(COMPOSE_PROJECT) --env-file .env.development -f compose.dev.yml $(if $(DEBUG),-f compose.debug.yml)
COMPOSE_PROD := docker compose -p $(COMPOSE_PROJECT) --env-file .env.production -f compose.prod.yml
SERVICE := api

export DOCKER_BUILDKIT := 1
export COMPOSE_DOCKER_CLI_BUILD := 1

.DEFAULT_GOAL := help

.PHONY: help hooks hooks-off env-setup env-check install \
	dev lint test build start clean \
	dev-up dev-down dev-restart dev-build dev-rebuild dev-reset dev-logs dev-shell \
	dev-test dev-test-cov dev-lint dev-lint-fix dev-format dev-typecheck dev-check dev-ci \
	prod-up prod-down prod-logs prod-build prod-rebuild prod-image \
	check \
	gen-secrets dev-test-integration dev-openapi dev-logs-once dev-logs-api dev-logs-postgres \
	db-shell db-reset db-seed db-seed-reset db-backup demo smoke-real

##@ Setup

help: ## Lista os comandos disponíveis
	@awk 'BEGIN { FS = ":.*## " } \
		/^##@/ { printf "\n%s\n", substr($$0, 5) } \
		/^[a-zA-Z0-9_-]+:.*## / { printf "  make %-22s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo ""
	@echo "Opções: DEBUG=1 (dev-up/dev-restart/dev-rebuild), path=<padrão> (dev-test*), svc=<serviço> (dev-logs)"

# O core.hooksPath aqui pertence ao husky (.husky/_), que já roda o
# pre-commit/lint-staged. Em vez de sequestrar essa config, instalamos um
# shim .husky/commit-msg que delega para .githooks/commit-msg — assim os
# dois hooks convivem e o shim sobrevive a um 'pnpm install'.
hooks: ## Ativa o commit-msg versionado (.githooks) via shim do husky
	@printf '%s\n' '#!/usr/bin/env sh' 'exec "$$(dirname "$$0")/../.githooks/commit-msg" "$$@"' > .husky/commit-msg
	@chmod +x .husky/commit-msg
	@echo "Hook commit-msg ativado a partir de .githooks/ (shim em .husky/commit-msg)"

hooks-off: ## Desativa o commit-msg versionado (o pre-commit do husky segue ativo)
	@rm -f .husky/commit-msg
	@echo "Hook commit-msg desativado (husky/pre-commit segue ativo)"

env-setup: ## Cria .env.development e .env.production a partir dos .example
	cp -n .env.development.example .env.development || true
	cp -n .env.production.example .env.production || true
	@echo "Arquivos .env.development e .env.production criados (se ainda nao existiam)."
	@echo "Edite-os com os valores reais antes de subir o ambiente."
	@echo "Execute 'make gen-secrets' para gerar o JWT_SECRET automaticamente."

env-check: ## Compara as chaves dos .env com as dos .example (sem mostrar valores)
	@sh scripts/env-check.sh

install: ## Instala as dependências no host com pnpm
	pnpm install

##@ Local (sem Docker)

# Sem Docker o Nest não lê .env.* sozinho (o ConfigModule não tem envFilePath):
# carregamos o .env.development no shell e apontamos o banco para o host.
# Precisa de um Postgres em localhost, ex.: $(COMPOSE_DEV) up -d postgres
dev: ## Sobe a API no host, com o .env.development e hot reload
	set -a && . ./.env.development && set +a && POSTGRES_HOST=localhost pnpm start:dev

lint: ## ESLint no host
	pnpm lint

test: ## Testes unitários no host
	pnpm test

build: ## Build de produção no host (dist/)
	pnpm build

start: ## Inicia a API a partir do build (dist/)
	pnpm start:prod

clean: ## Remove os artefatos de build
	rm -rf dist tsconfig.tsbuildinfo tsconfig.build.tsbuildinfo

##@ Desenvolvimento (Docker)

dev-up: ## Sobe o ambiente de desenvolvimento (DEBUG=1 liga o inspector)
	$(COMPOSE_DEV) up -d

dev-down: ## Derruba o ambiente de desenvolvimento
	$(COMPOSE_DEV) down

dev-restart: ## Recria os containers (down + up) sem rebuild
	$(COMPOSE_DEV) down
	$(COMPOSE_DEV) up -d

dev-build: ## Só constrói a imagem de desenvolvimento
	$(COMPOSE_DEV) build $(SERVICE)

dev-rebuild: ## Reconstrói a imagem e sobe o ambiente
	$(COMPOSE_DEV) up --build -d

dev-reset: ## Derruba tudo e APAGA OS VOLUMES (banco e cache)
	$(COMPOSE_DEV) down -v
	rm -rf dist tsconfig.tsbuildinfo

dev-logs: ## Acompanha os logs (svc=api|postgres para filtrar)
	$(COMPOSE_DEV) logs -f $(svc)

dev-shell: ## Abre um shell no container da API
	$(COMPOSE_DEV) exec $(SERVICE) sh

dev-test: ## Testes unitários no container (path=<padrão> filtra)
	$(COMPOSE_DEV) exec $(SERVICE) pnpm test $(if $(path),--testPathPattern="$(path)",)

dev-test-cov: ## Testes (unit + integração) com cobertura no container
	$(COMPOSE_DEV) exec $(SERVICE) pnpm test:cov $(if $(path),--testPathPattern="$(path)",)

dev-lint: ## ESLint no container (sem fix)
	$(COMPOSE_DEV) exec $(SERVICE) pnpm lint

dev-lint-fix: ## ESLint com auto-fix no container
	$(COMPOSE_DEV) exec $(SERVICE) pnpm lint:fix

dev-format: ## Aplica o Prettier no container
	$(COMPOSE_DEV) exec $(SERVICE) pnpm format

dev-typecheck: ## Verifica os tipos (tsc --noEmit) no container
	$(COMPOSE_DEV) exec $(SERVICE) pnpm typecheck

dev-check: ## lint + typecheck + format:check no container (espelha o job lint do CI)
	$(COMPOSE_DEV) exec $(SERVICE) sh -c "pnpm lint && pnpm typecheck && pnpm format:check"

dev-ci: ## dev-check + build + testes no container (espelha o CI)
	$(COMPOSE_DEV) exec $(SERVICE) sh -c "pnpm lint && pnpm typecheck && pnpm format:check && pnpm build && pnpm test"

##@ Produção local (Docker)

prod-up: ## Sobe a imagem de produção localmente (.env.production)
	$(COMPOSE_PROD) up -d

prod-down: ## Derruba o ambiente de produção local
	$(COMPOSE_PROD) down

prod-logs: ## Acompanha os logs da produção local
	$(COMPOSE_PROD) logs -f

prod-build: ## Só constrói a imagem de produção
	$(COMPOSE_PROD) build $(SERVICE)

prod-rebuild: ## Reconstrói a imagem de produção e sobe
	$(COMPOSE_PROD) up --build -d

prod-image: ## Builda a imagem runner como o CD (marketplace-backend:local)
	docker build --target runner -t marketplace-backend:local .

##@ Utilidades

check: ## Valida o Dockerfile (docker build --check)
	docker build . --check

##@ Específicos do backend

gen-secrets: ## Gera um JWT_SECRET aleatório nos .env existentes
	$(eval SECRET := $(shell openssl rand -base64 32))
	@for env_file in .env.development .env.production; do \
		if [ -f $$env_file ]; then \
			if grep -q "^JWT_SECRET=" $$env_file; then \
				sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(SECRET)|" $$env_file; \
			else \
				echo "JWT_SECRET=$(SECRET)" >> $$env_file; \
			fi; \
			echo "JWT_SECRET atualizado em $$env_file"; \
		fi; \
	done

dev-test-integration: ## Testes de integração no container (path=<padrão> filtra)
	$(COMPOSE_DEV) exec $(SERVICE) pnpm test:integration $(if $(path),--testPathPattern="$(path)",)

dev-openapi: ## Gera o openapi.json a partir da API no container
	$(COMPOSE_DEV) exec $(SERVICE) pnpm openapi:export

dev-logs-once: ## Mostra os últimos logs uma vez (TAIL=120)
	$(COMPOSE_DEV) logs --tail $${TAIL:-120}

dev-logs-api: ## Atalho: dev-logs svc=api
	@$(MAKE) --no-print-directory dev-logs svc=$(SERVICE)

dev-logs-postgres: ## Atalho: dev-logs svc=postgres
	@$(MAKE) --no-print-directory dev-logs svc=postgres

db-shell: ## psql no Postgres de desenvolvimento
	$(COMPOSE_DEV) exec postgres sh -c 'psql -U $${POSTGRES_USER} -d $${POSTGRES_DB}'

db-reset: ## Recria só o volume do banco de desenvolvimento
	$(COMPOSE_DEV) down
	docker volume rm $(COMPOSE_PROJECT)_postgres_data || true
	$(COMPOSE_DEV) up -d

# Seed de desenvolvimento (scripts/seed-dev.sql): usuários por perfil, catálogo,
# estoque e pedidos dos últimos 6 meses. Idempotente. O schema vem do
# synchronize do TypeORM, então a API precisa responder antes do seed.
SEED_FILE := scripts/seed-dev.sql
API_HEALTH_URL := http://localhost:$${PORT:-3001}/api/health

db-seed: ## Popula o banco com o seed de desenvolvimento (não apaga dados)
	@echo "[seed] Aguardando a API em $(API_HEALTH_URL) (o schema é criado no boot)..."
	@for i in $$(seq 1 40); do curl -sf $(API_HEALTH_URL) > /dev/null && break; sleep 3; done; \
		curl -sf $(API_HEALTH_URL) > /dev/null || (echo "[seed] ERRO: API não respondeu. Rode make dev-up e confira make dev-logs svc=api." && exit 1)
	$(COMPOSE_DEV) exec -T postgres sh -c 'psql -U $${POSTGRES_USER} -d $${POSTGRES_DB} -v ON_ERROR_STOP=1 -q' < $(SEED_FILE) > /dev/null
	@echo "[seed] Banco populado. Credenciais de desenvolvimento: README.md, seção \"Seed de desenvolvimento\"."

db-seed-reset: db-reset db-seed ## Recria o banco e aplica o seed

db-backup: ## Dump SQL do banco de desenvolvimento (backup_<data>.sql)
	$(COMPOSE_DEV) exec -T postgres sh -c 'pg_dump -U $${POSTGRES_USER} -d $${POSTGRES_DB}' > backup_$$(date +%Y%m%d_%H%M%S).sql
	@echo "Backup gerado em backup_$$(date +%Y%m%d_%H%M%S).sql"

demo: ## Fluxo de compra ponta a ponta (recria o ambiente)
	bash scripts/demo-flow.sh

smoke-real: ## Smoke test das integrações reais (image=<imagem> opcional)
	bash scripts/smoke-real.sh $(if $(image),$(image),)
