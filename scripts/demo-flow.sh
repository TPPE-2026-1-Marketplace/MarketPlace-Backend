#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

APP_PORT="${PORT:-3000}"
API_BASE_URL="http://localhost:${APP_PORT}/api"
APP_LOG_FILE="${ROOT_DIR}/.demo-backend.log"
STARTED_APP_BY_SCRIPT=false

cleanup() {
  local exit_code=$?

  if [[ "$STARTED_APP_BY_SCRIPT" == "true" ]] && [[ -n "${APP_PID:-}" ]] && kill -0 "$APP_PID" 2>/dev/null; then
    echo "[demo] Encerrando processo da API (PID=$APP_PID)..."
    kill "$APP_PID" 2>/dev/null || true
    wait "$APP_PID" 2>/dev/null || true
  fi

  if [[ "${DEMO_DOWN_DOCKER:-false}" == "true" ]]; then
    echo "[demo] Derrubando containers do docker-compose..."
    ${COMPOSE_CMD} down
  fi

  exit "$exit_code"
}

trap cleanup EXIT

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
else
  echo "[demo] ERRO: Docker Compose não encontrado. Instale 'docker compose' ou 'docker-compose'."
  exit 1
fi

if [[ "${1:-}" == "--down" ]]; then
  DEMO_DOWN_DOCKER=true
fi

is_app_port_busy() {
  ss -ltn 2>/dev/null | grep -q ":${APP_PORT} "
}

kill_app_port_processes() {
  local pids=""

  pids=$(ss -ltnp 2>/dev/null | grep ":${APP_PORT} " | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | sort -u || true)

  if [[ -n "$pids" ]]; then
    echo "[demo] Processo(s) existente(s) na porta ${APP_PORT}: $pids"
    echo "[demo] Encerrando processo(s) para iniciar do zero..."

    for pid in $pids; do
      if kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null || true
      fi
    done

    sleep 1

    for pid in $pids; do
      if kill -0 "$pid" 2>/dev/null; then
        echo "[demo] Forçando encerramento do PID=$pid"
        kill -9 "$pid" 2>/dev/null || true
      fi
    done
  fi
}

echo "[demo] 1/3 - Subindo banco com: ${COMPOSE_CMD} up -d postgres"
${COMPOSE_CMD} up -d postgres

echo "[demo] 2/3 - Garantindo porta ${APP_PORT} livre e iniciando API com pnpm run start:dev"
kill_app_port_processes

if is_app_port_busy; then
  echo "[demo] ERRO: não foi possível liberar a porta ${APP_PORT}."
  exit 1
fi

: > "$APP_LOG_FILE"
pnpm run start:dev > "$APP_LOG_FILE" 2>&1 &
APP_PID=$!
STARTED_APP_BY_SCRIPT=true

# Aguarda API ficar acessível antes de disparar a requisição.
echo "[demo] Aguardando API em ${API_BASE_URL}..."
for _ in {1..60}; do
  if curl -sS -o /dev/null "${API_BASE_URL}"; then
    break
  fi
  sleep 1
done

if ! curl -sS -o /dev/null "${API_BASE_URL}"; then
  echo "[demo] ERRO: API não respondeu a tempo."
  echo "[demo] Últimas linhas do log da API:"
  tail -n 80 "$APP_LOG_FILE" || true
  exit 1
fi

now="$(date +%s)"
email="demo.${now}@example.com"
cpf="$(printf '%011d' "$((10000000000 + now % 89999999999))")"
telefone="1199$((100000 + now % 899999))"

payload=$(cat <<JSON
{
  "name": "Usuario Demo",
  "email": "${email}",
  "password": "123456",
  "cpf": "${cpf}",
  "telefone": "${telefone}"
}
JSON
)

echo "[demo] 3/3 - Simulando POST ${API_BASE_URL}/users"
response_with_code=$(curl -sS -X POST "${API_BASE_URL}/users" \
  -H 'Content-Type: application/json' \
  -d "$payload" \
  -w $'\nHTTP_STATUS:%{http_code}')

http_status="$(echo "$response_with_code" | awk -F: '/HTTP_STATUS/ {print $2}')"
response_body="$(echo "$response_with_code" | sed '/HTTP_STATUS:/d')"

echo "[demo] Status HTTP: ${http_status}"
echo "[demo] Resposta: ${response_body}"

echo
if [[ "$http_status" =~ ^2 ]]; then
  echo "[demo] Fluxo finalizado com sucesso."
else
  echo "[demo] Fluxo terminou com erro HTTP."
fi

echo "[demo] Trecho dos logs da API (fluxo entre arquivos):"
tail -n 120 "$APP_LOG_FILE" || true

echo
if [[ "${DEMO_DOWN_DOCKER:-false}" == "true" ]]; then
  echo "[demo] Ambiente será encerrado (containers + API)."
else
  echo "[demo] Apenas a API iniciada pelo script será encerrada; o Postgres continuará rodando."
  echo "[demo] Para derrubar containers automaticamente, rode: pnpm run demo:flow:down"
fi
