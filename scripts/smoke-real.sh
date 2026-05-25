#!/usr/bin/env bash
# smoke-real.sh — valida as integrações EXTERNAS REAIS contra o app rodando:
#   - Frete (Melhor Envio)
#   - Imagem (upload ImgBB)
#   - Pagamento (InfinitePay)
#
# Ao contrário dos testes *.integration.ts (que mockam tudo) e do demo-flow.sh
# (que usa pagamento mock), aqui as chamadas vão pras APIs REAIS quando as
# credenciais estão no .env.development. Não é rodado pelo CI e NÃO reseta o
# banco — só semeia um admin idempotente e cria linhas de teste com SKU único.
#
# Cada integração roda de forma independente: se a credencial não estiver
# configurada, aquela parte é PULADA (SKIP), não falha o script.
#
# Uso:
#   bash scripts/smoke-real.sh                 # gera uma imagem 1x1 pro upload
#   bash scripts/smoke-real.sh caminho/foto.png # usa sua própria imagem
#   make smoke-real
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMPOSE_DEV=(docker compose -p marketplace-backend --env-file .env.development -f compose.dev.yml)
IMAGE_PATH="${1:-}"

command -v make >/dev/null 2>&1 || {
  echo "[smoke] ERRO: 'make' não encontrado."
  exit 1
}
[[ -f ".env.development" ]] || {
  echo "[smoke] ERRO: .env.development não encontrado. Rode 'make env-setup'."
  exit 1
}

# Lê uma chave do .env.development sem executá-lo (valores podem ter espaços).
get_env() {
  grep -E "^$1=" .env.development | tail -1 | cut -d= -f2- | tr -d '"' | tr -d "'"
}

# is_set VALOR — verdadeiro se a var está preenchida e NÃO é um placeholder
# dos arquivos .example (cole-aqui..., sua_chave..., seu-handle..., your_...).
is_set() {
  local v="$1"
  [[ -n "$v" \
    && "$v" != cole-aqui* \
    && "$v" != sua_chave* \
    && "$v" != seu-handle* \
    && "$v" != your_* \
    && "$v" != your-* ]]
}

APP_PORT="$(get_env PORT)"; APP_PORT="${APP_PORT:-3001}"
POSTGRES_USER="$(get_env POSTGRES_USER)"
POSTGRES_DB="$(get_env POSTGRES_DB)"
API="http://localhost:${APP_PORT}/api"

ME_CLIENT_ID="$(get_env MELHOR_ENVIO_CLIENT_ID)"
ME_SECRET="$(get_env MELHOR_ENVIO_CLIENT_SECRET)"
ME_REFRESH="$(get_env MELHOR_ENVIO_REFRESH_TOKEN)"
ME_ACCESS="$(get_env MELHOR_ENVIO_ACCESS_TOKEN)"
IMGBB_KEY="$(get_env IMGBB_API_KEY)"
PAY_PROVIDER="$(get_env PAYMENT_GATEWAY_PROVIDER)"
INFINITE_HANDLE="$(get_env INFINITEPAY_HANDLE)"

# Expectativa por credencial (frete sempre roda; detectamos real vs fallback nos logs).
SHIPPING_CONFIGURED=false
if is_set "$ME_ACCESS" || { is_set "$ME_CLIENT_ID" && is_set "$ME_SECRET" && is_set "$ME_REFRESH"; }; then
  SHIPPING_CONFIGURED=true
fi
IMAGE_CONFIGURED=false
is_set "$IMGBB_KEY" && IMAGE_CONFIGURED=true
PAYMENT_CONFIGURED=false
[[ "$PAY_PROVIDER" == "infinitepay" ]] && is_set "$INFINITE_HANDLE" && PAYMENT_CONFIGURED=true

RESULT_SHIPPING="SKIP"
RESULT_IMAGE="SKIP"
RESULT_PAYMENT="SKIP"
PAYMENT_REDIRECT=""

# ---------------------------------------------------------------------------
# Helpers HTTP
# ---------------------------------------------------------------------------
BODY=''
STATUS=''

# http METHOD URL TOKEN [JSON_BODY] -> imprime "corpo\n<status>"
http() {
  local method="$1" url="$2" token="$3" data="${4:-}"
  local args=(-sS -X "$method" "$url" -H 'Content-Type: application/json')
  [[ -n "$token" ]] && args+=(-H "Authorization: Bearer ${token}")
  [[ -n "$data" ]] && args+=(-d "$data")
  curl "${args[@]}" -w $'\n%{http_code}'
}

# probe ... — popula BODY/STATUS, nunca sai do script (continua no erro).
probe() {
  local response
  response="$(http "$@")" || true
  STATUS="${response##*$'\n'}"
  BODY="${response%$'\n'*}"
}

# call ... — como probe, mas falha o script se status não for 2xx (setup crítico).
call() {
  local desc="$1"; shift
  probe "$@"
  if [[ ! "$STATUS" =~ ^2 ]]; then
    echo "[smoke] ERRO em setup: ${desc} (HTTP ${STATUS})"
    echo "[smoke] Resposta: ${BODY}"
    exit 1
  fi
}

json() {
  echo "$BODY" | grep -oP "\"$1\":\s*\"?\K[^\",}]+" | head -1 || true
}

# ---------------------------------------------------------------------------
# 0. App no ar (sem reset)
# ---------------------------------------------------------------------------
echo "[smoke] Garantindo que o app está no ar (make dev-up, sem reset)..."
make dev-up
echo "[smoke] Aguardando ${API}/health ..."
for _ in $(seq 1 90); do
  curl -sf "${API}/health" >/dev/null 2>&1 && break
  sleep 1
done
curl -sf "${API}/health" >/dev/null 2>&1 || {
  echo "[smoke] ERRO: API não respondeu a tempo."
  TAIL=80 make dev-logs-once || true
  exit 1
}
echo "[smoke] API no ar."

# ---------------------------------------------------------------------------
# 1. Admin (idempotente) — necessário pra upload de imagem e criação de catálogo
# ---------------------------------------------------------------------------
ADMIN_CPF="00000000000"
ADMIN_EMAIL="admin@smoke.com"
ADMIN_PASS="admin123"

echo "[smoke] Semeando administrador (${ADMIN_EMAIL})..."
ADMIN_HASH="$("${COMPOSE_DEV[@]}" exec -T api node -e "process.stdout.write(require('bcrypt').hashSync('${ADMIN_PASS}',10))")"
"${COMPOSE_DEV[@]}" exec -T postgres \
  psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -v ON_ERROR_STOP=1 \
  -v cpf="${ADMIN_CPF}" -v email="${ADMIN_EMAIL}" -v senha="${ADMIN_HASH}" <<'SQL'
INSERT INTO person (cpf, nome, email, senha)
VALUES (:'cpf', 'Admin Smoke', :'email', :'senha')
ON CONFLICT (cpf) DO UPDATE SET senha = EXCLUDED.senha, email = EXCLUDED.email;
INSERT INTO employee (cpf, ativo, role_perfil)
VALUES (:'cpf', true, 'administrador')
ON CONFLICT (cpf) DO NOTHING;
SQL

call "Login do admin" POST "${API}/auth/login" "" \
  "{\"email\":\"${ADMIN_EMAIL}\",\"senha\":\"${ADMIN_PASS}\"}"
ADMIN_TOKEN="$(json access_token)"

# ===========================================================================
# FRETE (Melhor Envio)
# ===========================================================================
echo
echo "===== FRETE (Melhor Envio) ====="
if [[ "$SHIPPING_CONFIGURED" != "true" ]]; then
  echo "[smoke] Sem credenciais Melhor Envio — a chamada vai usar o FALLBACK por CEP."
fi
SINCE="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
probe POST "${API}/shipping/calculate" "$ADMIN_TOKEN" '{"cep_destino":"01310100"}'
if [[ "$STATUS" =~ ^2 ]]; then
  echo "[smoke] HTTP ${STATUS} | valor=R\$ $(json valor) | prazo=$(json prazo_dias) dias"
  sleep 1
  LOGS="$("${COMPOSE_DEV[@]}" logs --since "$SINCE" api 2>/dev/null || true)"
  if grep -qi "fallback" <<<"$LOGS"; then
    RESULT_SHIPPING="FALLBACK"
    echo "[smoke] -> Resposta veio do FALLBACK por faixa de CEP (Melhor Envio indisponível ou sem credencial)."
  else
    RESULT_SHIPPING="REAL"
    echo "[smoke] -> Cotação REAL do Melhor Envio."
  fi
else
  RESULT_SHIPPING="FAIL"
  echo "[smoke] FALHA (HTTP ${STATUS}): ${BODY}"
fi

# ===========================================================================
# IMAGEM (upload ImgBB)
# ===========================================================================
echo
echo "===== IMAGEM (upload ImgBB) ====="
if [[ "$IMAGE_CONFIGURED" != "true" ]]; then
  echo "[smoke] SKIP — IMGBB_API_KEY não configurada no .env.development."
else
  TMP_IMG=""
  if [[ -n "$IMAGE_PATH" ]]; then
    [[ -f "$IMAGE_PATH" ]] || { echo "[smoke] ERRO: imagem '$IMAGE_PATH' não existe."; exit 1; }
    UPLOAD_IMG="$IMAGE_PATH"
  else
    TMP_IMG="$(mktemp --suffix=.png)"
    # PNG 1x1 transparente
    base64 -d > "$TMP_IMG" <<'B64'
iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==
B64
    UPLOAD_IMG="$TMP_IMG"
  fi
  echo "[smoke] Enviando ${UPLOAD_IMG} para o ImgBB..."
  RESP="$(curl -sS -X POST "${API}/images/upload" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -F "file=@${UPLOAD_IMG}" \
    -w $'\n%{http_code}')"
  STATUS="${RESP##*$'\n'}"; BODY="${RESP%$'\n'*}"
  [[ -n "$TMP_IMG" ]] && rm -f "$TMP_IMG"
  IMG_URL="$(json url)"
  if [[ "$STATUS" =~ ^2 ]] && [[ "$IMG_URL" == *ibb.co* || "$IMG_URL" == *imgbb* ]]; then
    RESULT_IMAGE="REAL"
    echo "[smoke] HTTP ${STATUS} | url REAL do ImgBB: ${IMG_URL}"
  else
    RESULT_IMAGE="FAIL"
    echo "[smoke] FALHA (HTTP ${STATUS}): ${BODY}"
  fi
fi

# ===========================================================================
# PAGAMENTO (InfinitePay)
# ===========================================================================
echo
echo "===== PAGAMENTO (InfinitePay) ====="
if [[ "$PAYMENT_CONFIGURED" != "true" ]]; then
  echo "[smoke] SKIP — PAYMENT_GATEWAY_PROVIDER != infinitepay ou INFINITEPAY_HANDLE ausente."
  echo "[smoke]        (com o provider 'mock' o pagamento é aprovado localmente, sem chamada real.)"
else
  NOW="$(date +%s)"
  SKU="SMOKE-${NOW}"
  echo "[smoke] Criando produto/variante/estoque (SKU ${SKU})..."
  call "Criar produto" POST "${API}/products" "$ADMIN_TOKEN" \
    "{\"titulo\":\"Smoke Produto\",\"preco_base\":79.90,\"sku\":\"PROD-${NOW}\"}"
  PRODUCT_ID="$(json idProduto)"
  call "Criar variante" POST "${API}/product-variants" "$ADMIN_TOKEN" \
    "{\"idProduto\":${PRODUCT_ID},\"codigo_sku\":\"${SKU}\",\"preco_variante\":79.90,\"cor\":\"preto\",\"tamanho\":\"M\"}"
  call "Ajustar estoque" PATCH "${API}/inventory/${SKU}" "$ADMIN_TOKEN" \
    "{\"qtdOnline\":10,\"motivo\":\"Carga smoke\"}"

  CLIENT_CPF="$(printf '%011d' "$((10000000000 + NOW % 89999999999))")"
  CLIENT_EMAIL="cliente.smoke.${NOW}@smoke.com"
  CLIENT_PASS="cliente123"
  echo "[smoke] Auto-cadastro + login do cliente (${CLIENT_EMAIL})..."
  call "Registrar cliente" POST "${API}/people/register-user" "" \
    "{\"email\":\"${CLIENT_EMAIL}\",\"senha\":\"${CLIENT_PASS}\",\"cpf\":\"${CLIENT_CPF}\",\"nome\":\"Cliente Smoke\"}"
  call "Login do cliente" POST "${API}/auth/login" "" \
    "{\"email\":\"${CLIENT_EMAIL}\",\"senha\":\"${CLIENT_PASS}\"}"
  CLIENT_TOKEN="$(json access_token)"

  echo "[smoke] Criando pedido..."
  call "Criar pedido" POST "${API}/orders" "$CLIENT_TOKEN" \
    "{\"items\":[{\"variantSku\":\"${SKU}\",\"quantidade\":1}],\"tipoRetirada\":\"entrega\",\"valorFrete\":0}"
  ORDER_ID="$(json idPedido)"

  echo "[smoke] Registrando pagamento (cartão de crédito) via InfinitePay..."
  probe POST "${API}/payments" "$CLIENT_TOKEN" \
    "{\"idPedido\":${ORDER_ID},\"captureMethod\":\"credit_card\",\"installments\":1}"
  PAY_STATUS="$(json status)"
  PAYMENT_REDIRECT="$(json redirectUrl)"
  if [[ "$STATUS" =~ ^2 ]]; then
    RESULT_PAYMENT="REAL"
    echo "[smoke] HTTP ${STATUS} | status=${PAY_STATUS} | checkout: ${PAYMENT_REDIRECT:-<sem redirect_url>}"
    echo "[smoke] -> Pedido #${ORDER_ID}. Abra o link de checkout pra confirmar o pagamento real."
  else
    RESULT_PAYMENT="FAIL"
    echo "[smoke] FALHA (HTTP ${STATUS}): ${BODY}"
  fi
fi

# ===========================================================================
# Resumo
# ===========================================================================
echo
echo "==================== RESUMO (integrações reais) ===================="
printf " %-12s %s\n" "Frete"     "${RESULT_SHIPPING}"
printf " %-12s %s\n" "Imagem"    "${RESULT_IMAGE}"
printf " %-12s %s\n" "Pagamento" "${RESULT_PAYMENT}"
echo "===================================================================="
echo " REAL = chamou a API externa | FALLBACK = usou plano B local | SKIP = sem credencial | FAIL = erro"
echo

# Sai com erro só se alguma integração CONFIGURADA falhou (SKIP não é erro).
if [[ "$RESULT_SHIPPING" == "FAIL" || "$RESULT_IMAGE" == "FAIL" || "$RESULT_PAYMENT" == "FAIL" ]]; then
  exit 1
fi
