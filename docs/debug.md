# Modo debug da API

O modo debug é o ambiente de desenvolvimento normal (mesmo volume, mesmo Postgres,
mesmo hot reload) com o **inspector do Node** ligado. Ele permite pôr breakpoints
no editor e inspecionar variáveis enquanto a API atende requisições.

## Como subir

```bash
make dev-up DEBUG=1        # sobe (ou recria) a API com o inspector
make dev-restart DEBUG=1   # down + up já em modo debug
make dev-rebuild DEBUG=1   # rebuild da imagem + up em modo debug
make dev-up                # volta ao modo normal (recria a API sem o inspector)
```

Por baixo, `DEBUG=1` soma o `compose.debug.yml` ao `compose.dev.yml`. O override
troca o comando da API para `pnpm start:debug`
(`nest start --debug 0.0.0.0:9229 --watch`) e publica a porta `9229` **só em
`127.0.0.1`**.

O inspector precisa escutar em `0.0.0.0` dentro do container; senão o host não
consegue se conectar. A restrição de acesso fica no mapeamento da porta.

Para conferir se o inspector está no ar:

```bash
curl -s http://127.0.0.1:9229/json/list
```

## VS Code

Crie (ou complete) o `.vscode/launch.json` do backend com uma configuração de
*attach*:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Attach: API (Docker)",
      "type": "node",
      "request": "attach",
      "address": "localhost",
      "port": 9229,
      "localRoot": "${workspaceFolder}",
      "remoteRoot": "/app",
      "restart": true,
      "sourceMaps": true,
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

- `localRoot`/`remoteRoot` mapeiam o código do host para o caminho dentro do
  container (`/app`). Se o workspace aberto for a raiz do monorepo, use
  `${workspaceFolder}/backend`.
- `restart: true` faz o editor reconectar sozinho: a cada arquivo salvo, o
  `--watch` reinicia o processo, e o inspector reinicia junto.
- Os breakpoints funcionam direto nos `.ts`, porque o `tsconfig.json` gera source maps.

Outros clientes funcionam do mesmo jeito: o Chrome em `chrome://inspect` e os
IDEs JetBrains com "Attach to Node.js/Chrome", porta 9229.

## Cuidados

- **Nunca exponha o inspector em produção.** Quem acessa a porta 9229 consegue
  executar código arbitrário no processo da API. Por isso o modo debug existe só
  no ambiente de desenvolvimento, e a porta fica restrita ao loopback.
- Com um breakpoint parado, a API não responde. Healthchecks e o frontend vão
  dar timeout até você continuar a execução.
