#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

APP_PORT="${PORT:-3000}"
API_BASE_URL="http://localhost:${APP_PORT}/api"

cleanup() {
  local exit_code=$?

  if [[ "${DEMO_DOWN_DOCKER:-false}" == "true" ]]; then
    echo "[demo] Derrubando containers do docker-compose..."
    make dev-down
  fi

  exit "$exit_code"
}

trap cleanup EXIT

if ! command -v make >/dev/null 2>&1; then
  echo "[demo] ERRO: O comando 'make' não foi encontrado. Por favor, instale-o."
  exit 1
fi

if [[ "${1:-}" == "--down" ]]; then
  DEMO_DOWN_DOCKER=true
fi

if [[ ! -f ".env.development" ]]; then
  echo "[demo] .env.development não encontrado. Criando a partir do exemplo..."
  make env-setup
  echo "[demo] Revise .env.development se precisar de ajustes antes do próximo passo."
fi

echo "[demo] 1/3 - Recriando ambiente de desenvolvimento com: make dev-reset && make dev-up"
make dev-reset
make dev-up

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
  TAIL=80 make dev-logs-once || true
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

echo "[demo] 2/3 - Simulando POST ${API_BASE_URL}/users"
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

echo "[demo] 3/3 - Trecho dos logs da API (fluxo entre arquivos):"
TAIL=120 make dev-logs-once || true

echo
if [[ "${DEMO_DOWN_DOCKER:-false}" == "true" ]]; then
  echo "[demo] Ambiente será encerrado (containers)."
else
  echo "[demo] O ambiente continuará rodando."
  echo "[demo] Para derrubar os containers, rode: make dev-down"
fi
