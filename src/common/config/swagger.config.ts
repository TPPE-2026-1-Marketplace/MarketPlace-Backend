/**
 * Decide se o Swagger (`/docs`) deve ser exposto neste ambiente.
 *
 * Fora de produção fica sempre disponível — o dia a dia de dev não muda.
 * Em produção o mapa completo da API (endpoints, schemas de request/response,
 * regras de permissão) fica desligado por padrão; `SWAGGER_PUBLIC=true` religa
 * como decisão explícita e reversível do time, sem deploy de código novo.
 * Ver `docs/swagger.md`.
 *
 * Mora fora de `main.ts` de propósito: o bootstrap não roda em teste unitário
 * (`main.ts` está excluído do `collectCoverageFrom`), então a regra ficaria
 * sem cobertura se fosse inline lá.
 */
export function isSwaggerEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const isProduction = env.NODE_ENV === 'production';
  const swaggerPublic = env.SWAGGER_PUBLIC === 'true';

  return !isProduction || swaggerPublic;
}
