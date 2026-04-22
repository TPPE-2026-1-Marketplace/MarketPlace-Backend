COMPOSE_DEV := docker compose -f compose.dev.yml
COMPOSE_PROD := docker compose -f compose.prod.yml
SERVICE := api

export DOCKER_BUILDKIT := 1
export COMPOSE_DOCKER_CLI_BUILD := 1

.PHONY: help env-setup install dev lint test build start \
	docker-build docker-up docker-down docker-logs docker-shell docker-rebuild docker-reset \
	docker-prod-build docker-prod-up docker-prod-down docker-prod-logs \
	dev-up dev-down dev-logs dev-shell dev-build dev-rebuild \
	prod-up prod-down prod-logs prod-build clean

help:
	@echo "Comandos disponiveis:"
	@echo "  make env-setup        Cria .env a partir de .env.example, sem sobrescrever"
	@echo "  make install          Instala dependencias localmente com pnpm"
	@echo "  make dev              Sobe o Nest localmente em modo desenvolvimento"
	@echo "  make lint             Executa o lint do projeto"
	@echo "  make test             Executa os testes"
	@echo "  make build            Gera o build local de producao"
	@echo "  make start            Inicia a aplicacao local usando o build"
	@echo "  make docker-build     Constroi a imagem Docker de desenvolvimento"
	@echo "  make docker-up        Sobe o ambiente Docker de desenvolvimento"
	@echo "  make docker-down      Derruba o ambiente Docker de desenvolvimento"
	@echo "  make docker-logs      Exibe os logs do ambiente Docker de desenvolvimento"
	@echo "  make docker-shell     Abre um shell no container da API"
	@echo "  make docker-rebuild   Reconstrui a imagem Docker de desenvolvimento sem cache"
	@echo "  make docker-reset     Derruba o ambiente Docker de desenvolvimento e remove volumes"
	@echo "  make docker-prod-build Constroi a imagem Docker de producao"
	@echo "  make docker-prod-up   Sobe o ambiente Docker de producao"
	@echo "  make docker-prod-down Derruba o ambiente Docker de producao"
	@echo "  make docker-prod-logs Exibe os logs do ambiente Docker de producao"
	@echo "  make clean            Remove artefatos locais de build"
	@echo "  make check           Verifica se a imagem do dockerfile está correta"

env-setup:
	cp -n .env.example .env

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

docker-build: dev-build

docker-up: dev-up

docker-down: dev-down

docker-logs: dev-logs

docker-shell: dev-shell

docker-rebuild: dev-rebuild

docker-reset:
	$(COMPOSE_DEV) down -v

docker-prod-build: prod-build

docker-prod-up: prod-up

docker-prod-down: prod-down

docker-prod-logs: prod-logs

dev-up:
	$(COMPOSE_DEV) up -d --build

dev-down:
	$(COMPOSE_DEV) down

dev-logs:
	$(COMPOSE_DEV) logs -f api postgres

dev-shell:
	$(COMPOSE_DEV) exec api sh

dev-build:
	$(COMPOSE_DEV) build api

dev-rebuild:
	$(COMPOSE_DEV) build --no-cache api

prod-up:
	$(COMPOSE_PROD) up -d --build

prod-down:
	$(COMPOSE_PROD) down

prod-logs:
	$(COMPOSE_PROD) logs -f api

prod-build:
	$(COMPOSE_PROD) build api

clean:
	rm -rf dist tsconfig.build.tsbuildinfo

check:
	docker build . --check
