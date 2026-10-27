import { DEFAULT_POSTGRES_PORT } from '../common/constants';

export function buildDatabaseConnectionConfig() {
  const databaseUrl = process.env.DATABASE_URL;

  return databaseUrl
    ? { url: databaseUrl }
    : {
        host: process.env.POSTGRES_HOST,
        port: Number(process.env.POSTGRES_PORT ?? DEFAULT_POSTGRES_PORT),
        username: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        database: process.env.POSTGRES_DB,
      };
}

/**
 * Decisão sobre verificação de certificado TLS em produção — ver
 * docs/database-tls.md (issue #171).
 *
 * Por padrão, produção mantém `rejectUnauthorized: false` (TLS ativo, mas sem
 * validar a cadeia do certificado do provedor). Setar `DATABASE_SSL_VERIFY=true`
 * ativa a verificação real, usando a cadeia de CAs confiáveis padrão do Node —
 * suficiente para provedores com certificado emitido por CA pública (caso comum
 * de Postgres gerenciado), sem precisar de um bundle de CA customizado.
 *
 * Mantido como opt-in (não é o padrão) porque não há como validar a partir
 * daqui que a conexão real com o banco de produção continua funcionando após
 * a mudança — inverter o padrão sem testar contra o banco real arriscaria
 * derrubar a conexão de produção.
 */
export function buildDatabaseSslConfig(
  isProduction: boolean,
): boolean | { rejectUnauthorized: boolean } {
  if (!isProduction) {
    return false;
  }

  const verifyEnabled = process.env.DATABASE_SSL_VERIFY === 'true';

  return { rejectUnauthorized: verifyEnabled };
}
