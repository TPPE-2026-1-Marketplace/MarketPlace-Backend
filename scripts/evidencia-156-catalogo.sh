#!/usr/bin/env bash
# Evidência da revisão da #156: o guard global derrubava o catálogo.
# Reproduz o padrão do fetchProducts do frontend (src/lib/catalog.ts):
# 1 GET /products + GET /inventory/:sku e GET /images/catalog/:sku por variante,
# tudo do mesmo IP. SKUs fictícios: o 404 não importa, o throttler conta a requisição.
# Uso:  bash scripts/evidencia-156-catalogo.sh ANTES   (guard global)
#       bash scripts/evidencia-156-catalogo.sh DEPOIS  (guard só nas rotas manuais)
# O store do throttler é em memória e zera quando o start:dev recompila.

API=${API:-http://localhost:3001/api}
LABEL=${1:-SEM-ROTULO}
PRODUTOS=${PRODUTOS:-100}
VARIANTES=${VARIANTES:-3}
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

echo "=================================================================="
echo " EVIDÊNCIA #156 (catálogo) — $LABEL   ($PRODUTOS produtos x $VARIANTES variantes)"
echo "=================================================================="
echo "esperado  ANTES: 429 a partir da 61ª variante  |  DEPOIS: nenhum 429"
echo

declare -A tally
n=1
first429=""
c=$(code "$API/products?page=1&limit=$PRODUTOS")
tally[$c]=1
for p in $(seq 1 "$PRODUTOS"); do
  for v in $(seq 1 "$VARIANTES"); do
    for path in inventory images/catalog; do
      n=$((n + 1))
      c=$(code "$API/$path/EVID156-$p-$v")
      tally[$c]=$((${tally[$c]:-0} + 1))
      [ "$c" = "429" ] && [ -z "$first429" ] && first429=$n
    done
  done
done

echo "requisições disparadas: $n"
for k in $(printf '%s\n' "${!tally[@]}" | sort); do
  printf '  HTTP %s: %s\n' "$k" "${tally[$k]}"
done
echo "  primeiro 429 na requisição nº ${first429:-nenhum}"
