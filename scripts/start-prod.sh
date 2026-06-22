#!/bin/sh
# Entrypoint de produção: aplica migrations pendentes e sobe a API.
# `exec` substitui o shell pelo processo do node, deixando-o como PID 1 para
# receber SIGTERM diretamente (shutdown gracioso do NestJS).
set -e

node ./node_modules/typeorm/cli.js migration:run -d dist/database/data-source.js

exec node dist/main.js
