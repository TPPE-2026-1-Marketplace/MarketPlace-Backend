#!/usr/bin/env bash
# Lote de evidência simétrica da #220 (PATCH /api/reviews/product/:productId).
#
# Pré-requisitos: API dev no ar (`make dev-up`) e `jq` instalado.
# Uso:
#   bash scripts/evidencia-220.sh ANTES    # código da #219, sem a rota
#   bash scripts/evidencia-220.sh DEPOIS   # com a rota (start:dev recompila)
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
mail() { printf 'p%02d.%s@teste.local' "$1" "$TS"; }
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
  local sku="EVID-220-$TS" id
  id=$(psqlq "INSERT INTO product (titulo,preco_base,sku) VALUES ('Produto evidência 220',50,'$sku')
              RETURNING id_produto;" | head -1)
  psqlq "INSERT INTO product_variant (codigo_sku,preco_variante,id_produto) VALUES ('$sku',50,$id);" >/dev/null
  psqlq "WITH o AS (INSERT INTO orders (id_usuario,status,subtotal,valor_frete,valor_total,tipo_retirada)
                    VALUES ('$(cpf 50)','paid',50,0,50,'loja') RETURNING id_pedido)
         INSERT INTO order_item (id_pedido,id_variante,quantidade,preco_unitario)
         SELECT id_pedido,'$sku',1,50 FROM o;" >/dev/null
  printf '%s' "$id"
}
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
stats() { curl -s "$API/reviews/product/$1" | jq -r '"total=\(.totalAvaliacoes) media=\(.media)"'; }
patch() { # produto token corpo -> status
  code -X PATCH "$API/reviews/product/$1" -H 'Content-Type: application/json' ${2:+-H "Authorization: Bearer $2"} -d "$3"
}
mine_edicao() {
  curl -s "$API/reviews/product/$1/mine" -H "Authorization: Bearer $2" \
    | jq -r '.avaliacao | "nota=\(.nota) comentario=\(.comentario) dataEdicao=\(.dataEdicao // "null")"'
}

echo "=================================================================="
echo " EVIDÊNCIA #220 — $LABEL   (TS=$TS)"
echo "=================================================================="

reg_cliente 50; TOKEN=$(login "$(mail 50)")
reg_cliente 51; TOKEN_OUTRO=$(login "$(mail 51)")
PROD=$(seed_purchase)
r=$(code -X POST "$API/reviews" -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d "{\"idProduto\":$PROD,\"nota\":2,\"comentario\":\"Original\"}")

echo "autor=$(cpf 50)  outro cliente=$(cpf 51)  produto=$PROD  POST avaliacao=$r (esperado 201)"
echo "token=${TOKEN:0:12}...  (vazio = falha no setup)"
echo "antes de editar: $(stats "$PROD") | $(mine_edicao "$PROD" "$TOKEN")"
echo

row() { printf '%-3s | %-34s | %-16s | %-16s | %s\n' "$1" "$2" "$3" "$4" "$5"; }
row "#" "cenario" "ANTES" "DEPOIS" "obtido[$LABEL]"
echo "----+------------------------------------+------------------+------------------+--------"

row 1 "PATCH sem token" 404 401 "$(patch "$PROD" "" '{"nota":5}')"
row 2 "PATCH corpo vazio" 404 400 "$(patch "$PROD" "$TOKEN" '{}')"
row 3 "PATCH nota 6 (invalida)" 404 400 "$(patch "$PROD" "$TOKEN" '{"nota":6}')"
row 4 "PATCH de quem nao avaliou" 404 404 "$(patch "$PROD" "$TOKEN_OUTRO" '{"nota":5}')"
row 5 "PATCH do autor (nota 5 + tags)" 404 200 "$(patch "$PROD" "$TOKEN" '{"nota":5,"comentario":"<b>Editado</b>"}')"
row 6 "estatisticas apos o PATCH" "total=1 media=2" "total=1 media=5" "$(stats "$PROD")"
echo
echo "avaliacao do autor apos o PATCH (esperado DEPOIS: nota=5 comentario=Editado dataEdicao=<data>):"
echo "  $(mine_edicao "$PROD" "$TOKEN")"
