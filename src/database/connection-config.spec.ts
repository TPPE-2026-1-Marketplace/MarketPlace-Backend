import { buildDatabaseSslConfig } from './connection-config';

describe('buildDatabaseSslConfig', () => {
  const originalEnv = process.env.DATABASE_SSL_VERIFY;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.DATABASE_SSL_VERIFY;
    } else {
      process.env.DATABASE_SSL_VERIFY = originalEnv;
    }
  });

  it('retorna false fora de produção, independente da flag', () => {
    process.env.DATABASE_SSL_VERIFY = 'true';

    expect(buildDatabaseSslConfig(false)).toBe(false);
  });

  it('em produção, sem a flag, mantém rejectUnauthorized desabilitado (comportamento atual)', () => {
    delete process.env.DATABASE_SSL_VERIFY;

    expect(buildDatabaseSslConfig(true)).toEqual({ rejectUnauthorized: false });
  });

  it('em produção, com DATABASE_SSL_VERIFY=true, ativa a verificação real do certificado', () => {
    process.env.DATABASE_SSL_VERIFY = 'true';

    expect(buildDatabaseSslConfig(true)).toEqual({ rejectUnauthorized: true });
  });

  it('em produção, qualquer valor diferente de "true" mantém a verificação desabilitada', () => {
    process.env.DATABASE_SSL_VERIFY = 'yes';

    expect(buildDatabaseSslConfig(true)).toEqual({ rejectUnauthorized: false });
  });
});
