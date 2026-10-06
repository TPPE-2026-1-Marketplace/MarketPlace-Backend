#!/usr/bin/env bash
# Lote de evidência simétrica da #197 (exclusão de cliente com pedidos → anonimização).
#
# Pré-requisitos: API dev no ar (`make dev-up`) e `jq` instalado.
# Uso:
#   bash scripts/evidencia-197.sh ANTES    # com o hard delete rodando
#   bash scripts/evidencia-197.sh DEPOIS   # após aplicar a correção (start:dev recompila)
#
# Cada execução cria seus próprios titulares e pedidos (sufixo por timestamp),
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

cpf()  { printf '%02d%s' "$1" "$BASE"; }
mail() { printf 'l%02d.%s@teste.local' "$1" "$TS"; }
psqlq() { docker exec -i "$PGC" psql -U "$PGU" -d "$PGD" -Atc "$1" 2>/dev/null; }
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

reg_cliente() {
  curl -s -o /dev/null -X POST "$API/people/register-user" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$(mail "$1")\",\"senha\":\"$SENHA\",\"cpf\":\"$(cpf "$1")\",\"nome\":\"Titular $1\",\"telefone\":\"61999990000\"}"
}
login() {
  curl -s -X POST "$API/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"senha\":\"$SENHA\"}" | jq -r .access_token
}
seed_order() { # n status -> id_pedido
  psqlq "INSERT INTO orders (id_usuario,status,subtotal,valor_frete,valor_total,tipo_retirada,
           cliente_telefone,endereco_cep,endereco_rua,endereco_numero,endereco_bairro,endereco_cidade,endereco_estado)
         VALUES ('$(cpf "$1")','$2',100,20,120,'entrega',
           '61999990000','70000-000','Rua Pessoal $1','42','Asa Norte','Brasília','DF')
         RETURNING id_pedido;" | head -1
}
delete_self() { code -X DELETE "$API/people/$(cpf "$1")" -H "Authorization: Bearer $2"; }

echo "=================================================================="
echo " EVIDÊNCIA #197 — $LABEL   (TS=$TS)"
echo "=================================================================="

reg_cliente 40; TOKEN_SEM=$(login "$(mail 40)")
reg_cliente 41; TOKEN_ENT=$(login "$(mail 41)")
reg_cliente 42; TOKEN_PAG=$(login "$(mail 42)")
PED_ENT=$(seed_order 41 delivered)
PED_PAG=$(seed_order 42 paid)

echo "titulares: sem_pedido=$(cpf 40) entregue=$(cpf 41) (pedido $PED_ENT) pago=$(cpf 42) (pedido $PED_PAG)"
echo "token=${TOKEN_ENT:0:12}...  (vazio = falha no setup)"
echo

row() { printf '%-3s | %-40s | %-10s | %-10s | %s\n' "$1" "$2" "$3" "$4" "$5"; }
row "#" "cenario" "ANTES" "DEPOIS" "obtido[$LABEL]"
echo "----+------------------------------------------+------------+------------+--------"

r=$(delete_self 40 "$TOKEN_SEM")
row 1 "DELETE proprio, sem pedidos (controle)" 204 204 "$r"
r=$(delete_self 41 "$TOKEN_ENT")
row 2 "DELETE proprio, pedido entregue" 500 204 "$r"
r=$(delete_self 42 "$TOKEN_PAG")
row 3 "DELETE proprio, pedido pago" 500 409 "$r"

r=$(psqlq "SELECT count(*) FROM person WHERE cpf='$(cpf 41)';")
row 4 "titular (2) ainda existe em person" 1 0 "$r"
r=$(psqlq "SELECT count(*) FROM orders WHERE id_pedido=$PED_ENT;")
row 5 "pedido (2) preservado" 1 1 "$r"
r=$(psqlq "SELECT valor_total FROM orders WHERE id_pedido=$PED_ENT;")
row 6 "pedido (2) valor_total" 120.00 120.00 "$r"
r=$(psqlq "SELECT coalesce(cliente_telefone,'null')||'/'||coalesce(endereco_rua,'null') FROM orders WHERE id_pedido=$PED_ENT;")
row 7 "pedido (2) telefone/rua" "preenchido" "null/null" "$r"
r=$(psqlq "SELECT endereco_cidade||'/'||endereco_estado FROM orders WHERE id_pedido=$PED_ENT;")
row 8 "pedido (2) cidade/UF (nao pessoal)" "Brasília/DF" "Brasília/DF" "$r"
r=$(psqlq "SELECT p.nome FROM orders o JOIN person p ON p.cpf=o.id_usuario WHERE o.id_pedido=$PED_ENT;")
row 9 "pedido (2) vinculado a" "Titular 41" "Cliente removido" "$r"
r=$(code -X POST "$API/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$(mail 41)\",\"senha\":\"$SENHA\"}")
row 10 "login do titular (2) apos exclusao" 200 401 "$r"
r=$(psqlq "SELECT count(*) FROM person WHERE cpf='$(cpf 42)';")
row 11 "titular (3) mantido apos a recusa" 1 1 "$r"
r=$(psqlq "SELECT endereco_rua FROM orders WHERE id_pedido=$PED_PAG;")
row 12 "pedido (3) intacto" "Rua Pessoal 42" "Rua Pessoal 42" "$r"

echo "----+------------------------------------------+------------+------------+--------"
