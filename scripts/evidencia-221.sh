#!/usr/bin/env bash
# Demonstração do épico #216 (#221): fluxo criar → editar → remover pela API,
# conferindo média e total do produto a cada passo, e as rotas de avaliação no Swagger.
#
# Pré-requisitos: API dev no ar com o código do épico (`make dev-up`) e `jq` instalado.
# Uso:
#   bash scripts/evidencia-221.sh FLUXO
#
# Cada execução cria seus próprios clientes, produto e pedidos (sufixo por timestamp).

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
mail() { printf 'f%02d.%s@teste.local' "$1" "$TS"; }
psqlq() { docker exec -i "$PGC" psql -U "$PGU" -d "$PGD" -Atc "$1" 2>/dev/null; }

reg_cliente() {
  curl -s -o /dev/null -X POST "$API/people/register-user" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$(mail "$1")\",\"senha\":\"$SENHA\",\"cpf\":\"$(cpf "$1")\",\"nome\":\"Avaliador $1\",\"telefone\":\"61999990000\"}"
}
login() {
  curl -s -X POST "$API/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"senha\":\"$SENHA\"}" | jq -r .access_token
}
# Produto + variante + pedido pago dos clientes 50 e 51 contendo a variante -> id_produto
seed_purchase() {
  local sku="EVID-221-$TS" id
  id=$(psqlq "INSERT INTO product (titulo,preco_base,sku) VALUES ('Produto evidência 221',50,'$sku')
              RETURNING id_produto;" | head -1)
  psqlq "INSERT INTO product_variant (codigo_sku,preco_variante,id_produto) VALUES ('$sku',50,$id);" >/dev/null
  for n in 50 51; do
    psqlq "WITH o AS (INSERT INTO orders (id_usuario,status,subtotal,valor_frete,valor_total,tipo_retirada)
                      VALUES ('$(cpf "$n")','paid',50,0,50,'loja') RETURNING id_pedido)
           INSERT INTO order_item (id_pedido,id_variante,quantidade,preco_unitario)
           SELECT id_pedido,'$sku',1,50 FROM o;" >/dev/null
  done
  printf '%s' "$id"
}
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
stats() { curl -s "$API/reviews/product/$PROD" | jq -r '"media=\(.media) total=\(.totalAvaliacoes)"'; }
motivo() { curl -s "$API/reviews/product/$PROD/mine" -H "Authorization: Bearer $1" | jq -r .motivo; }
send() { # metodo token caminho [corpo]
  code -X "$1" "$API/reviews$3" -H 'Content-Type: application/json' -H "Authorization: Bearer $2" ${4:+-d "$4"}
}

echo "=================================================================="
echo " EVIDÊNCIA #221 — $LABEL   (TS=$TS)"
echo "=================================================================="

reg_cliente 50; TOKEN_A=$(login "$(mail 50)")
reg_cliente 51; TOKEN_B=$(login "$(mail 51)")
PROD=$(seed_purchase)
echo "cliente A=$(cpf 50)  cliente B=$(cpf 51)  produto=$PROD"
echo "tokens=${TOKEN_A:0:12}... ${TOKEN_B:0:12}...  (vazio = falha no setup)"
echo

row() { printf '%-3s | %-30s | %-6s | %-20s | %-20s | %s\n' "$1" "$2" "$3" "$4" "$5" "$6"; }
row "#" "passo" "HTTP" "esperado" "obtido" "mine(A)"
echo "----+--------------------------------+--------+----------------------+----------------------+--------"
row 0 "estado inicial" "-" "media=0 total=0" "$(stats)" "$(motivo "$TOKEN_A")"
r=$(send POST "$TOKEN_A" "" "{\"idProduto\":$PROD,\"nota\":2}")
row 1 "A cria nota 2" "$r" "media=2 total=1" "$(stats)" "$(motivo "$TOKEN_A")"
r=$(send POST "$TOKEN_B" "" "{\"idProduto\":$PROD,\"nota\":4}")
row 2 "B cria nota 4" "$r" "media=3 total=2" "$(stats)" "$(motivo "$TOKEN_A")"
r=$(send PATCH "$TOKEN_A" "/product/$PROD" '{"nota":5}')
row 3 "A edita para nota 5" "$r" "media=4.5 total=2" "$(stats)" "$(motivo "$TOKEN_A")"
r=$(send DELETE "$TOKEN_A" "/product/$PROD")
row 4 "A remove a propria" "$r" "media=4 total=1" "$(stats)" "$(motivo "$TOKEN_A")"
r=$(send DELETE "$TOKEN_B" "/product/$PROD")
row 5 "B remove a propria" "$r" "media=0 total=0" "$(stats)" "$(motivo "$TOKEN_A")"

echo
echo "Rotas de avaliação no Swagger (${API%/api}/docs-json):"
curl -s "${API%/api}/docs-json" | jq -r '.paths | to_entries[] | select(.key | test("reviews")) | .key as $p
  | .value | to_entries[] | "  \(.key | ascii_upcase) \($p)  respostas=\(.value.responses | keys | join(","))"'
