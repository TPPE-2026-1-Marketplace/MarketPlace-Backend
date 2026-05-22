import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';

import { AppModule } from '../app.module';
import { Review } from './entities/review.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Order, OrderStatus, TipoRetirada } from '../orders/entities/order.entity';
import { Person } from '../people/entities/person.entity';
import { ProductVariant } from '../product-variants/entities/product-variant.entity';
import { Product } from '../products/entities/product.entity';

import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import type { Repository } from 'typeorm';

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

describe('ReviewsModule integration (Full Suite with DELETE)', () => {
  jest.setTimeout(30000);

  let app: INestApplication;
  let moduleRef: TestingModule;
  let reviewsRepository: Repository<Review>;
  let peopleRepository: Repository<Person>;
  let productsRepository: Repository<Product>;
  let ordersRepository: Repository<Order>;
  let orderItemsRepository: Repository<OrderItem>;
  let productVariantsRepository: Repository<ProductVariant>;
  let jwtService: JwtService;

  const testCpf1 = '99999999999';
  const testCpf2 = '88888888888';
  const testEmail1 = 'review.test1.integration@example.com';
  const testEmail2 = 'review.test2.integration@example.com';
  const testSku = 'SKU-REVIEW-TEST-INTEGRATION';

  let testProductId: number;
  let clientToken1: string;
  let managerToken: string;

  beforeAll(async () => {
    loadDevelopmentEnv();

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ZodValidationPipe());
    app.setGlobalPrefix('api');
    await app.init();

    reviewsRepository = moduleRef.get(getRepositoryToken(Review));
    peopleRepository = moduleRef.get(getRepositoryToken(Person));
    productsRepository = moduleRef.get(getRepositoryToken(Product));
    ordersRepository = moduleRef.get(getRepositoryToken(Order));
    orderItemsRepository = moduleRef.get(getRepositoryToken(OrderItem));
    productVariantsRepository = moduleRef.get(getRepositoryToken(ProductVariant));
    jwtService = moduleRef.get<JwtService>(JwtService);

    // Gerar token JWT válido para o cliente 1
    clientToken1 = jwtService.sign({
      sub: testCpf1,
      email: testEmail1,
      role: 'cliente',
    });

    // Gerar token JWT válido para um gerente
    managerToken = jwtService.sign({
      sub: '88888888887',
      email: 'manager@example.com',
      role: 'gerente',
    });
  });

  beforeEach(async () => {
    // Limpar quaisquer dados anteriores na ordem correta usando QueryBuilder para evitar restrições de critério vazio no TypeORM
    await reviewsRepository.createQueryBuilder().delete().execute();
    await orderItemsRepository.createQueryBuilder().delete().execute();
    await ordersRepository.createQueryBuilder().delete().execute();
    await productVariantsRepository.createQueryBuilder().delete().execute();
    await productsRepository.delete({ sku: testSku });
    await peopleRepository.delete({ cpf: testCpf1 });
    await peopleRepository.delete({ cpf: testCpf2 });

    // Cadastrar cliente 1
    await peopleRepository.save({
      cpf: testCpf1,
      nome: 'Cliente Um',
      email: testEmail1,
      telefone: '11999999999',
      senha: null,
    });

    // Cadastrar cliente 2
    await peopleRepository.save({
      cpf: testCpf2,
      nome: 'Cliente Dois',
      email: testEmail2,
      telefone: '11888888888',
      senha: null,
    });

    // Cadastrar produto de teste
    const product = await productsRepository.save({
      titulo: 'Produto de Teste para Review',
      descricao: 'Descrição do produto teste',
      destaque: false,
      qualMedida: null,
      material: null,
      composicao: null,
      silhueta: null,
      tags: null,
      precoBase: 50.0,
      sku: testSku,
    });

    testProductId = product.idProduto;

    // Cadastrar variante do produto
    await productVariantsRepository.save({
      codigoSku: testSku,
      precoVariante: 50.0,
      ativo: true,
      product: product,
    });

    // Cadastrar pedido entregue/pago para o cliente 1
    await ordersRepository.save({
      idUsuario: testCpf1,
      status: OrderStatus.DELIVERED,
      subtotal: 50.0,
      valorFrete: 0.0,
      valorTotal: 50.0,
      tipoRetirada: TipoRetirada.LOJA,
      items: [
        {
          idVariante: testSku,
          quantidade: 1,
          precoUnitario: 50.0,
        } as any,
      ],
    });

    // Cadastrar pedido entregue/pago para o cliente 2
    await ordersRepository.save({
      idUsuario: testCpf2,
      status: OrderStatus.PAID,
      subtotal: 50.0,
      valorFrete: 0.0,
      valorTotal: 50.0,
      tipoRetirada: TipoRetirada.LOJA,
      items: [
        {
          idVariante: testSku,
          quantidade: 1,
          precoUnitario: 50.0,
        } as any,
      ],
    });
  });

  afterAll(async () => {
    if (reviewsRepository) {
      await reviewsRepository.createQueryBuilder().delete().execute();
    }
    if (orderItemsRepository) {
      await orderItemsRepository.createQueryBuilder().delete().execute();
    }
    if (ordersRepository) {
      await ordersRepository.createQueryBuilder().delete().execute();
    }
    if (productVariantsRepository) {
      await productVariantsRepository.createQueryBuilder().delete().execute();
    }
    if (productsRepository) {
      await productsRepository.delete({ sku: testSku });
    }
    if (peopleRepository) {
      await peopleRepository.delete({ cpf: testCpf1 });
      await peopleRepository.delete({ cpf: testCpf2 });
    }
    if (app) {
      await app.close();
    }
  });

  // --- TESTES DE CRIAÇÃO (POST /api/reviews) ---

  it('deve criar uma avaliação com sucesso usando o idCliente extraído do token JWT', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/reviews')
      .set('Authorization', `Bearer ${clientToken1}`)
      .send({
        idProduto: testProductId,
        nota: 5,
        comentario: 'Excelente produto! Muito confortável.',
      })
      .expect(201);

    expect(res.body).toHaveProperty('cpfCliente', testCpf1);
    expect(res.body).toHaveProperty('idProduto', testProductId);
    expect(res.body).toHaveProperty('nota', 5);
    expect(res.body).toHaveProperty('comentario', 'Excelente produto! Muito confortável.');
    expect(res.body).toHaveProperty('dataAvaliacao');
  });

  it('deve retornar 401 se tentar avaliar sem token JWT', async () => {
    await request(app.getHttpServer())
      .post('/api/reviews')
      .send({
        idProduto: testProductId,
        nota: 5,
        comentario: 'Tenta criar sem autenticação',
      })
      .expect(401);
  });

  it('deve retornar 409 quando tentar avaliar o mesmo produto duas vezes pelo mesmo cliente', async () => {
    await request(app.getHttpServer())
      .post('/api/reviews')
      .set('Authorization', `Bearer ${clientToken1}`)
      .send({
        idProduto: testProductId,
        nota: 4,
        comentario: 'Gostei',
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/api/reviews')
      .set('Authorization', `Bearer ${clientToken1}`)
      .send({
        idProduto: testProductId,
        nota: 5,
        comentario: 'Outra vez',
      })
      .expect(409);

    expect(res.body.message).toContain('O cliente já avaliou este produto');
  });

  it('deve retornar 400 se a nota for menor que 1 ou maior que 5', async () => {
    await request(app.getHttpServer())
      .post('/api/reviews')
      .set('Authorization', `Bearer ${clientToken1}`)
      .send({
        idProduto: testProductId,
        nota: 6,
        comentario: 'Nota inválida 6',
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/reviews')
      .set('Authorization', `Bearer ${clientToken1}`)
      .send({
        idProduto: testProductId,
        nota: 0,
        comentario: 'Nota inválida 0',
      })
      .expect(400);
  });

  it('deve retornar 400 se o comentário tiver mais de 2000 caracteres', async () => {
    const longoComentario = 'a'.repeat(2001);
    await request(app.getHttpServer())
      .post('/api/reviews')
      .set('Authorization', `Bearer ${clientToken1}`)
      .send({
        idProduto: testProductId,
        nota: 4,
        comentario: longoComentario,
      })
      .expect(400);
  });

  it('deve ignorar idCliente enviado no payload e avaliar em nome do usuário autenticado no token', async () => {
    const outroCpf = '11111111111';

    const res = await request(app.getHttpServer())
      .post('/api/reviews')
      .set('Authorization', `Bearer ${clientToken1}`)
      .send({
        idCliente: outroCpf,
        idProduto: testProductId,
        nota: 4,
        comentario: 'Minha avaliação',
      } as any)
      .expect(201);

    expect(res.body.cpfCliente).toBe(testCpf1);
    expect(res.body.cpfCliente).not.toBe(outroCpf);
  });

  it('deve retornar 404 quando o produto não existir ao criar', async () => {
    await request(app.getHttpServer())
      .post('/api/reviews')
      .set('Authorization', `Bearer ${clientToken1}`)
      .send({
        idProduto: 999999,
        nota: 5,
      })
      .expect(404);
  });

  it('deve retornar 403 se o cliente tentar avaliar um produto que não comprou/pagou', async () => {
    const cpfSemCompra = '77777777777';
    const emailSemCompra = 'nocompra@example.com';

    await peopleRepository.save({
      cpf: cpfSemCompra,
      nome: 'Cliente Sem Compra',
      email: emailSemCompra,
      telefone: '11777777777',
      senha: null,
    });

    const tokenSemCompra = jwtService.sign({
      sub: cpfSemCompra,
      email: emailSemCompra,
      role: 'cliente',
    });

    const res = await request(app.getHttpServer())
      .post('/api/reviews')
      .set('Authorization', `Bearer ${tokenSemCompra}`)
      .send({
        idProduto: testProductId,
        nota: 4,
        comentario: 'Produto falso',
      })
      .expect(403);

    expect(res.body.message).toContain(
      'Apenas clientes que compraram e pagaram pelo produto podem avaliá-lo.',
    );

    await peopleRepository.delete({ cpf: cpfSemCompra });
  });

  it('deve sanitizar tags HTML/JS do comentário ao criar uma avaliação', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/reviews')
      .set('Authorization', `Bearer ${clientToken1}`)
      .send({
        idProduto: testProductId,
        nota: 5,
        comentario: '<script>alert("hack")</script>Excelente <b>produto</b>!',
      })
      .expect(201);

    expect(res.body.comentario).toBe('alert("hack")Excelente produto!');
  });

  // --- TESTES DE LISTAGEM PÚBLICA E PAGINAÇÃO (GET /api/reviews/product/:productId) ---

  it('deve retornar a lista paginada pública de avaliações, escondendo o CPF dos clientes e incluindo a distribuição de estrelas', async () => {
    await reviewsRepository.save([
      {
        cpfCliente: testCpf1,
        idProduto: testProductId,
        nota: 5,
        comentario: 'Comentário Cliente 1',
        dataAvaliacao: new Date('2026-05-20T10:00:00Z'),
      },
      {
        cpfCliente: testCpf2,
        idProduto: testProductId,
        nota: 3,
        comentario: 'Comentário Cliente 2',
        dataAvaliacao: new Date('2026-05-21T10:00:00Z'),
      },
    ]);
    await productsRepository.update(testProductId, {
      mediaAvaliacao: 4.0,
      totalAvaliacoes: 2,
    });

    const res = await request(app.getHttpServer())
      .get(`/api/reviews/product/${testProductId}`)
      .expect(200);

    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');
    expect(res.body).toHaveProperty('media', 4.0);
    expect(res.body).toHaveProperty('totalAvaliacoes', 2);
    expect(res.body).toHaveProperty('distribuicao');

    expect(res.body.distribuicao).toEqual({
      '1': 0,
      '2': 0,
      '3': 1,
      '4': 0,
      '5': 1,
    });

    expect(res.body.meta).toEqual({
      page: 1,
      limit: 10,
      total: 2,
      totalPages: 1,
    });

    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].comentario).toBe('Comentário Cliente 2');
    expect(res.body.data[0].cliente.nome).toBe('Cliente Dois');

    expect(res.body.data[0]).not.toHaveProperty('cpfCliente');
    expect(res.body.data[0].cliente).not.toHaveProperty('cpf');
    expect(res.body.data[1]).not.toHaveProperty('cpfCliente');
    expect(res.body.data[1].cliente).not.toHaveProperty('cpf');
  });

  it('deve aplicar paginação limitando os resultados corretamente', async () => {
    await reviewsRepository.save([
      {
        cpfCliente: testCpf1,
        idProduto: testProductId,
        nota: 5,
        comentario: 'A',
        dataAvaliacao: new Date('2026-05-20T10:00:00Z'),
      },
      {
        cpfCliente: testCpf2,
        idProduto: testProductId,
        nota: 4,
        comentario: 'B',
        dataAvaliacao: new Date('2026-05-21T10:00:00Z'),
      },
    ]);
    await productsRepository.update(testProductId, {
      mediaAvaliacao: 4.5,
      totalAvaliacoes: 2,
    });

    const res = await request(app.getHttpServer())
      .get(`/api/reviews/product/${testProductId}?page=1&limit=1`)
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].comentario).toBe('B');
    expect(res.body.meta).toEqual({
      page: 1,
      limit: 1,
      total: 2,
      totalPages: 2,
    });
  });

  // --- TESTES DE DELETAR AVALIAÇÃO (DELETE /api/reviews/:clienteId/:produtoId) ---

  it('deve permitir que um gerente ou administrador delete uma avaliação inadequada (retorna 204) e remova da listagem', async () => {
    // 1. Criar avaliação
    await reviewsRepository.save({
      cpfCliente: testCpf1,
      idProduto: testProductId,
      nota: 1,
      comentario: 'Comentário ofensivo ou spam',
    });
    await productsRepository.update(testProductId, {
      mediaAvaliacao: 1.0,
      totalAvaliacoes: 1,
    });

    // 2. Chamar o DELETE com token de gerente
    await request(app.getHttpServer())
      .delete(`/api/reviews/${testCpf1}/${testProductId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(204);

    // 3. Confirmar que a listagem de avaliações está vazia
    const res = await request(app.getHttpServer())
      .get(`/api/reviews/product/${testProductId}`)
      .expect(200);

    expect(res.body.data).toHaveLength(0);
    expect(res.body.totalAvaliacoes).toBe(0);
    expect(res.body.media).toBe(0);
  });

  it('deve retornar 403 (Forbidden) se um cliente comum tentar acessar o endpoint de exclusão', async () => {
    // 1. Criar avaliação
    await reviewsRepository.save({
      cpfCliente: testCpf1,
      idProduto: testProductId,
      nota: 5,
      comentario: 'Comentário legal',
    });
    await productsRepository.update(testProductId, {
      mediaAvaliacao: 5.0,
      totalAvaliacoes: 1,
    });

    // 2. Chamar o DELETE com token de cliente
    await request(app.getHttpServer())
      .delete(`/api/reviews/${testCpf1}/${testProductId}`)
      .set('Authorization', `Bearer ${clientToken1}`)
      .expect(403);

    // 3. Confirmar que a avaliação NÃO foi deletada do banco
    const review = await reviewsRepository.findOne({
      where: { cpfCliente: testCpf1, idProduto: testProductId },
    });
    expect(review).toBeDefined();
    expect(review?.comentario).toBe('Comentário legal');
  });

  it('deve retornar 401 (Unauthorized) se um usuário não autenticado tentar acessar o endpoint de exclusão', async () => {
    await request(app.getHttpServer())
      .delete(`/api/reviews/${testCpf1}/${testProductId}`)
      .expect(401);
  });

  it('deve retornar 404 se tentar deletar uma avaliação inexistente', async () => {
    await request(app.getHttpServer())
      .delete(`/api/reviews/${testCpf1}/999999`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(404);
  });
});
