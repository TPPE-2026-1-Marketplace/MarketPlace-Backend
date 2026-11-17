#!/bin/sh
# Compara as chaves de cada .env.<ambiente> com as do .env.<ambiente>.example.
# Mostra só NOMES de variáveis, nunca valores. Uso: sh scripts/env-check.sh
#
# - "faltando": chave ativa no .example que não existe no arquivo real.
# - "a mais":   chave do arquivo real que o .example não conhece (nem comentada).
set -eu

keys() { grep -oE '^[A-Za-z_][A-Za-z0-9_]*=' "$1" | tr -d '=' | sort -u; }
known_keys() { grep -oE '^#? *[A-Za-z_][A-Za-z0-9_]*=' "$1" | tr -d '#= ' | sort -u; }

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

for env in development production; do
  real=".env.$env"
  example=".env.$env.example"
  [ -f "$example" ] || continue

  if [ ! -f "$real" ]; then
    echo "[$real] não existe (rode make env-setup)"
    continue
  fi

  keys "$example" > "$tmp/example"
  known_keys "$example" > "$tmp/known"
  keys "$real" > "$tmp/real"

  missing=$(grep -vxF -f "$tmp/real" "$tmp/example" || true)
  extra=$(grep -vxF -f "$tmp/known" "$tmp/real" || true)

  if [ -z "$missing" ] && [ -z "$extra" ]; then
    echo "[$real] ok"
    continue
  fi

  echo "[$real]"
  if [ -n "$missing" ]; then echo "$missing" | sed 's/^/  faltando: /'; fi
  if [ -n "$extra" ]; then echo "$extra" | sed 's/^/  a mais:   /'; fi
done
