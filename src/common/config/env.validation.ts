import { z } from 'zod';

/**
 * Schema das variáveis de ambiente. Validado no boot pelo ConfigModule
 * (`validate`), fazendo a aplicação falhar rápido com mensagem clara
 * quando uma variável obrigatória está ausente ou inválida.
 *
 * Obrigatórias: conexão com o Postgres e o segredo do JWT.
 * As integrações externas (Melhor Envio, InfinitePay, ImgBB) são opcionais —
 * possuem mocks/fallbacks e não devem impedir o boot em desenvolvimento.
 */
/**
 * Lista de origens CORS separadas por vírgula. O CORS compara a origem de forma
 * exata, então cada item precisa ser uma origem válida (`https://host[:porta]`,
 * sem caminho nem barra final) — caso contrário o navegador bloqueia o frontend
 * sem nenhum erro no boot.
 */
const CorsOriginsSchema = z.string().superRefine((value, ctx) => {
  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    ctx.addIssue({ code: 'custom', message: 'CORS_ORIGINS não pode ser vazio quando definido' });
    return;
  }

  for (const origin of origins) {
    let isValidOrigin = false;
    try {
      isValidOrigin = new URL(origin).origin === origin;
    } catch {
      // URL inválida: cai no addIssue abaixo
    }

    if (!isValidOrigin) {
      ctx.addIssue({
        code: 'custom',
        message: `CORS_ORIGINS contém origem inválida "${origin}" (use https://host[:porta], sem barra final)`,
      });
    }
  }
});

const JWT_SECRET_MIN_LENGTH = 32;

export const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).optional(),
    PORT: z.coerce.number().int().positive().optional(),

    // Liga o Swagger (`/docs`) quando NODE_ENV=production. Fora de produção o
    // Swagger fica sempre disponível; em produção fica desligado por padrão —
    // essa flag existe para religá-lo como decisão explícita do time (ex.:
    // período de portfólio). Ver docs/swagger.md.
    SWAGGER_PUBLIC: z.enum(['true', 'false']).optional(),

    DATABASE_URL: z.string().url('DATABASE_URL inválida').optional(),
    // Ativa verificação real de certificado TLS na conexão com o banco em
    // produção (default: desabilitada). Ver docs/database-tls.md (issue #171).
    DATABASE_SSL_VERIFY: z.enum(['true', 'false']).optional(),
    POSTGRES_HOST: z.string().min(1, 'POSTGRES_HOST é obrigatório').optional(),
    POSTGRES_PORT: z.coerce.number().int().positive().optional(),
    POSTGRES_USER: z.string().min(1, 'POSTGRES_USER é obrigatório').optional(),
    POSTGRES_PASSWORD: z.string().min(1, 'POSTGRES_PASSWORD é obrigatório').optional(),
    POSTGRES_DB: z.string().min(1, 'POSTGRES_DB é obrigatório').optional(),

    // Mínimo de 32 caracteres (256 bits, o tamanho da chave do HS256): segredos
    // curtos permitem forjar tokens por força bruta. `openssl rand -base64 32` gera 44.
    JWT_SECRET: z
      .string()
      .min(1, 'JWT_SECRET é obrigatório')
      .min(
        JWT_SECRET_MIN_LENGTH,
        `JWT_SECRET deve ter no mínimo ${JWT_SECRET_MIN_LENGTH} caracteres`,
      ),

    // Origens liberadas no CORS (lista separada por vírgula). Opcional: sem ela,
    // o main.ts usa os defaults (dev local + frontends conhecidos no Render).
    CORS_ORIGINS: CorsOriginsSchema.optional(),

    // Integrações externas — todas opcionais (têm mock/fallback). Listadas aqui
    // só para documentar tudo que a app lê num único lugar.
    LOJA_CEP_ORIGEM: z.string().optional(),

    // Pagamentos (InfinitePay)
    PAYMENT_GATEWAY_PROVIDER: z.enum(['mock', 'infinitepay']).optional(),
    INFINITEPAY_HANDLE: z.string().optional(),
    INFINITEPAY_REDIRECT_URL: z.string().optional(),
    // Segredo compartilhado para validar o webhook de pagamento.
    // Opcional em dev/test; obrigatório em produção (validado em PaymentsService).
    INFINITEPAY_WEBHOOK_SECRET: z.string().optional(),

    // Imagens (ImgBB)
    IMGBB_API_KEY: z.string().optional(),

    // Frete (Melhor Envio)
    MELHOR_ENVIO_BASE_URL: z.string().optional(),
    MELHOR_ENVIO_USER_AGENT: z.string().optional(),
    MELHOR_ENVIO_CLIENT_ID: z.string().optional(),
    MELHOR_ENVIO_CLIENT_SECRET: z.string().optional(),
    MELHOR_ENVIO_REFRESH_TOKEN: z.string().optional(),
    MELHOR_ENVIO_ACCESS_TOKEN: z.string().optional(),
    MELHOR_ENVIO_SERVICE_ID: z.coerce.number().int().positive().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.DATABASE_URL) {
      return;
    }

    const requiredPostgresVars = [
      'POSTGRES_HOST',
      'POSTGRES_USER',
      'POSTGRES_PASSWORD',
      'POSTGRES_DB',
    ] as const;

    for (const key of requiredPostgresVars) {
      if (!env[key]) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `${key} é obrigatório quando DATABASE_URL não está definido`,
        });
      }
    }
  });

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const result = EnvSchema.safeParse(config);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Variáveis de ambiente inválidas:\n${issues}`);
  }

  return { ...config, ...result.data };
}
