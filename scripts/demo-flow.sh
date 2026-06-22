#!/usr/bin/env bash
# Demonstra o fluxo de compra ponta-a-ponta da API DK Fashion usando o gateway
# de pagamento em modo "mock" (PAYMENT_GATEWAY_PROVIDER padrão).
#
# Passos:
#   1. Recria o ambiente Docker do zero (banco limpo).
#   2. Semeia um administrador direto no banco (não há rota pública para criar admin).
#   3. Admin cria produto -> variante -> estoque (catálogo).
#   4. Cliente faz auto-cadastro e login.
#   5. Calcula frete, cria pedido, paga (mock) e consulta o status final.
#
# Uso:
#   pnpm demo:flow          # mantém o ambiente no ar ao final
#   pnpm demo:flow -- --down  # derruba os containers ao final
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMPOSE_DEV=(docker compose -p marketplace-backend --env-file .env.development -f compose.dev.yml)

DEMO_DOWN_DOCKER=false
[[ "${1:-}" == "--down" ]] && DEMO_DOWN_DOCKER=true

cleanup() {
  local exit_code=$?
  if [[ "$DEMO_DOWN_DOCKER" == "true" ]]; then
    echo "[demo] Derrubando containers..."
    make dev-down || true
  fi
  exit "$exit_code"
}
trap cleanup EXIT

command -v make >/dev/null 2>&1 || {
  echo "[demo] ERRO: 'make' não encontrado."
  exit 1
}

if [[ ! -f ".env.development" ]]; then
  echo "[demo] .env.development não encontrado. Criando a partir do exemplo..."
  make env-setup
fi

# Lê apenas as chaves necessárias do .env.development sem executá-lo
# (valores podem conter espaços/parênteses que quebram o `source`).
get_env() {
  grep -E "^$1=" .env.development | tail -1 | cut -d= -f2- | tr -d '"' | tr -d "'"
}
APP_PORT="$(get_env PORT)"
APP_PORT="${APP_PORT:-3001}"
POSTGRES_USER="$(get_env POSTGRES_USER)"
POSTGRES_DB="$(get_env POSTGRES_DB)"
API="http://localhost:${APP_PORT}/api"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# http METHOD URL TOKEN [JSON_BODY] -> imprime "corpo\n<status>"
http() {
  local method="$1" url="$2" token="$3" data="${4:-}"
  local args=(-sS -X "$method" "$url" -H 'Content-Type: application/json')
  [[ -n "$token" ]] && args+=(-H "Authorization: Bearer ${token}")
  [[ -n "$data" ]] && args+=(-d "$data")
  curl "${args[@]}" -w $'\n%{http_code}'
}

BODY=''
STATUS=''
# call DESC METHOD URL TOKEN [BODY] — popula BODY/STATUS e falha se status não for 2xx.
call() {
  local desc="$1"
  shift
  local response
  response="$(http "$@")"
  STATUS="${response##*$'\n'}"
  BODY="${response%$'\n'*}"
  if [[ ! "$STATUS" =~ ^2 ]]; then
    echo "[demo] ERRO em: ${desc} (HTTP ${STATUS})"
    echo "[demo] Resposta: ${BODY}"
    exit 1
  fi
  echo "[demo] ${desc} -> HTTP ${STATUS}"
}

# json CHAVE — extrai o primeiro valor (string ou número) de uma chave do BODY.
json() {
  echo "$BODY" | grep -oP "\"$1\":\s*\"?\K[^\",}]+" | head -1
}

# ---------------------------------------------------------------------------
# 1. Ambiente
# ---------------------------------------------------------------------------
echo "[demo] 1/8 - Recriando ambiente (make dev-reset && make dev-up)..."
make dev-reset
make dev-up

echo "[demo] Aguardando API em ${API}/health ..."
for _ in $(seq 1 90); do
  if curl -sf "${API}/health" >/dev/null 2>&1; then break; fi
  sleep 1
done
curl -sf "${API}/health" >/dev/null 2>&1 || {
  echo "[demo] ERRO: API não respondeu a tempo."
  TAIL=80 make dev-logs-once || true
  exit 1
}
echo "[demo] API no ar."

# ---------------------------------------------------------------------------
# 2. Seed do administrador (direto no banco)
# ---------------------------------------------------------------------------
ADMIN_CPF="00000000000"
ADMIN_EMAIL="admin@demo.com"
ADMIN_PASS="admin123"

echo "[demo] 2/8 - Semeando administrador (${ADMIN_EMAIL})..."
ADMIN_HASH="$("${COMPOSE_DEV[@]}" exec -T api node -e "process.stdout.write(require('bcrypt').hashSync('${ADMIN_PASS}',10))")"

"${COMPOSE_DEV[@]}" exec -T postgres \
  psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -v ON_ERROR_STOP=1 \
  -v cpf="${ADMIN_CPF}" -v email="${ADMIN_EMAIL}" -v senha="${ADMIN_HASH}" <<'SQL'
INSERT INTO person (cpf, nome, email, senha)
VALUES (:'cpf', 'Admin Demo', :'email', :'senha')
ON CONFLICT (cpf) DO UPDATE SET senha = EXCLUDED.senha, email = EXCLUDED.email;

INSERT INTO employee (cpf, ativo, role_perfil)
VALUES (:'cpf', true, 'administrador')
ON CONFLICT (cpf) DO NOTHING;
SQL

call "Login do admin" POST "${API}/auth/login" "" \
  "{\"email\":\"${ADMIN_EMAIL}\",\"senha\":\"${ADMIN_PASS}\"}"
ADMIN_TOKEN="$(json access_token)"

# ---------------------------------------------------------------------------
# 3. Catálogo (admin)
# ---------------------------------------------------------------------------
NOW="$(date +%s)"
SKU="DEMO-${NOW}"

echo "[demo] 3/8 - Criando produto..."
call "Criar produto" POST "${API}/products" "$ADMIN_TOKEN" \
  "{\"titulo\":\"Camiseta Demo\",\"preco_base\":79.90,\"sku\":\"PROD-${NOW}\"}"
PRODUCT_ID="$(json idProduto)"

echo "[demo] 4/8 - Criando variante (SKU ${SKU})..."
call "Criar variante" POST "${API}/product-variants" "$ADMIN_TOKEN" \
  "{\"idProduto\":${PRODUCT_ID},\"codigo_sku\":\"${SKU}\",\"preco_variante\":79.90,\"cor\":\"preto\",\"tamanho\":\"M\"}"

echo "[demo] 5/8 - Definindo estoque online = 50..."
call "Ajustar estoque" PATCH "${API}/inventory/${SKU}" "$ADMIN_TOKEN" \
  "{\"qtdOnline\":50,\"motivo\":\"Carga inicial (demo)\"}"

# ---------------------------------------------------------------------------
# 4. Cliente
# ---------------------------------------------------------------------------
CLIENT_CPF="$(printf '%011d' "$((10000000000 + NOW % 89999999999))")"
CLIENT_EMAIL="cliente.${NOW}@demo.com"
CLIENT_PASS="cliente123"

echo "[demo] 6/8 - Auto-cadastro do cliente (${CLIENT_EMAIL})..."
call "Registrar cliente" POST "${API}/people/register-user" "" \
  "{\"email\":\"${CLIENT_EMAIL}\",\"senha\":\"${CLIENT_PASS}\",\"cpf\":\"${CLIENT_CPF}\",\"nome\":\"Cliente Demo\"}"

call "Login do cliente" POST "${API}/auth/login" "" \
  "{\"email\":\"${CLIENT_EMAIL}\",\"senha\":\"${CLIENT_PASS}\"}"
CLIENT_TOKEN="$(json access_token)"

# ---------------------------------------------------------------------------
# 5. Compra: frete -> pedido -> pagamento
# ---------------------------------------------------------------------------
echo "[demo] 7/8 - Calculando frete..."
call "Calcular frete" POST "${API}/shipping/calculate" "$CLIENT_TOKEN" \
  "{\"cep_destino\":\"01310100\"}"
FRETE="$(json valor)"
FRETE="${FRETE:-0}"
echo "[demo] Frete calculado: R\$ ${FRETE}"

echo "[demo] Criando pedido (1x ${SKU}, entrega)..."
call "Criar pedido" POST "${API}/orders" "$CLIENT_TOKEN" \
  "{\"items\":[{\"variantSku\":\"${SKU}\",\"quantidade\":1}],\"tipoRetirada\":\"entrega\",\"valorFrete\":${FRETE}}"
ORDER_ID="$(json idPedido)"
echo "[demo] Pedido #${ORDER_ID} criado (status pending)."

echo "[demo] 8/8 - Pagando o pedido via PIX (gateway mock)..."
call "Criar pagamento" POST "${API}/payments" "$CLIENT_TOKEN" \
  "{\"idPedido\":${ORDER_ID},\"captureMethod\":\"pix\",\"installments\":1}"
PAY_STATUS="$(json status)"
echo "[demo] Pagamento registrado com status: ${PAY_STATUS}"

call "Consultar pedido" GET "${API}/orders/${ORDER_ID}" "$CLIENT_TOKEN"
ORDER_STATUS="$(json status)"

echo
echo "==================== RESUMO DO FLUXO ===================="
echo " Produto ......: #${PRODUCT_ID} (SKU variante ${SKU})"
echo " Cliente ......: ${CLIENT_EMAIL} (CPF ${CLIENT_CPF})"
echo " Frete ........: R\$ ${FRETE}"
echo " Pedido .......: #${ORDER_ID} -> status final: ${ORDER_STATUS}"
echo " Pagamento ....: ${PAY_STATUS}"
echo "========================================================="
echo

if [[ "$ORDER_STATUS" == "paid" ]]; then
  echo "[demo] Fluxo concluído com sucesso (pedido pago)."
else
  echo "[demo] AVISO: pedido não ficou 'paid' (verifique PAYMENT_GATEWAY_PROVIDER=mock)."
fi

if [[ "$DEMO_DOWN_DOCKER" == "true" ]]; then
  echo "[demo] Ambiente será encerrado."
else
  echo "[demo] Ambiente continua no ar. Swagger: ${API%/api}/docs | Para derrubar: make dev-down"
fi
