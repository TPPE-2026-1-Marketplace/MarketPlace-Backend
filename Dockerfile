# syntax=docker/dockerfile:1.7

# O uso do ARG faz com que a imagem possa mudar dinamicamente conforme o uso
# isso é bom para fazer uma validação da melhor imagem
# Exemplo: docker build --build-arg NODE_VERSION=20-alpine .

ARG NODE_VERSION=22-alpine

FROM node:${NODE_VERSION} AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && apk add --no-cache git && git config --system --add safe.directory /app

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/app/.pnpm-store \
    pnpm install --frozen-lockfile --store-dir=/app/.pnpm-store

FROM deps AS dev

# Permite que o container rode como o usuario do host (compose define
# `user: "${UID:-1000}:${GID:-1000}"`). Ajusta o ownership de /app, que e a
# fonte de inicializacao do named volume api_node_modules, para o usuario
# `node` (uid 1000). Sem isso, o named volume nasce com dono root e o
# container nao consegue escrever em node_modules.
RUN chown -R node:node /app

USER node

CMD ["pnpm", "start:dev"]

FROM base AS prod-deps

COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/app/.pnpm-store \
    pnpm install --frozen-lockfile --prod --store-dir=/app/.pnpm-store

FROM base AS build

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM base AS runner

ENV NODE_ENV=production

RUN addgroup -S nodejs && adduser -S nestjs -G nodejs

COPY --from=prod-deps --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/dist ./dist
COPY --chown=nestjs:nodejs package.json ./

USER nestjs
EXPOSE 3000
CMD ["node", "dist/main.js"]
