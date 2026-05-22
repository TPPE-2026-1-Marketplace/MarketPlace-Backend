import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { Test } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

import { ImagesModule } from './images.module';
import { AuthModule } from '../auth/auth.module';
import { CategoriesModule } from '../categories/categories.module';
import { BCRYPT_ROUNDS, DEFAULT_POSTGRES_PORT } from '../common/constants';
import { Role } from '../common/enums/role.enum';
import { CouponsModule } from '../coupons/coupons.module';
import { EmployeesModule } from '../employees/employees.module';
import { Employee } from '../employees/entities/employee.entity';
import { Person } from '../people/entities/person.entity';
import { PeopleModule } from '../people/people.module';
import { ProductVariant } from '../product-variants/entities/product-variant.entity';
import { ProductVariantsModule } from '../product-variants/product-variants.module';
import { CatalogImage } from './entities/catalog-image.entity';
import { Image } from './entities/image.entity';
import { Product } from '../products/entities/product.entity';

import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import type { Repository } from 'typeorm';

function loadDevelopmentEnv() {
  const envPath = join(process.cwd(), '.env.development');
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

function getPostgresHost() {
  const host = process.env.POSTGRES_HOST ?? 'localhost';
  if (host === 'postgres' && !existsSync('/.dockerenv')) {
    return 'localhost';
  }

  return host;
}

const INTEGRATION_TEST_TIMEOUT_MS = 30_000;
const TEST_VARIANT_PRICE_A = 100;
const TEST_VARIANT_PRICE_B = 120;
const TEST_PRODUCT_BASE_PRICE = 100;

describe('ImagesModule integration', () => {
  jest.setTimeout(INTEGRATION_TEST_TIMEOUT_MS);

  let app: INestApplication;
  let moduleRef: TestingModule;
  let imagesRepository: Repository<Image>;
  let catalogImagesRepository: Repository<CatalogImage>;
  let productVariantsRepository: Repository<ProductVariant>;
  let productsRepository: Repository<Product>;
  let peopleRepository: Repository<Person>;
  let employeesRepository: Repository<Employee>;
  let authHeader: string;

  const skuA = 'IT-IMG-A';
  const skuB = 'IT-IMG-B';
  const productSku = 'IT-IMG-PRODUCT';
  const adminCpf = '99999999991';
  const adminEmail = 'admin-it-images@example.test';
  const adminPassword = 'Test@1234';

  beforeAll(async () => {
    loadDevelopmentEnv();

    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: getPostgresHost(),
          port: Number(process.env.POSTGRES_PORT ?? DEFAULT_POSTGRES_PORT),
          username: process.env.POSTGRES_USER,
          password: process.env.POSTGRES_PASSWORD,
          database: process.env.POSTGRES_DB,
          synchronize: true,
          autoLoadEntities: true,
          namingStrategy: new SnakeNamingStrategy(),
        }),
        CategoriesModule,
        PeopleModule,
        EmployeesModule,
        AuthModule,
        ProductVariantsModule,
        CouponsModule,
        ImagesModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ZodValidationPipe());
    app.setGlobalPrefix('api');
    await app.init();

    imagesRepository = moduleRef.get(getRepositoryToken(Image));
    catalogImagesRepository = moduleRef.get(getRepositoryToken(CatalogImage));
    productVariantsRepository = moduleRef.get(getRepositoryToken(ProductVariant));
    productsRepository = moduleRef.get(getRepositoryToken(Product));
    peopleRepository = moduleRef.get(getRepositoryToken(Person));
    employeesRepository = moduleRef.get(getRepositoryToken(Employee));

    // Setup do admin para autenticação (endpoints POST exigem role ADMINISTRADOR).
    await employeesRepository.delete({ cpf: adminCpf });
    await peopleRepository.delete({ cpf: adminCpf });

    const senhaHash = await bcrypt.hash(adminPassword, BCRYPT_ROUNDS);
    await peopleRepository.save({
      cpf: adminCpf,
      nome: 'Admin Integration Test',
      email: adminEmail,
      telefone: null,
      senha: senhaHash,
    });
    await employeesRepository.save({
      cpf: adminCpf,
      ativo: true,
      role_perfil: Role.ADMINISTRADOR,
      meta_vendas: null,
      codigo_funcionario: null,
    });

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: adminEmail, senha: adminPassword })
      .expect(200);
    authHeader = `Bearer ${loginRes.body.access_token as string}`;
  });

  beforeEach(async () => {
    await catalogImagesRepository
      .createQueryBuilder()
      .delete()
      .where('codigo_sku IN (:...skus)', { skus: [skuA, skuB] })
      .execute();
    await imagesRepository
      .createQueryBuilder()
      .delete()
      .where('url LIKE :url', { url: 'https://example.test/%' })
      .execute();
    await productVariantsRepository.delete([skuA, skuB]);
    await productsRepository.delete({ sku: productSku });

    const product = await productsRepository.save({
      titulo: 'Produto de teste imagens',
      descricao: null,
      destaque: false,
      qualMedida: null,
      material: null,
      composicao: null,
      silhueta: null,
      tags: null,
      precoBase: TEST_PRODUCT_BASE_PRICE,
      sku: productSku,
    });

    await productVariantsRepository.save([
      {
        codigoSku: skuA,
        precoVariante: TEST_VARIANT_PRICE_A,
        ativo: true,
        cor: null,
        tamanho: null,
        product,
      },
      {
        codigoSku: skuB,
        precoVariante: TEST_VARIANT_PRICE_B,
        ativo: true,
        cor: null,
        tamanho: null,
        product,
      },
    ]);
  });

  afterAll(async () => {
    if (catalogImagesRepository) {
      await catalogImagesRepository
        .createQueryBuilder()
        .delete()
        .where('codigo_sku IN (:...skus)', { skus: [skuA, skuB] })
        .execute();
    }
    if (imagesRepository) {
      await imagesRepository
        .createQueryBuilder()
        .delete()
        .where('url LIKE :url', { url: 'https://example.test/%' })
        .execute();
    }
    if (productVariantsRepository) {
      await productVariantsRepository.delete([skuA, skuB]);
    }
    if (productsRepository) {
      await productsRepository.delete({ sku: productSku });
    }
    if (employeesRepository) {
      await employeesRepository.delete({ cpf: adminCpf });
    }
    if (peopleRepository) {
      await peopleRepository.delete({ cpf: adminCpf });
    }
    if (app) {
      await app.close();
    }
  });

  it('registra imagens, vincula a múltiplas variantes e lista ordenado por ordem_no_catalogo', async () => {
    const imageA = await request(app.getHttpServer())
      .post('/api/images')
      .set('Authorization', authHeader)
      .send({
        url: 'https://example.test/a.jpg',
        ordem: 2,
        descricao: 'Frente',
        local_renderizacao: 'catalogo',
      })
      .expect(201);

    const imageB = await request(app.getHttpServer())
      .post('/api/images')
      .set('Authorization', authHeader)
      .send({
        url: 'https://example.test/b.jpg',
        ordem: 1,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/images/catalog')
      .set('Authorization', authHeader)
      .send({
        imageId: imageA.body.idImagem,
        variantSku: skuA,
        ordem_no_catalogo: 20,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/images/catalog')
      .set('Authorization', authHeader)
      .send({
        imageId: imageB.body.idImagem,
        variantSku: skuA,
        ordem_no_catalogo: 10,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/images/catalog')
      .set('Authorization', authHeader)
      .send({
        imageId: imageA.body.idImagem,
        variantSku: skuB,
        ordem_no_catalogo: 5,
      })
      .expect(201);

    const catalog = await request(app.getHttpServer())
      .get(`/api/images/catalog/${skuA}`)
      .expect(200);

    expect(catalog.body).toHaveLength(2);
    expect(catalog.body.map((item: CatalogImage) => item.ordemNoCatalogo)).toEqual([10, 20]);
    expect(catalog.body.map((item: CatalogImage) => item.image.idImagem)).toEqual([
      imageB.body.idImagem,
      imageA.body.idImagem,
    ]);

    const linkedToVariantB = await catalogImagesRepository.find({
      where: { variant: { codigoSku: skuB }, image: { idImagem: imageA.body.idImagem } },
      relations: { image: true, variant: true },
    });
    expect(linkedToVariantB).toHaveLength(1);
  });

  it('rejeita campos obrigatórios inválidos', async () => {
    await request(app.getHttpServer())
      .post('/api/images')
      .set('Authorization', authHeader)
      .send({})
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/images/catalog')
      .set('Authorization', authHeader)
      .send({ imageId: 1 })
      .expect(400);
  });

  it('retorna 404 quando imagem ou variante não existe', async () => {
    await request(app.getHttpServer())
      .post('/api/images/catalog')
      .set('Authorization', authHeader)
      .send({ imageId: 999999, variantSku: skuA })
      .expect(404);

    const image = await request(app.getHttpServer())
      .post('/api/images')
      .set('Authorization', authHeader)
      .send({ url: 'https://example.test/not-found.jpg' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/images/catalog')
      .set('Authorization', authHeader)
      .send({ imageId: image.body.idImagem, variantSku: 'IT-IMG-NOT-FOUND' })
      .expect(404);

    await request(app.getHttpServer()).get('/api/images/catalog/IT-IMG-NOT-FOUND').expect(404);
  });
});
