#!/usr/bin/env bash
# Evidência simétrica da #156 (rate limiting). Versão independente de branch.
# Uso:  bash evidencia-156.sh ANTES   (código sem throttler)
#       bash evidencia-156.sh DEPOIS  (código com throttler)
# Limite login/cadastro: 5 por 15 min POR IP. Rode cada lado uma vez.
# O store do throttler é em memória e zera quando o start:dev recompila
# (ex.: ao trocar de branch), então o DEPOIS começa com a contagem limpa.

API=${API:-http://localhost:3001/api}
LABEL=${1:-SEM-ROTULO}
TS=$(date +%s)
BASE=${TS: -9}
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

echo "=================================================================="
echo " EVIDÊNCIA #156 — $LABEL   (TS=$TS)"
echo "=================================================================="
echo "esperado  ANTES: sem 429  |  DEPOIS: 429 a partir da 6ª"
echo

echo "== POST /auth/login (7 tentativas, credenciais inválidas)"
for i in $(seq 1 7); do
  printf '  tentativa %d -> ' "$i"
  code -X POST "$API/auth/login" -H 'Content-Type: application/json' \
    -d '{"email":"naoexiste@teste.local","senha":"errada"}'
  echo
done

echo "== POST /people/register-user (7 cadastros distintos, CPF 11 dígitos)"
for i in $(seq 1 7); do
  CPF=$(printf '%02d%s' "$i" "$BASE")
  printf '  cadastro %d -> ' "$i"
  code -X POST "$API/people/register-user" -H 'Content-Type: application/json' \
    -d "{\"email\":\"r$i.$TS@teste.local\",\"senha\":\"Senha@1234\",\"cpf\":\"$CPF\",\"nome\":\"Reg $i\"}"
  echo
done

echo "== GET /health (3 vezes — deve ser imune ao throttler)"
for i in $(seq 1 3); do
  printf '  health %d -> ' "$i"
  code "$API/health"
  echo
done
echo
echo "ANTES: login 7x401 e cadastro 7x201; DEPOIS: 5 liberadas e 429 a partir da 6ª; health sempre 200."
