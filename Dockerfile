# syntax=docker/dockerfile:1.7

# O uso do ARG faz com o que a imagem pode mudar dinamicamente conforme o uso
# isso é bom para fazer uma validação da melhor imagem
# Exemplo: docker build --build-arg NODE_VERSION=20-alpine .

ARG NODE_VERSION=22-alpine

FROM node:${NODE_VERSION} AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir=/pnpm/store

FROM deps AS dev

# CMD ["pnpm", "start:dev"]
CMD ["sh", "-c", "if [ ! -d node_modules ] || [ -z \"$(ls -A node_modules 2>/dev/null)\" ]; then pnpm install; fi && pnpm start:dev"]

FROM deps AS build

COPY . .
RUN pnpm build

FROM deps AS prod-deps
RUN pnpm prune --prod

FROM base AS runner

ENV NODE_ENV=production

RUN addgroup -S nodejs && adduser -S nestjs -G nodejs

COPY --from=prod-deps --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/dist ./dist
COPY --chown=nestjs:nodejs package.json ./

USER nestjs
EXPOSE 3000
CMD ["node", "dist/main.js"]
