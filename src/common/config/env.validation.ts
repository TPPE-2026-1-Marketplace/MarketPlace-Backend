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
export const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).optional(),
    PORT: z.coerce.number().int().positive().optional(),

    DATABASE_URL: z.string().url('DATABASE_URL inválida').optional(),
    POSTGRES_HOST: z.string().min(1, 'POSTGRES_HOST é obrigatório').optional(),
    POSTGRES_PORT: z.coerce.number().int().positive().optional(),
    POSTGRES_USER: z.string().min(1, 'POSTGRES_USER é obrigatório').optional(),
    POSTGRES_PASSWORD: z.string().min(1, 'POSTGRES_PASSWORD é obrigatório').optional(),
    POSTGRES_DB: z.string().min(1, 'POSTGRES_DB é obrigatório').optional(),

    JWT_SECRET: z.string().min(1, 'JWT_SECRET é obrigatório'),

    // Integrações externas — todas opcionais (têm mock/fallback). Listadas aqui
    // só para documentar tudo que a app lê num único lugar.
    LOJA_CEP_ORIGEM: z.string().optional(),

    // Pagamentos (InfinitePay)
    PAYMENT_GATEWAY_PROVIDER: z.enum(['mock', 'infinitepay']).optional(),
    INFINITEPAY_HANDLE: z.string().optional(),
    INFINITEPAY_REDIRECT_URL: z.string().optional(),

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
