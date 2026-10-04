#!/usr/bin/env bash
# Lote de evidência simétrica da #154 (IDOR em /api/people/:cpf).
#
# Pré-requisitos: API dev no ar (`make dev-up`) e `jq` instalado.
# Uso:
#   bash scripts/evidencia-154.sh ANTES    # com o código vulnerável rodando
#   bash scripts/evidencia-154.sh DEPOIS   # após aplicar a correção (start:dev recompila)
#
# Cada execução cria seus próprios atores (sufixo por timestamp), então ANTES e
# DEPOIS são independentes e não precisam de reset do banco entre eles.

API=${API:-http://localhost:3001/api}
ENVFILE=${ENVFILE:-.env.development}
PGC=${PGC:-marketplace-backend-postgres-1}
PGU=$(grep '^POSTGRES_USER=' "$ENVFILE" | cut -d= -f2)
PGD=$(grep '^POSTGRES_DB=' "$ENVFILE" | cut -d= -f2)

LABEL=${1:-SEM-ROTULO}
TS=$(date +%s)
BASE=${TS: -9}
SENHA='Senha@1234'
NOVA='Hacked@9999'

cpf()  { printf '%02d%s' "$1" "$BASE"; }
mail() { printf 'v%02d.%s@teste.local' "$1" "$TS"; }
psqlc() { docker exec -i "$PGC" psql -U "$PGU" -d "$PGD" -Atc "$1" >/dev/null 2>&1; }
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

reg_cliente() {
  curl -s -o /dev/null -X POST "$API/people/register-user" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$(mail "$1")\",\"senha\":\"$SENHA\",\"cpf\":\"$(cpf "$1")\",\"nome\":\"User $1\"}"
}
login() {
  curl -s -X POST "$API/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"senha\":\"$SENHA\"}" | jq -r .access_token
}
promote() {
  psqlc "INSERT INTO employee (cpf,ativo,role_perfil,taxa_comissao,codigo_funcionario)
         VALUES ('$(cpf "$1")',true,'$2',0.03,'E$1${TS: -4}') ON CONFLICT (cpf) DO NOTHING;"
}
seed_person() {
  psqlc "INSERT INTO person (cpf,nome,email,senha) VALUES
         ('$(cpf "$1")','Vitima $1','$(mail "$1")','x') ON CONFLICT (cpf) DO NOTHING;"
}
seed_employee() { seed_person "$1"; promote "$1" "$2"; }

echo "=================================================================="
echo " EVIDÊNCIA #154 — $LABEL   (TS=$TS)"
echo "=================================================================="

reg_cliente 10;                     TOKEN_A=$(login "$(mail 10)")
reg_cliente 11; promote 11 caixa;   TOKEN_CX=$(login "$(mail 11)")
reg_cliente 12; promote 12 gerente; TOKEN_GE=$(login "$(mail 12)")

seed_person 20; seed_person 21; seed_person 22; seed_person 23; seed_person 24; seed_person 25
seed_employee 30 gerente
seed_employee 31 vendedor

echo "atacantes: A=$(cpf 10) caixa=$(cpf 11) gerente=$(cpf 12)"
echo "token_A=${TOKEN_A:0:12}...  (vazio = falha no setup)"
echo

row() { printf '%-3s | %-34s | %-8s | %-8s | %s\n' "$1" "$2" "$3" "$4" "$5"; }
row "#" "cenario" "ANTES" "DEPOIS" "obtido[$LABEL]"
echo "----+------------------------------------+----------+----------+--------"

r=$(code "$API/people/$(cpf 20)" -H "Authorization: Bearer $TOKEN_A")
row 1 "A(cliente) GET alheio" 200 403 "$r"
r=$(code -X PATCH "$API/people/$(cpf 21)" -H "Authorization: Bearer $TOKEN_A" -H 'Content-Type: application/json' -d '{"nome":"EDIT"}')
row 2 "A(cliente) PATCH alheio" 200 403 "$r"
r=$(code -X DELETE "$API/people/$(cpf 22)" -H "Authorization: Bearer $TOKEN_A")
row 3 "A(cliente) DELETE alheio" 204 403 "$r"
r=$(code -X PATCH "$API/people/$(cpf 23)" -H "Authorization: Bearer $TOKEN_CX" -H 'Content-Type: application/json' -d '{"nome":"EDIT"}')
row 4 "caixa PATCH alheio" 200 403 "$r"
r=$(code -X PATCH "$API/people/$(cpf 30)" -H "Authorization: Bearer $TOKEN_A" -H 'Content-Type: application/json' -d "{\"senha\":\"$NOVA\"}")
row 5a "A(cliente) PATCH senha de gerente" 200 403 "$r"
r=$(code -X POST "$API/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$(mail 30)\",\"senha\":\"$NOVA\"}")
row 5b "login como gerente c/ senha nova" 200 401 "$r"
r=$(code -X DELETE "$API/people/$(cpf 31)" -H "Authorization: Bearer $TOKEN_A")
row 6 "A(cliente) DELETE funcionario" 204 403 "$r"
r=$(code -X PATCH "$API/people/$(cpf 24)" -H "Authorization: Bearer $TOKEN_GE" -H 'Content-Type: application/json' -d '{"nome":"CORRIGIDO"}')
row 7 "gerente PATCH nome alheio (OK)" 200 200 "$r"
r=$(code -X PATCH "$API/people/$(cpf 25)" -H "Authorization: Bearer $TOKEN_GE" -H 'Content-Type: application/json' -d "{\"senha\":\"$NOVA\"}")
row 8 "gerente PATCH senha alheio" 200 403 "$r"
r=$(code "$API/people/$(cpf 10)" -H "Authorization: Bearer $TOKEN_A")
row 9 "A(cliente) GET proprio (controle)" 200 200 "$r"

echo "----+------------------------------------+----------+----------+--------"
