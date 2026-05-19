import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import { Repository } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { ProductVariant } from '../product-variants/entities/product-variant.entity';
import { ProductVariantsModule } from '../product-variants/product-variants.module';
import { CatalogImage } from './entities/catalog-image.entity';
import { Image } from './entities/image.entity';
import { ImagesModule } from './images.module';

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

describe('ImagesModule integration', () => {
  jest.setTimeout(30000);

  let app: INestApplication;
  let moduleRef: TestingModule;
  let imagesRepository: Repository<Image>;
  let catalogImagesRepository: Repository<CatalogImage>;
  let productVariantsRepository: Repository<ProductVariant>;

  const skuA = 'IT-IMG-A';
  const skuB = 'IT-IMG-B';

  beforeAll(async () => {
    loadDevelopmentEnv();

    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: getPostgresHost(),
          port: Number(process.env.POSTGRES_PORT ?? 5432),
          username: process.env.POSTGRES_USER,
          password: process.env.POSTGRES_PASSWORD,
          database: process.env.POSTGRES_DB,
          synchronize: true,
          autoLoadEntities: true,
          namingStrategy: new SnakeNamingStrategy(),
        }),
        ProductVariantsModule,
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
  });

  beforeEach(async () => {
    await catalogImagesRepository
      .createQueryBuilder()
      .delete()
      .where('variant_sku IN (:...skus)', { skus: [skuA, skuB] })
      .execute();
    await imagesRepository
      .createQueryBuilder()
      .delete()
      .where('url LIKE :url', { url: 'https://example.test/%' })
      .execute();
    await productVariantsRepository.delete([skuA, skuB]);

    await productVariantsRepository.save([
      { sku: skuA, ativo: true },
      { sku: skuB, ativo: true },
    ]);
  });

  afterAll(async () => {
    if (catalogImagesRepository) {
      await catalogImagesRepository
        .createQueryBuilder()
        .delete()
        .where('variant_sku IN (:...skus)', { skus: [skuA, skuB] })
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
    if (app) {
      await app.close();
    }
  });

  it('registra imagens, vincula a múltiplas variantes e lista ordenado por ordem_no_catalogo', async () => {
    const imageA = await request(app.getHttpServer())
      .post('/api/images')
      .send({
        url: 'https://example.test/a.jpg',
        ordem: 2,
        descricao: 'Frente',
        local_renderizacao: 'catalogo',
      })
      .expect(201);

    const imageB = await request(app.getHttpServer())
      .post('/api/images')
      .send({
        url: 'https://example.test/b.jpg',
        ordem: 1,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/images/catalog')
      .send({
        imageId: imageA.body.id,
        variantSku: skuA,
        ordem_no_catalogo: 20,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/images/catalog')
      .send({
        imageId: imageB.body.id,
        variantSku: skuA,
        ordem_no_catalogo: 10,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/images/catalog')
      .send({
        imageId: imageA.body.id,
        variantSku: skuB,
        ordem_no_catalogo: 5,
      })
      .expect(201);

    const catalog = await request(app.getHttpServer())
      .get(`/api/images/catalog/${skuA}`)
      .expect(200);

    expect(catalog.body).toHaveLength(2);
    expect(catalog.body.map((item: CatalogImage) => item.ordemNoCatalogo)).toEqual([
      10,
      20,
    ]);
    expect(catalog.body.map((item: CatalogImage) => item.image.id)).toEqual([
      imageB.body.id,
      imageA.body.id,
    ]);

    const linkedToVariantB = await catalogImagesRepository.find({
      where: { variant: { sku: skuB }, image: { id: imageA.body.id } },
      relations: { image: true, variant: true },
    });
    expect(linkedToVariantB).toHaveLength(1);
  });

  it('rejeita campos obrigatórios inválidos', async () => {
    await request(app.getHttpServer()).post('/api/images').send({}).expect(400);

    await request(app.getHttpServer())
      .post('/api/images/catalog')
      .send({ imageId: 1 })
      .expect(400);
  });

  it('retorna 404 quando imagem ou variante não existe', async () => {
    await request(app.getHttpServer())
      .post('/api/images/catalog')
      .send({ imageId: 999999, variantSku: skuA })
      .expect(404);

    const image = await request(app.getHttpServer())
      .post('/api/images')
      .send({ url: 'https://example.test/not-found.jpg' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/images/catalog')
      .send({ imageId: image.body.id, variantSku: 'IT-IMG-NOT-FOUND' })
      .expect(404);

    await request(app.getHttpServer())
      .get('/api/images/catalog/IT-IMG-NOT-FOUND')
      .expect(404);
  });
});
