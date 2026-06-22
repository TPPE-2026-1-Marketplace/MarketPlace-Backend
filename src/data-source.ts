import 'dotenv/config';
import { DataSource } from 'typeorm';

/**
 * DataSource usado pelo CLI do TypeORM (migration:generate / migration:run).
 * O app em runtime continua usando a configuração de TypeOrmModule em app.module.ts.
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
});
