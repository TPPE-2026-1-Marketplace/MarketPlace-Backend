import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';

import { AppModule } from '../app.module';
import { Payment, PaymentStatus, CaptureMethod } from './entities/payment.entity';
import { StockLog, MovementType } from '../inventory/entities/stock-log.entity';
import { Stock } from '../inventory/entities/stock.entity';
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

describe('PaymentsModule Integration - API and Entity Tests', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let paymentsRepository: Repository<Payment>;
  let ordersRepository: Repository<Order>;
  let orderItemsRepository: Repository<OrderItem>;
  let peopleRepository: Repository<Person>;
  let productRepository: Repository<Product>;
  let variantRepository: Repository<ProductVariant>;
  let stockRepository: Repository<Stock>;
  let stockLogRepository: Repository<StockLog>;
  let jwtService: JwtService;

  const testCpf1 = '12345678901';
  const testCpf2 = '98765432109';
  const testSku = 'SKU-TEST-WEBHOOK-INTEGRATION';
  let clientToken1: string;
  let clientToken2: string;
  let testOrder1: Order;

  beforeAll(async () => {
    loadDevelopmentEnv();

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ZodValidationPipe());
    app.setGlobalPrefix('api');
    await app.init();

    paymentsRepository = moduleRef.get(getRepositoryToken(Payment));
    ordersRepository = moduleRef.get(getRepositoryToken(Order));
    orderItemsRepository = moduleRef.get(getRepositoryToken(OrderItem));
    peopleRepository = moduleRef.get(getRepositoryToken(Person));
    productRepository = moduleRef.get(getRepositoryToken(Product));
    variantRepository = moduleRef.get(getRepositoryToken(ProductVariant));
    stockRepository = moduleRef.get(getRepositoryToken(Stock));
    stockLogRepository = moduleRef.get(getRepositoryToken(StockLog));
    jwtService = moduleRef.get<JwtService>(JwtService);

    // Generate tokens
    clientToken1 = jwtService.sign({
      sub: testCpf1,
      email: 'owner@example.com',
      role: 'cliente',
    });

    clientToken2 = jwtService.sign({
      sub: testCpf2,
      email: 'other@example.com',
      role: 'cliente',
    });
  });

  beforeEach(async () => {
    // Clean tables
    await stockLogRepository.createQueryBuilder().delete().execute();
    await paymentsRepository.createQueryBuilder().delete().execute();
    await orderItemsRepository.createQueryBuilder().delete().execute();
    await ordersRepository.createQueryBuilder().delete().execute();
    await variantRepository.delete({ codigoSku: testSku });
    await productRepository.delete({ sku: 'PROD-PAY' });
    await peopleRepository.delete({ cpf: testCpf1 });
    await peopleRepository.delete({ cpf: testCpf2 });

    // Seed Persons
    await peopleRepository.save({
      cpf: testCpf1,
      nome: 'Cliente Dono',
      email: 'owner@example.com',
      telefone: '11988888888',
      senha: 'some_password',
    });

    await peopleRepository.save({
      cpf: testCpf2,
      nome: 'Outro Cliente',
      email: 'other@example.com',
      telefone: '11977777777',
      senha: 'some_other_password',
    });

    // Seed Orders
    testOrder1 = await ordersRepository.save({
      idUsuario: testCpf1,
      subtotal: 100.0,
      valorFrete: 10.0,
      valorTotal: 110.0,
      tipoRetirada: TipoRetirada.ENTREGA,
      status: OrderStatus.PENDING,
    });

    await ordersRepository.save({
      idUsuario: testCpf2,
      subtotal: 200.0,
      valorFrete: 20.0,
      valorTotal: 220.0,
      tipoRetirada: TipoRetirada.ENTREGA,
      status: OrderStatus.PENDING,
    });
  });

  afterAll(async () => {
    if (app) {
      await stockLogRepository.createQueryBuilder().delete().execute();
      await paymentsRepository.createQueryBuilder().delete().execute();
      await orderItemsRepository.createQueryBuilder().delete().execute();
      await ordersRepository.createQueryBuilder().delete().execute();
      await variantRepository.delete({ codigoSku: testSku });
      await productRepository.delete({ sku: 'PROD-PAY' });
      await peopleRepository.delete({ cpf: testCpf1 });
      await peopleRepository.delete({ cpf: testCpf2 });
      await app.close();
    }
  });

  // --- ENTITY SPECIFIC TESTS ---

  it('deve salvar um pagamento e ler corretamente com todas as propriedades', async () => {
    const payment = paymentsRepository.create({
      idPedido: testOrder1.idPedido,
      amount: 110.0,
      paidAmount: 110.0,
      captureMethod: CaptureMethod.PIX,
      status: PaymentStatus.PAID,
      installments: 1,
      orderNsu: 'NSU123456',
      transactionNsu: 'TX123456',
      invoiceSlug: 'inv-slug-123',
      receiptUrl: 'https://receipt.example.com/123',
      redirectUrl: 'https://redirect.example.com/123',
      webhookUrl: 'https://webhook.example.com/123',
    });

    const saved = await paymentsRepository.save(payment);
    expect(saved.idPagamento).toBeDefined();
    expect(Number(saved.amount)).toBe(110.0);

    // Verify relations
    const found = await paymentsRepository.findOne({
      where: { idPagamento: saved.idPagamento },
      relations: ['order'],
    });
    expect(found).toBeDefined();
    expect(found?.order).toBeDefined();
    expect(found?.order.idPedido).toBe(testOrder1.idPedido);
  });

  it('deve violar as restrições de validação do banco de dados (Check Constraints) ao passar valores negativos', async () => {
    const paymentNeg = paymentsRepository.create({
      idPedido: testOrder1.idPedido,
      amount: -10.0,
      captureMethod: CaptureMethod.DEBIT_CARD,
      status: PaymentStatus.PENDING,
    });

    await expect(paymentsRepository.save(paymentNeg)).rejects.toThrow();
  });

  // --- API ROUTE E2E TESTS (POST /api/payments) ---

  it('deve rejeitar tentativa de pagamento se não autenticado (retorna 401) (Critério de Aceite)', async () => {
    await request(app.getHttpServer())
      .post('/api/payments')
      .send({
        idPedido: testOrder1.idPedido,
        captureMethod: 'pix',
        installments: 1,
      })
      .expect(401);
  });

  it('deve rejeitar se o DTO for inválido ou violar a regra de parcelas do Pix (retorna 400)', async () => {
    // 1. Método Pix com mais de 1 parcela (Regra de Negócio)
    await request(app.getHttpServer())
      .post('/api/payments')
      .set('Authorization', `Bearer ${clientToken1}`)
      .send({
        idPedido: testOrder1.idPedido,
        captureMethod: 'pix',
        installments: 3,
      })
      .expect(400);

    // 2. Método de captura inválido
    await request(app.getHttpServer())
      .post('/api/payments')
      .set('Authorization', `Bearer ${clientToken1}`)
      .send({
        idPedido: testOrder1.idPedido,
        captureMethod: 'invalid_method',
        installments: 1,
      })
      .expect(400);
  });

  it('deve rejeitar se o cliente autenticado não for o dono do pedido (retorna 403) (Critério de Aceite)', async () => {
    await request(app.getHttpServer())
      .post('/api/payments')
      .set('Authorization', `Bearer ${clientToken2}`)
      .send({
        idPedido: testOrder1.idPedido,
        captureMethod: 'pix',
        installments: 1,
      })
      .expect(403);
  });

  it('deve registrar pagamento com sucesso para o dono do pedido, atualizando o status do pedido para paid (retorna 201) (Critério de Aceite)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/payments')
      .set('Authorization', `Bearer ${clientToken1}`)
      .send({
        idPedido: testOrder1.idPedido,
        captureMethod: 'credit_card',
        installments: 6,
      })
      .expect(201);

    expect(res.body.idPedido).toBe(testOrder1.idPedido);
    expect(res.body.status).toBe('paid');
    expect(Number(res.body.amount)).toBe(110.0);
    expect(res.body.captureMethod).toBe('credit_card');
    expect(res.body.installments).toBe(6);

    // Verificar se o pedido no banco de dados foi de fato atualizado para PAID
    const orderInDb = await ordersRepository.findOne({ where: { idPedido: testOrder1.idPedido } });
    expect(orderInDb?.status).toBe(OrderStatus.PAID);
  });

  it('deve retornar 409 (Conflict) ao tentar registrar pagamento de um pedido já pago (Critério de Aceite)', async () => {
    // 1. Registrar o primeiro pagamento
    await request(app.getHttpServer())
      .post('/api/payments')
      .set('Authorization', `Bearer ${clientToken1}`)
      .send({
        idPedido: testOrder1.idPedido,
        captureMethod: 'pix',
        installments: 1,
      })
      .expect(201);

    // 2. Tentar registrar outro pagamento para o mesmo pedido já pago (deve retornar 409)
    const conflictRes = await request(app.getHttpServer())
      .post('/api/payments')
      .set('Authorization', `Bearer ${clientToken1}`)
      .send({
        idPedido: testOrder1.idPedido,
        captureMethod: 'pix',
        installments: 1,
      })
      .expect(409);

    expect(conflictRes.body.message).toContain('O pedido já está pago');
  });

  it('deve retornar 404 se tentar pagar por um pedido inexistente', async () => {
    await request(app.getHttpServer())
      .post('/api/payments')
      .set('Authorization', `Bearer ${clientToken1}`)
      .send({
        idPedido: 999999,
        captureMethod: 'pix',
        installments: 1,
      })
      .expect(404);
  });

  // --- NEW INTEGRATION TESTS FOR WEBHOOKS AND STATUS QUERY ---

  it('deve permitir consultar o status do pagamento pelo ID do pedido (GET /order/:idPedido)', async () => {
    // 1. Criar pagamento
    await paymentsRepository.save({
      idPedido: testOrder1.idPedido,
      amount: 110.0,
      captureMethod: CaptureMethod.PIX,
      status: PaymentStatus.PENDING,
      orderNsu: 'NSU-QUERY-TEST',
      invoiceSlug: 'slug-query-test',
      installments: 1,
    });

    // 2. Consultar como dono
    const res = await request(app.getHttpServer())
      .get(`/api/payments/order/${testOrder1.idPedido}`)
      .set('Authorization', `Bearer ${clientToken1}`)
      .expect(200);

    expect(res.body.orderNsu).toBe('NSU-QUERY-TEST');
    expect(res.body.status).toBe('pending');

    // 3. Rejeitar consulta por outro cliente (403)
    await request(app.getHttpServer())
      .get(`/api/payments/order/${testOrder1.idPedido}`)
      .set('Authorization', `Bearer ${clientToken2}`)
      .expect(403);
  });

  it('deve atualizar pagamento e pedido para PAID ao receber webhook de aprovação', async () => {
    // 1. Criar pagamento pendente
    await paymentsRepository.save({
      idPedido: testOrder1.idPedido,
      amount: 110.0,
      captureMethod: CaptureMethod.PIX,
      status: PaymentStatus.PENDING,
      orderNsu: 'NSU-WEBHOOK-TEST-1',
      invoiceSlug: 'slug-webhook-test-1',
      installments: 1,
    });

    // 2. Disparar webhook de sucesso (valores em centavos)
    await request(app.getHttpServer())
      .post('/api/payments/webhook')
      .send({
        invoice_slug: 'slug-webhook-test-1',
        amount: 11000,
        paid_amount: 11000,
        order_nsu: 'NSU-WEBHOOK-TEST-1',
        status: 'approved',
        transaction_nsu: 'TX-WEBHOOK-APPROVED-123',
        receipt_url: 'https://receipt.infinitepay.io/123',
      })
      .expect(200);

    // 3. Confirmar alterações
    const paymentInDb = await paymentsRepository.findOne({
      where: { orderNsu: 'NSU-WEBHOOK-TEST-1' },
    });
    expect(paymentInDb?.status).toBe(PaymentStatus.PAID);
    expect(Number(paymentInDb?.paidAmount)).toBe(110.0);
    expect(paymentInDb?.transactionNsu).toBe('TX-WEBHOOK-APPROVED-123');

    const orderInDb = await ordersRepository.findOne({ where: { idPedido: testOrder1.idPedido } });
    expect(orderInDb?.status).toBe(OrderStatus.PAID);
  });

  it('deve cancelar pagamento/pedido (sem estornar estoque) ao receber webhook de falha/cancelamento', async () => {
    // 1. Cadastrar produto, variante e estoque
    const prod = await productRepository.save({
      titulo: 'Produto Pagamento',
      precoBase: 100.0,
      sku: 'PROD-PAY',
    });

    await variantRepository.save({
      codigoSku: testSku,
      precoVariante: 100.0,
      ativo: true,
      product: prod,
    });

    await stockRepository.save({
      codigoSku: testSku,
      qtdOnline: 5,
      qtdLojaFisica: 5,
    });

    // 2. Associar itens ao pedido
    const orderWithItem = await ordersRepository.save({
      idUsuario: testCpf1,
      subtotal: 100.0,
      valorFrete: 10.0,
      valorTotal: 110.0,
      tipoRetirada: TipoRetirada.ENTREGA,
      status: OrderStatus.PENDING,
    });

    await orderItemsRepository.save({
      idPedido: orderWithItem.idPedido,
      idVariante: testSku,
      quantidade: 2,
      precoUnitario: 100.0,
    });

    // 3. Criar pagamento pendente
    await paymentsRepository.save({
      idPedido: orderWithItem.idPedido,
      amount: 110.0,
      captureMethod: CaptureMethod.PIX,
      status: PaymentStatus.PENDING,
      orderNsu: 'NSU-STOCK-TEST',
      invoiceSlug: 'slug-stock-test',
      installments: 1,
    });

    // 4. Disparar webhook de falha
    await request(app.getHttpServer())
      .post('/api/payments/webhook')
      .send({
        invoice_slug: 'slug-stock-test',
        amount: 11000,
        order_nsu: 'NSU-STOCK-TEST',
        status: 'failed',
      })
      .expect(200);

    // 5. Verificar que status do pagamento é FAILED e pedido é CANCELLED
    const paymentInDb = await paymentsRepository.findOne({ where: { orderNsu: 'NSU-STOCK-TEST' } });
    expect(paymentInDb?.status).toBe(PaymentStatus.FAILED);

    const orderInDb = await ordersRepository.findOne({
      where: { idPedido: orderWithItem.idPedido },
    });
    expect(orderInDb?.status).toBe(OrderStatus.CANCELLED);

    // 6. O estoque NÃO é estornado: a baixa só ocorre na confirmação do pagamento,
    //    então uma falha não tem o que devolver (permanece em 5).
    const stockInDb = await stockRepository.findOne({ where: { codigoSku: testSku } });
    expect(stockInDb?.qtdOnline).toBe(5);

    // 7. Não deve existir log de ENTRADA (estorno) de estoque.
    const logInDb = await stockLogRepository.findOne({
      where: { codigoSku: testSku, tipoMovimentacao: MovementType.ENTRADA },
    });
    expect(logInDb).toBeNull();
  });
});
