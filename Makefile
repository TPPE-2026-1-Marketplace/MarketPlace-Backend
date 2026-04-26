COMPOSE_PROJECT := marketplace-backend
COMPOSE_DEV := docker compose -p $(COMPOSE_PROJECT) --env-file .env.development -f compose.dev.yml
COMPOSE_PROD := docker compose -p $(COMPOSE_PROJECT) --env-file .env.production -f compose.prod.yml
SERVICE := api

export DOCKER_BUILDKIT := 1
export COMPOSE_DOCKER_CLI_BUILD := 1

.PHONY: help env-setup install dev lint test build start \
	dev-up dev-down dev-logs dev-shell dev-build dev-rebuild dev-restart dev-reset \
	prod-up prod-down prod-logs prod-build prod-rebuild \
	db-shell db-reset \
	clean check

help:
	@echo "Setup e local:"
	@echo "  make env-setup        Cria .env.development e .env.production a partir dos .example"
	@echo "  make install          Instala dependencias localmente com pnpm"
	@echo "  make dev              Sobe o Nest localmente (sem Docker) em modo desenvolvimento"
	@echo "  make lint             Executa o lint do projeto"
	@echo "  make test             Executa os testes"
	@echo "  make build            Gera o build local de producao"
	@echo "  make start            Inicia a aplicacao local usando o build"
	@echo ""
	@echo "Desenvolvimento (Docker):"
	@echo "  make dev-up           Sobe o ambiente Docker de desenvolvimento"
	@echo "  make dev-down         Derruba o ambiente Docker de desenvolvimento"
	@echo "  make dev-logs         Exibe logs do ambiente Docker de desenvolvimento"
	@echo "  make dev-shell        Abre um shell no container da API"
	@echo "  make dev-build        Apenas constroi a imagem de desenvolvimento"
	@echo "  make dev-rebuild      Constroi e sobe o ambiente Docker de desenvolvimento"
	@echo "  make dev-restart      Recria os containers (down + up) sem rebuild"
	@echo "  make dev-reset        Derruba o ambiente e REMOVE TODOS OS VOLUMES (apaga banco e cache)"
	@echo ""
	@echo "Producao (Docker):"
	@echo "  make prod-up          Sobe o ambiente Docker de producao"
	@echo "  make prod-down        Derruba o ambiente Docker de producao"
	@echo "  make prod-logs        Exibe logs do ambiente Docker de producao"
	@echo "  make prod-build       Apenas constroi a imagem de producao"
	@echo "  make prod-rebuild     Constroi e sobe o ambiente Docker de producao"
	@echo ""
	@echo "Banco de dados:"
	@echo "  make db-shell         Abre um psql no container do postgres"
	@echo "  make db-reset         Apaga apenas o volume do postgres (mantem cache de deps)"
	@echo ""
	@echo "Utilidades:"
	@echo "  make clean            Remove artefatos locais de build"
	@echo "  make check            Verifica se o Dockerfile esta correto"

env-setup:
	cp -n .env.development.example .env.development || true
	cp -n .env.production.example .env.production || true
	@echo "Arquivos .env.development e .env.production criados (se ainda nao existiam)."
	@echo "Edite-os com os valores reais antes de subir o ambiente."

install:
	pnpm install

dev:
	pnpm start:dev

lint:
	pnpm lint

test:
	pnpm test

build:
	pnpm build

start:
	pnpm start:prod

dev-up:
	$(COMPOSE_DEV) up -d

dev-down:
	$(COMPOSE_DEV) down

dev-logs:
	$(COMPOSE_DEV) logs -f

dev-shell:
	$(COMPOSE_DEV) exec $(SERVICE) sh

dev-build:
	$(COMPOSE_DEV) build $(SERVICE)

dev-rebuild:
	$(COMPOSE_DEV) up --build -d

dev-restart:
	$(COMPOSE_DEV) down
	$(COMPOSE_DEV) up -d

dev-reset:
	$(COMPOSE_DEV) down -v

prod-up:
	$(COMPOSE_PROD) up -d

prod-down:
	$(COMPOSE_PROD) down

prod-logs:
	$(COMPOSE_PROD) logs -f

prod-build:
	$(COMPOSE_PROD) build $(SERVICE)

prod-rebuild:
	$(COMPOSE_PROD) up --build -d

db-shell:
	$(COMPOSE_DEV) exec postgres sh -c 'psql -U $${POSTGRES_USER} -d $${POSTGRES_DB}'

db-reset:
	$(COMPOSE_DEV) down
	docker volume rm $(COMPOSE_PROJECT)_postgres_data || true
	$(COMPOSE_DEV) up -d

clean:
	rm -rf dist tsconfig.build.tsbuildinfo

check:
	docker build . --check
