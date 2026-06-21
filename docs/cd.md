# CI/CD - GitHub Actions, GHCR e Render

## Fluxo de entrega

1. Pull requests e pushes para `dev`/`main` executam o CI.
2. O CI valida lint, tipos, formato, build, testes, cobertura, migrações e a
   construção da imagem Docker.
3. Somente um CI bem-sucedido originado por `push` na `main` libera o CD.
4. O CD reconstrói o commit validado e publica a imagem `linux/amd64` no GHCR com
   as tags `latest` e `sha-<commit>`.
5. O CD envia ao Render o digest imutável produzido pelo build, não a tag
   mutável `latest`.
6. O workflow consulta a API do Render até o deploy ficar `live` e, em seguida,
   executa um smoke test em `GET /api/health/ready`.

O job de deploy usa o environment `production` do GitHub. É possível configurar
nesse environment revisores obrigatórios e limitar quais branches podem fazer
deploy.

## Configuração inicial do GHCR

O pacote pode ser público ou privado. Para um pacote privado, crie um Personal
Access Token (classic) no GitHub com permissão `read:packages`. No Render, abra
as configurações do workspace, adicione uma credencial de Container Registry e
use exatamente o nome `github-container-registry`, conforme o `render.yaml`.

Use como registry `ghcr.io`, seu usuário GitHub e o token criado. O workflow não
precisa desse token: ele publica com o `GITHUB_TOKEN` efêmero do próprio job.

## Criação do serviço no Render

O `render.yaml` define um serviço image-backed. Como o Render não permite alterar
o `runtime` de um serviço existente, um serviço antigo criado como Git-backed
(`runtime: docker`) precisa ser substituído:

1. Garanta que a imagem `ghcr.io/tppe-2026-1-marketplace/marketplace-backend:latest`
   já foi publicada ao menos uma vez.
2. Cadastre a credencial `github-container-registry` no workspace do Render.
3. Crie um novo Blueprint a partir deste repositório e confirme o `render.yaml`.
4. Informe `DATABASE_URL` e `LOJA_CEP_ORIGEM`. O Render gera `JWT_SECRET`.
5. Adicione as credenciais opcionais de InfinitePay, ImgBB e Melhor Envio apenas
   quando essas integrações forem habilitadas.
6. Depois de validar o novo serviço, remova o serviço Git-backed anterior ou
   troque os nomes durante a migração para evitar conflito.

O Render injeta `PORT`; não configure uma porta fixa. O serviço image-backed não
faz auto-deploy ao mudar `latest`: o deploy é controlado exclusivamente pelo CD,
que informa o digest exato à API.

## GitHub Environment e segredos

Crie o environment `production` em **Settings > Environments**. Configure nele:

| Tipo     | Nome                 | Valor                                                          |
| -------- | -------------------- | -------------------------------------------------------------- |
| Secret   | `RENDER_API_KEY`     | API key criada no Render                                       |
| Secret   | `RENDER_SERVICE_ID`  | ID `srv-...` do serviço                                        |
| Variable | `RENDER_SERVICE_URL` | URL pública, por exemplo `https://dk-fashion-api.onrender.com` |

Recomenda-se habilitar proteção da branch `main`, exigir todos os jobs do CI e,
se disponível no plano do GitHub, exigir aprovação no environment `production`.

## Migrações

```bash
# Com as variáveis de banco exportadas no ambiente
pnpm migration:run
pnpm migration:revert

# Criar uma migração vazia
pnpm migration:create src/database/migrations/NomeDaMudanca

# Gerar diff das entities contra um banco de desenvolvimento
pnpm migration:generate src/database/migrations/NomeDaMudanca
```

Em produção, `dockerCommand` executa `pnpm migration:run:prod` antes de iniciar a
API. O plano gratuito não oferece `preDeployCommand`, portanto as migrações devem
ser compatíveis com a versão anterior da aplicação.

Em plano pago, prefira mover `pnpm migration:run:prod` para `preDeployCommand` e
deixar `dockerCommand` apenas com `exec node dist/main.js`.

### Banco existente

A migração baseline pressupõe banco vazio. Se o Neon já contém tabelas criadas
por `synchronize`, faça backup e compare o schema antes do primeiro deploy. Não
rode a baseline sobre tabelas existentes sem confirmar equivalência.

## Falhas e rollback

Se o pull da imagem, a migração, o boot ou o health check falhar, o Render não
promove a nova instância e mantém a última versão saudável. O job do GitHub também
falha e registra o ID do deploy, o commit e o digest usados.

Rollback da aplicação pode ser feito no Dashboard do Render. Ele não reverte o
banco automaticamente; por isso migrações destrutivas devem ser divididas em
etapas compatíveis e revertidas deliberadamente.

## Execução local da imagem de produção

`compose.prod.yml` aceita `DATABASE_URL` ou as variáveis `POSTGRES_*`.

```bash
docker compose --env-file .env.production -f compose.prod.yml config --quiet
make prod-build
make prod-up
```

Nunca salve `.env.production`, tokens do GHCR ou chaves do Render no Git.
