import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { Test } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { AppModule } from '../app.module';

import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';

function loadDevelopmentEnv() {
  const envPath = join(process.cwd(), '.env.development');
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex === -1) {
        continue;
      }
      const key = trimmed.slice(0, separatorIndex);
      const value = trimmed.slice(separatorIndex + 1);
      process.env[key] ??= value;
    }
  }
}

const SEED_PATH = join(process.cwd(), 'scripts', 'seed-dev.sql');

const SEED_CPFS = ['00000000000', '39337997240', '19246459636', '93919986741', '19954963677'];
const SEED_PRODUCT_SKUS = [
  'VEST-MIDI-FLORAL',
  'BLUSA-CANELADA-OFF',
  'CALCA-ALFAIATARIA-PT',
  'DK-009',
  'DK-008',
  'DK-012',
  'DK-015',
];

// Credenciais documentadas no README (seção "Seed de desenvolvimento").
const SEED_LOGINS = [
  { email: 'admin@demo.com', senha: 'admin123', role: 'administrador' },
  { email: 'gerente@dkfashion.dev', senha: 'gerente123', role: 'gerente' },
  { email: 'vendedor@dkfashion.dev', senha: 'vendedor123', role: 'vendedor' },
  { email: 'caixa@dkfashion.dev', senha: 'caixa123', role: 'caixa' },
  { email: 'cliente@dkfashion.dev', senha: 'cliente123', role: 'cliente' },
];

/**
 * Aplica scripts/seed-dev.sql contra o schema atual das entities. Se uma
 * mudança de entity quebrar o seed (coluna renomeada, constraint nova), este
 * teste falha no CI em vez de o problema aparecer só para quem roda `make db-seed`.
 */
describe('Seed de desenvolvimento (scripts/seed-dev.sql)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  const seedSql = readFileSync(SEED_PATH, 'utf8');

  async function count(sql: string, params: unknown[] = []): Promise<number> {
    const [row] = await dataSource.query(sql, params);
    return Number(row.total);
  }

  async function seedSnapshot() {
    return {
      people: await count('SELECT COUNT(*) AS total FROM person WHERE cpf = ANY($1)', [SEED_CPFS]),
      employees: await count('SELECT COUNT(*) AS total FROM employee WHERE cpf = ANY($1)', [
        SEED_CPFS,
      ]),
      products: await count('SELECT COUNT(*) AS total FROM product WHERE sku = ANY($1)', [
        SEED_PRODUCT_SKUS,
      ]),
      variants: await count(
        'SELECT COUNT(*) AS total FROM product_variant v JOIN product p ON p.id_produto = v.id_produto WHERE p.sku = ANY($1)',
        [SEED_PRODUCT_SKUS],
      ),
      orders: await count(
        'SELECT COUNT(*) AS total FROM orders WHERE id_pedido BETWEEN 9001 AND 9099',
      ),
      items: await count(
        'SELECT COUNT(*) AS total FROM order_item WHERE id_item_pedido BETWEEN 9001 AND 9099',
      ),
      goals: await count(
        'SELECT COUNT(*) AS total FROM sales_goal WHERE id_goal BETWEEN 9001 AND 9099',
      ),
    };
  }

  beforeAll(async () => {
    loadDevelopmentEnv();

    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ZodValidationPipe());
    app.setGlobalPrefix('api');
    await app.init();

    dataSource = moduleRef.get(DataSource);
    // Sem parâmetros, o driver usa o protocolo simples e aceita o arquivo inteiro.
    await dataSource.query(seedSql);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('popula usuários, catálogo, estoque, metas e pedidos', async () => {
    expect(await seedSnapshot()).toEqual({
      people: 5,
      employees: 4,
      products: 7,
      variants: 12,
      orders: 17,
      items: 20,
      goals: 2,
    });
  });

  it('cobre todos os status, as duas modalidades e os últimos 6 meses', async () => {
    const statuses = await dataSource.query(
      'SELECT DISTINCT status::text AS status FROM orders WHERE id_pedido BETWEEN 9001 AND 9099 ORDER BY 1',
    );
    expect(statuses.map((row: { status: string }) => row.status)).toEqual([
      'cancelled',
      'delivered',
      'paid',
      'pending',
      'shipped',
    ]);

    const modalities = await dataSource.query(
      'SELECT DISTINCT tipo_retirada::text AS tipo FROM orders WHERE id_pedido BETWEEN 9001 AND 9099 ORDER BY 1',
    );
    expect(modalities.map((row: { tipo: string }) => row.tipo)).toEqual(['entrega', 'loja']);

    const months = await count(
      "SELECT COUNT(DISTINCT date_trunc('month', data_pedido)) AS total FROM orders WHERE id_pedido BETWEEN 9001 AND 9099",
    );
    expect(months).toBeGreaterThanOrEqual(5);
  });

  it('inclui estoque baixo, zerado e um produto sem variantes', async () => {
    const low = await count(
      'SELECT COUNT(*) AS total FROM stock WHERE qtd_online + qtd_loja_fisica BETWEEN 1 AND 5 AND codigo_sku LIKE ANY($1)',
      [['DK-%', 'CALCA-%']],
    );
    const empty = await count(
      "SELECT COUNT(*) AS total FROM stock WHERE codigo_sku = 'DK-008-BO-M' AND qtd_online + qtd_loja_fisica = 0",
    );
    const withoutVariants = await count(
      "SELECT COUNT(*) AS total FROM product p WHERE p.sku = 'DK-015' AND NOT EXISTS (SELECT 1 FROM product_variant v WHERE v.id_produto = p.id_produto)",
    );

    expect(low).toBeGreaterThan(0);
    expect(empty).toBe(1);
    expect(withoutVariants).toBe(1);
  });

  it('é idempotente: rodar de novo não falha nem duplica registros', async () => {
    const before = await seedSnapshot();

    await dataSource.query(seedSql);

    expect(await seedSnapshot()).toEqual(before);
  });

  it.each(SEED_LOGINS)(
    '$role entra com as credenciais documentadas',
    async ({ email, senha, role }) => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, senha })
        .expect(200);

      const payload = JSON.parse(
        Buffer.from(res.body.access_token.split('.')[1], 'base64url').toString(),
      );
      expect(payload.role).toBe(role);
    },
  );
});
