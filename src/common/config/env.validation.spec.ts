import { validateEnv } from './env.validation';

const validEnv = {
  POSTGRES_HOST: 'localhost',
  POSTGRES_USER: 'user',
  POSTGRES_PASSWORD: 'pass',
  POSTGRES_DB: 'db',
  JWT_SECRET: 'segredo',
};

describe('validateEnv', () => {
  it('aceita um ambiente com apenas as variáveis obrigatórias', () => {
    const result = validateEnv(validEnv);
    expect(result.POSTGRES_HOST).toBe('localhost');
    expect(result.JWT_SECRET).toBe('segredo');
  });

  it.each(['POSTGRES_HOST', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB', 'JWT_SECRET'])(
    'lança quando a obrigatória %s está ausente, citando-a na mensagem',
    (missing) => {
      const env: Record<string, unknown> = { ...validEnv };
      delete env[missing];
      expect(() => validateEnv(env)).toThrow(new RegExp(missing));
    },
  );

  it('permite as integrações externas ausentes (são opcionais)', () => {
    expect(() => validateEnv(validEnv)).not.toThrow();
  });

  it('coage MELHOR_ENVIO_SERVICE_ID para número', () => {
    const result = validateEnv({ ...validEnv, MELHOR_ENVIO_SERVICE_ID: '2' });
    expect(result.MELHOR_ENVIO_SERVICE_ID).toBe(2);
  });

  it.each(['0', '-1', 'abc'])('rejeita MELHOR_ENVIO_SERVICE_ID inválido (%s)', (value) => {
    expect(() => validateEnv({ ...validEnv, MELHOR_ENVIO_SERVICE_ID: value })).toThrow();
  });

  it('rejeita PAYMENT_GATEWAY_PROVIDER fora do enum', () => {
    expect(() => validateEnv({ ...validEnv, PAYMENT_GATEWAY_PROVIDER: 'foo' })).toThrow();
  });

  it('coage PORT para número quando informado', () => {
    const result = validateEnv({ ...validEnv, PORT: '3001' });
    expect(result.PORT).toBe(3001);
  });
});
