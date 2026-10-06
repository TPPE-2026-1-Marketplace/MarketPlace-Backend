import { isSwaggerEnabled } from './swagger.config';

describe('isSwaggerEnabled', () => {
  describe('fora de produção o Swagger fica sempre disponível', () => {
    it.each([
      ['NODE_ENV ausente', {}],
      ['development', { NODE_ENV: 'development' }],
      ['test', { NODE_ENV: 'test' }],
      [
        'development com SWAGGER_PUBLIC=false',
        { NODE_ENV: 'development', SWAGGER_PUBLIC: 'false' },
      ],
      ['NODE_ENV ausente com SWAGGER_PUBLIC=false', { SWAGGER_PUBLIC: 'false' }],
    ])('%s → habilitado', (_caso, env) => {
      expect(isSwaggerEnabled(env)).toBe(true);
    });
  });

  describe('em produção fica desligado a menos que a flag religue', () => {
    it('desligado por padrão quando SWAGGER_PUBLIC não está definida', () => {
      expect(isSwaggerEnabled({ NODE_ENV: 'production' })).toBe(false);
    });

    it('religa com SWAGGER_PUBLIC=true', () => {
      expect(isSwaggerEnabled({ NODE_ENV: 'production', SWAGGER_PUBLIC: 'true' })).toBe(true);
    });

    // Só o literal 'true' religa: qualquer outro valor mantém o padrão seguro,
    // para que um typo na env não exponha o /docs sem querer.
    it.each(['false', 'TRUE', 'True', '1', 'yes', 'sim', '', ' true '])(
      'mantém desligado com SWAGGER_PUBLIC=%p',
      (value) => {
        expect(isSwaggerEnabled({ NODE_ENV: 'production', SWAGGER_PUBLIC: value })).toBe(false);
      },
    );
  });

  it('lê process.env quando nenhum ambiente é passado', () => {
    const original = { ...process.env };

    try {
      process.env.NODE_ENV = 'production';
      delete process.env.SWAGGER_PUBLIC;
      expect(isSwaggerEnabled()).toBe(false);

      process.env.SWAGGER_PUBLIC = 'true';
      expect(isSwaggerEnabled()).toBe(true);
    } finally {
      process.env = original;
    }
  });
});
