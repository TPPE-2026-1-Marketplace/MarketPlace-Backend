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
