#!/usr/bin/env bash
# Lote de evidência simétrica da #217 (GET /api/reviews/product/:productId/mine).
#
# Pré-requisitos: API dev no ar (`make dev-up`) e `jq` instalado.
# Uso:
#   bash scripts/evidencia-217.sh ANTES    # em dev, sem a rota
#   bash scripts/evidencia-217.sh DEPOIS   # com a rota (start:dev recompila)
#
# Cada execução cria seus próprios clientes, produto e pedido (sufixo por timestamp),
# então ANTES e DEPOIS são independentes e não precisam de reset do banco.

API=${API:-http://localhost:3001/api}
ENVFILE=${ENVFILE:-.env.development}
PGC=${PGC:-marketplace-backend-postgres-1}
PGU=$(grep '^POSTGRES_USER=' "$ENVFILE" | cut -d= -f2)
PGD=$(grep '^POSTGRES_DB=' "$ENVFILE" | cut -d= -f2)

LABEL=${1:-SEM-ROTULO}
TS=$(date +%s)
BASE=${TS: -9}
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
mail() { printf 'r%02d.%s@teste.local' "$1" "$TS"; }
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
  local sku="EVID-217-$TS" id
  id=$(psqlq "INSERT INTO product (titulo,preco_base,sku) VALUES ('Produto evidência 217',50,'$sku')
              RETURNING id_produto;" | head -1)
  psqlq "INSERT INTO product_variant (codigo_sku,preco_variante,id_produto) VALUES ('$sku',50,$id);" >/dev/null
  psqlq "WITH o AS (INSERT INTO orders (id_usuario,status,subtotal,valor_frete,valor_total,tipo_retirada)
                    VALUES ('$(cpf 50)','paid',50,0,50,'loja') RETURNING id_pedido)
         INSERT INTO order_item (id_pedido,id_variante,quantidade,preco_unitario)
         SELECT id_pedido,'$sku',1,50 FROM o;" >/dev/null
  printf '%s' "$id"
}
# status HTTP + motivo (quando houver) de GET mine
mine() {
  local out
  out=$(curl -s -w '\n%{http_code}' "$API/reviews/product/$1/mine" ${2:+-H "Authorization: Bearer $2"})
  printf '%s %s' "$(tail -1 <<<"$out")" "$(head -n -1 <<<"$out" | jq -r '.motivo // empty' 2>/dev/null)"
}

echo "=================================================================="
echo " EVIDÊNCIA #217 — $LABEL   (TS=$TS)"
echo "=================================================================="

reg_cliente 50; TOKEN_COMPRA=$(login "$(mail 50)")
reg_cliente 51; TOKEN_SEM=$(login "$(mail 51)")
PROD=$(seed_purchase)

echo "cliente com compra=$(cpf 50)  sem compra=$(cpf 51)  produto=$PROD"
echo "token=${TOKEN_COMPRA:0:12}...  (vazio = falha no setup)"
echo

row() { printf '%-3s | %-36s | %-6s | %-26s | %s\n' "$1" "$2" "$3" "$4" "$5"; }
row "#" "cenario" "ANTES" "DEPOIS" "obtido[$LABEL]"
echo "----+--------------------------------------+--------+----------------------------+--------"

row 1 "GET mine sem token" 404 401 "$(mine "$PROD")"
row 2 "GET mine, comprou e nao avaliou" 404 "200 PODE_AVALIAR" "$(mine "$PROD" "$TOKEN_COMPRA")"
row 3 "GET mine, sem compra" 404 "200 SEM_COMPRA_VERIFICADA" "$(mine "$PROD" "$TOKEN_SEM")"
r=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/reviews" -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN_COMPRA" -d "{\"idProduto\":$PROD,\"nota\":4,\"comentario\":\"Gostei\"}")
row 4 "POST avaliacao (controle)" 201 201 "$r"
row 5 "GET mine, depois de avaliar" 404 "200 JA_AVALIOU" "$(mine "$PROD" "$TOKEN_COMPRA")"
row 6 "GET mine, produto inexistente" 404 404 "$(mine 999999 "$TOKEN_COMPRA")"
echo
echo "Resposta completa de GET mine depois de avaliar:"
curl -s "$API/reviews/product/$PROD/mine" -H "Authorization: Bearer $TOKEN_COMPRA" | jq .
