import { join } from 'node:path';

import { DataSource, type DataSourceOptions } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

import { buildDatabaseConnectionConfig } from './connection-config';

const isProduction = process.env.NODE_ENV === 'production';

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  ...buildDatabaseConnectionConfig(),
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  synchronize: false,
  entities: [join(__dirname, '..', '**', '*.entity{.ts,.js}')],
  migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
  namingStrategy: new SnakeNamingStrategy(),
};

export default new DataSource(dataSourceOptions);
