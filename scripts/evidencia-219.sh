#!/usr/bin/env bash
# Lote de evidência simétrica da #219 (coluna data_edicao em review).
#
# Avalia o código do diretório atual. Pré-requisitos: Docker, `jq`, dependências
# instaladas, `.env.development` no diretório e a API dev no ar (`make dev-up`).
# Uso:
#   (worktree da #218) bash ../219-reviews-data-edicao/scripts/evidencia-219.sh ANTES
#   (worktree da #219) bash scripts/evidencia-219.sh DEPOIS
#
# Parte A: ciclo de migrations (up → down → up) num Postgres descartável, só com
# migrations, como o CI faz — o banco de dev usa synchronize e não prova a migration.
# Parte B: a API dev expõe dataEdicao na listagem pública e no GET mine.

API=${API:-http://localhost:3001/api}
ENVFILE=${ENVFILE:-.env.development}
PGC=${PGC:-marketplace-backend-postgres-1}
PGU=$(grep '^POSTGRES_USER=' "$ENVFILE" | cut -d= -f2)
PGD=$(grep '^POSTGRES_DB=' "$ENVFILE" | cut -d= -f2)

LABEL=${1:-SEM-ROTULO}
TS=$(date +%s)
BASE=${TS: -7}
SENHA='Senha@1234'

# CPF válido (a API valida os dígitos verificadores) a partir de 9 dígitos-base.
cpf_with_check_digits() {
  local base="$1" sum=0 i d1 d2
  for i in {0..8}; do sum=$((sum + ${base:i:1} * (10 - i))); done
  d1=$(((sum * 10 % 11) % 10))
  base="${base}${d1}"
  sum=0
  for i in {0..9}; do sum=$((sum + ${base:i:1} * (11 - i))); done
  d2=$(((sum * 10 % 11) % 10))
  printf '%s%s' "$base" "$d2"
}
cpf()  { cpf_with_check_digits "$(printf '%02d%s' "$1" "${BASE:0:7}")"; }
mail() { printf 'e%02d.%s@teste.local' "$1" "$TS"; }
psqlq() { docker exec -i "$PGC" psql -U "$PGU" -d "$PGD" -Atc "$1" 2>/dev/null; }

reg_cliente() {
  curl -s -o /dev/null -X POST "$API/people/register-user" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$(mail "$1")\",\"senha\":\"$SENHA\",\"cpf\":\"$(cpf "$1")\",\"nome\":\"Avaliador $1\",\"telefone\":\"61999990000\"}"
}
login() {
  curl -s -X POST "$API/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"senha\":\"$SENHA\"}" | jq -r .access_token
}
# Produto + variante + pedido pago do cliente 50 contendo a variante -> id_produto
seed_purchase() {
  local sku="EVID-219-$TS" id
  id=$(psqlq "INSERT INTO product (titulo,preco_base,sku) VALUES ('Produto evidência 219',50,'$sku')
              RETURNING id_produto;" | head -1)
  psqlq "INSERT INTO product_variant (codigo_sku,preco_variante,id_produto) VALUES ('$sku',50,$id);" >/dev/null
  psqlq "WITH o AS (INSERT INTO orders (id_usuario,status,subtotal,valor_frete,valor_total,tipo_retirada)
                    VALUES ('$(cpf 50)','paid',50,0,50,'loja') RETURNING id_pedido)
         INSERT INTO order_item (id_pedido,id_variante,quantidade,preco_unitario)
         SELECT id_pedido,'$sku',1,50 FROM o;" >/dev/null
  printf '%s' "$id"
}
EVPG=ev219-pg
EVPORT=${EVPORT:-5435}

# Variáveis do .env.development sem `source` (valores com espaço/parênteses).
load_env() {
  local line
  while IFS= read -r line || [ -n "$line" ]; do
    [[ -z "$line" || "$line" == \#* || "$line" != *=* ]] && continue
    export "${line%%=*}=${line#*=}"
  done < "$ENVFILE"
  export POSTGRES_HOST=localhost POSTGRES_PORT=$EVPORT NODE_ENV=development
}
coluna() {
  docker exec "$EVPG" psql -U "$PGU" -d "$PGD" -Atc "SELECT coalesce((SELECT 'PRESENTE ' || data_type
    FROM information_schema.columns WHERE table_name = 'review' AND column_name = 'data_edicao'), 'AUSENTE')"
}
ultima() {
  docker exec "$EVPG" psql -U "$PGU" -d "$PGD" -Atc "SELECT name FROM migrations ORDER BY id DESC LIMIT 1"
}

echo "=================================================================="
echo " EVIDÊNCIA #219 — $LABEL   (TS=$TS)   código: $(git rev-parse --abbrev-ref HEAD)"
echo "=================================================================="
echo
echo "--- Parte A: migrations num Postgres limpo ($EVPG, porta $EVPORT)"
docker rm -f "$EVPG" >/dev/null 2>&1
docker run -d --name "$EVPG" --env-file "$ENVFILE" -p "$EVPORT:5432" postgres:16-alpine >/dev/null
until docker exec "$EVPG" pg_isready -q 2>/dev/null; do sleep 1; done; sleep 2
rm -rf dist && pnpm build >/dev/null 2>&1 || { echo "falha no build"; exit 1; }
(
  load_env
  node ./node_modules/typeorm/cli.js migration:run -d dist/database/data-source.js >/dev/null 2>&1
  A1="$(coluna) | ultima=$(ultima)"
  node ./node_modules/typeorm/cli.js migration:revert -d dist/database/data-source.js >/dev/null 2>&1
  A2="$(coluna) | ultima=$(ultima)"
  node ./node_modules/typeorm/cli.js migration:run -d dist/database/data-source.js >/dev/null 2>&1
  A3="$(coluna) | ultima=$(ultima)"
  printf '%-3s | %-22s | %-10s | %-10s | %s\n' "#" "etapa" "ANTES" "DEPOIS" "obtido[$LABEL]"
  echo "----+------------------------+------------+------------+--------"
  printf '%-3s | %-22s | %-10s | %-10s | %s\n' A1 "migration:run" AUSENTE PRESENTE "$A1"
  printf '%-3s | %-22s | %-10s | %-10s | %s\n' A2 "migration:revert" AUSENTE AUSENTE "$A2"
  printf '%-3s | %-22s | %-10s | %-10s | %s\n' A3 "migration:run de novo" AUSENTE PRESENTE "$A3"
)
docker rm -f "$EVPG" >/dev/null 2>&1

echo
echo "--- Parte B: API dev ($API)"
reg_cliente 50; TOKEN=$(login "$(mail 50)")
PROD=$(seed_purchase)
r=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/reviews" -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" -d "{\"idProduto\":$PROD,\"nota\":5,\"comentario\":\"Nunca editada\"}")
echo "cliente=$(cpf 50)  produto=$PROD  POST avaliacao=$r (esperado 201)  token=${TOKEN:0:12}..."
B1=$(curl -s "$API/reviews/product/$PROD" | jq -c '.data[0] | if has("dataEdicao") then {dataEdicao} else "campo ausente" end')
B2=$(curl -s "$API/reviews/product/$PROD/mine" -H "Authorization: Bearer $TOKEN" \
  | jq -c '.avaliacao | if has("dataEdicao") then {dataEdicao} else "campo ausente" end')
printf '%-3s | %-22s | %-14s | %-18s | %s\n' "#" "resposta" "ANTES" "DEPOIS" "obtido[$LABEL]"
echo "----+------------------------+----------------+--------------------+--------"
printf '%-3s | %-22s | %-14s | %-18s | %s\n' B1 "listagem publica" "campo ausente" '{"dataEdicao":null}' "$B1"
printf '%-3s | %-22s | %-14s | %-18s | %s\n' B2 "GET mine" "campo ausente" '{"dataEdicao":null}' "$B2"
