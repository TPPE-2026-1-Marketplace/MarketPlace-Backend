import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';

import { AppModule } from '../app.module';
import { OrderItem } from './entities/order-item.entity';
import { Order, OrderStatus } from './entities/order.entity';
import { Role } from '../common/enums/role.enum';
import { Coupon } from '../coupons/entities/coupon.entity';
import { Employee } from '../employees/entities/employee.entity';
import { StockLog } from '../inventory/entities/stock-log.entity';
import { Stock } from '../inventory/entities/stock.entity';
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

describe('OrdersModule E2E Checkout, Store Pickup, Stock Reduction, In-Store Venda Presencial & Shipping Tracking Integration', () => {
  jest.setTimeout(30000);

  let app: INestApplication;
  let moduleRef: TestingModule;
  let ordersRepository: Repository<Order>;
  let orderItemsRepository: Repository<OrderItem>;
  let peopleRepository: Repository<Person>;
  let productRepository: Repository<Product>;
  let productVariantRepository: Repository<ProductVariant>;
  let couponRepository: Repository<Coupon>;
  let stockRepository: Repository<Stock>;
  let stockLogRepository: Repository<StockLog>;
  let employeeRepository: Repository<Employee>;
  let jwtService: JwtService;

  const testCpf = '77777777777';
  const otherCpf = '55555555555';
  const testSku = 'SKU-PEDIDO-INTEGRACAO';
  const testSellerCpf = '22222222222';
  const invalidSellerCpf = '33333333333';

  let clientToken: string;
  let otherClientToken: string;
  let employeeToken: string;
  let sellerToken: string;
  let testProduct: Product;
  let _testVariant: ProductVariant;

  beforeAll(async () => {
    loadDevelopmentEnv();

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ZodValidationPipe());
    app.setGlobalPrefix('api');
    await app.init();

    ordersRepository = moduleRef.get(getRepositoryToken(Order));
    orderItemsRepository = moduleRef.get(getRepositoryToken(OrderItem));
    peopleRepository = moduleRef.get(getRepositoryToken(Person));
    productRepository = moduleRef.get(getRepositoryToken(Product));
    productVariantRepository = moduleRef.get(getRepositoryToken(ProductVariant));
    couponRepository = moduleRef.get(getRepositoryToken(Coupon));
    stockRepository = moduleRef.get(getRepositoryToken(Stock));
    stockLogRepository = moduleRef.get(getRepositoryToken(StockLog));
    employeeRepository = moduleRef.get(getRepositoryToken(Employee));
    jwtService = moduleRef.get<JwtService>(JwtService);

    // Gerar token JWT válido para Cliente
    clientToken = jwtService.sign({
      sub: testCpf,
      email: 'checkout_teste@example.com',
      role: 'cliente',
    });

    // Gerar token para OUTRO cliente
    otherClientToken = jwtService.sign({
      sub: otherCpf,
      email: 'other_client@example.com',
      role: 'cliente',
    });

    // Gerar token para Funcionário (Caixa)
    employeeToken = jwtService.sign({
      sub: '44444444444',
      email: 'employee@example.com',
      role: 'caixa',
    });

    // Gerar token para Vendedor
    sellerToken = jwtService.sign({
      sub: testSellerCpf,
      email: 'vendedor@example.com',
      role: 'vendedor',
    });
  });

  beforeEach(async () => {
    // Limpar tabelas mantendo integridade
    await stockLogRepository.createQueryBuilder().delete().execute();
    await orderItemsRepository.createQueryBuilder().delete().execute();
    await ordersRepository.createQueryBuilder().delete().execute();
    await employeeRepository.createQueryBuilder().delete().execute();
    await stockRepository.delete({ codigoSku: testSku });
    await productVariantRepository.delete({ codigoSku: testSku });
    await productRepository.delete({ sku: 'PROD-PEDIDO' });
    await peopleRepository.delete({ cpf: testCpf });
    await peopleRepository.delete({ cpf: otherCpf });
    await peopleRepository.delete({ cpf: testSellerCpf });
    await peopleRepository.delete({ cpf: invalidSellerCpf });
    await couponRepository.delete({ numeroDoCupom: 'TESTEPERCENT' });
    await couponRepository.delete({ numeroDoCupom: 'TESTEFIXO' });

    // Seed: Clientes
    await peopleRepository.save({
      cpf: testCpf,
      nome: 'Cliente Checkout Teste',
      email: 'checkout_teste@example.com',
      telefone: '11999999999',
      senha: 'some_hashed_password',
    });

    await peopleRepository.save({
      cpf: otherCpf,
      nome: 'Outro Cliente Teste',
      email: 'other_client@example.com',
      telefone: '11888888888',
      senha: 'some_other_hashed_password',
    });

    // Seed: Person e Employee Vendedor (Válido)
    await peopleRepository.save({
      cpf: testSellerCpf,
      nome: 'Vendedor Teste',
      email: 'vendedor_teste@example.com',
      telefone: '11999999992',
      senha: 'some_hashed_password',
    });

    await employeeRepository.save({
      cpf: testSellerCpf,
      ativo: true,
      role_perfil: Role.VENDEDOR,
      taxa_comissao: 0.025,
      codigo_funcionario: 'VEND001',
    });

    // Seed: Person e Employee Caixa (Inválido como Vendedor)
    await peopleRepository.save({
      cpf: invalidSellerCpf,
      nome: 'Caixa Teste',
      email: 'caixa_teste@example.com',
      telefone: '11999999993',
      senha: 'some_hashed_password',
    });

    await employeeRepository.save({
      cpf: invalidSellerCpf,
      ativo: true,
      role_perfil: Role.CAIXA,
      taxa_comissao: 0.015,
      codigo_funcionario: 'CAIX001',
    });

    // Seed: Produto
    testProduct = await productRepository.save({
      titulo: 'Produto Pedido Teste',
      descricao: 'Descricao',
      destaque: false,
      precoBase: 100.0,
      sku: 'PROD-PEDIDO',
    });

    // Seed: SKU Variante
    _testVariant = await productVariantRepository.save({
      codigoSku: testSku,
      precoVariante: 120.0,
      ativo: true,
      cor: 'Azul',
      tamanho: 'M',
      product: testProduct,
    });

    // Seed: Estoque inicial (10 online, 5 loja física)
    await stockRepository.save({
      codigoSku: testSku,
      qtdOnline: 10,
      qtdLojaFisica: 5,
    });
  });

  afterAll(async () => {
    if (app) {
      await stockLogRepository.createQueryBuilder().delete().execute();
      await orderItemsRepository.createQueryBuilder().delete().execute();
      await ordersRepository.createQueryBuilder().delete().execute();
      await employeeRepository.createQueryBuilder().delete().execute();
      await stockRepository.delete({ codigoSku: testSku });
      await productVariantRepository.delete({ codigoSku: testSku });
      await productRepository.delete({ sku: 'PROD-PEDIDO' });
      await peopleRepository.delete({ cpf: testCpf });
      await peopleRepository.delete({ cpf: otherCpf });
      await peopleRepository.delete({ cpf: testSellerCpf });
      await peopleRepository.delete({ cpf: invalidSellerCpf });
      await couponRepository.delete({ numeroDoCupom: 'TESTEPERCENT' });
      await couponRepository.delete({ numeroDoCupom: 'TESTEFIXO' });
      await app.close();
    }
  });

  it('deve rejeitar criação de pedido se não autenticado (retorna 401) (Critério de Aceite)', async () => {
    await request(app.getHttpServer())
      .post('/api/orders')
      .send({
        items: [{ variantSku: testSku, quantidade: 2 }],
      })
      .expect(401);
  });

  it('deve retornar 404 ao tentar comprar SKU de variante inexistente (Critério de Aceite)', async () => {
    await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        items: [{ variantSku: 'SKU-INEXISTENTE', quantidade: 1 }],
      })
      .expect(404);
  });

  it('deve criar um pedido sem cupom com sucesso e calcular subtotal e total corretamente (Critério de Aceite)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        items: [{ variantSku: testSku, quantidade: 2 }],
        valorFrete: 15.0,
        tipoRetirada: 'entrega',
      })
      .expect(201);

    expect(res.body).toHaveProperty('idPedido');
    expect(Number(res.body.subtotal)).toBe(240.0); // 120 * 2
    expect(Number(res.body.valorFrete)).toBe(15.0);
    expect(Number(res.body.valorTotal)).toBe(255.0); // 240 + 15
    expect(res.body.status).toBe('pending');
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].idVariante).toBe(testSku);
  });

  it('deve retornar 400 ao tentar utilizar cupom inválido/expirado (Critério de Aceite)', async () => {
    await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        items: [{ variantSku: testSku, quantidade: 2 }],
        couponNumero: 'CUPOM-INEXISTENTE',
      })
      .expect(400);
  });

  it('deve aplicar cupom do tipo porcentagem e decrementar usos corretamente (Critério de Aceite)', async () => {
    const now = new Date();
    const dataInicio = new Date(now.getTime() - 3600000);
    const dataFim = new Date(now.getTime() + 3600000);

    await couponRepository.save({
      numeroDoCupom: 'TESTEPERCENT',
      tipoCupom: 'porcentagem',
      valorDesconto: 10.0,
      ativo: true,
      dataInicio,
      dataFim,
      usoMaximo: 5,
      usosAtuais: 0,
    });

    const res = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        items: [{ variantSku: testSku, quantidade: 2 }],
        couponNumero: 'TESTEPERCENT',
        valorFrete: 10.0,
      })
      .expect(201);

    expect(Number(res.body.subtotal)).toBe(240.0);
    expect(Number(res.body.valorTotal)).toBe(226.0);
    expect(res.body.idCupom).toBe('TESTEPERCENT');

    const updatedCoupon = await couponRepository.findOne({
      where: { numeroDoCupom: 'TESTEPERCENT' },
    });
    expect(updatedCoupon?.usosAtuais).toBe(1);
  });

  it('deve aplicar cupom do tipo valor fixo corretamente (Critério de Aceite)', async () => {
    const now = new Date();
    const dataInicio = new Date(now.getTime() - 3600000);
    const dataFim = new Date(now.getTime() + 3600000);

    await couponRepository.save({
      numeroDoCupom: 'TESTEFIXO',
      tipoCupom: 'fixo',
      valorDesconto: 30.0,
      ativo: true,
      dataInicio,
      dataFim,
      usoMaximo: 2,
      usosAtuais: 0,
    });

    const res = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        items: [{ variantSku: testSku, quantidade: 2 }],
        couponNumero: 'TESTEFIXO',
        valorFrete: 10.0,
      })
      .expect(201);

    expect(Number(res.body.subtotal)).toBe(240.0);
    expect(Number(res.body.valorTotal)).toBe(220.0);
  });

  it('deve zerar o valorFrete e gerar código de 6 dígitos quando tipoRetirada = loja (US15 - Critério de Aceite)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        items: [{ variantSku: testSku, quantidade: 1 }],
        tipoRetirada: 'loja',
        valorFrete: 45.0,
      })
      .expect(201);

    expect(res.body.tipoRetirada).toBe('loja');
    expect(Number(res.body.valorFrete)).toBe(0);
    expect(Number(res.body.subtotal)).toBe(120.0);
    expect(Number(res.body.valorTotal)).toBe(120.0);
    expect(res.body.codigoVerificacaoRetirada).toMatch(/^\d{6}$/);
  });

  it('deve proteger o endpoint de código de verificação por autenticação (retorna 401)', async () => {
    await request(app.getHttpServer()).get('/api/orders/999/verification-code').expect(401);
  });

  it('deve permitir que o dono do pedido (cliente) visualize o código de verificação (US15 - Critério de Aceite)', async () => {
    const orderRes = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        items: [{ variantSku: testSku, quantidade: 1 }],
        tipoRetirada: 'loja',
      })
      .expect(201);

    const orderId = orderRes.body.idPedido;
    const seededCode = orderRes.body.codigoVerificacaoRetirada;

    const res = await request(app.getHttpServer())
      .get(`/api/orders/${orderId}/verification-code`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('codigoVerificacaoRetirada');
    expect(res.body.codigoVerificacaoRetirada).toBe(seededCode);
  });

  it('deve negar acesso ao código de verificação se requisitado por outro cliente (retorna 403) (US15 - Critério de Aceite)', async () => {
    const orderRes = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        items: [{ variantSku: testSku, quantidade: 1 }],
        tipoRetirada: 'loja',
      })
      .expect(201);

    const orderId = orderRes.body.idPedido;

    await request(app.getHttpServer())
      .get(`/api/orders/${orderId}/verification-code`)
      .set('Authorization', `Bearer ${otherClientToken}`)
      .expect(403);
  });

  it('deve permitir que funcionários (como caixas) visualizem o código de verificação de retirada (US15 - Critério de Aceite)', async () => {
    const orderRes = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        items: [{ variantSku: testSku, quantidade: 1 }],
        tipoRetirada: 'loja',
      })
      .expect(201);

    const orderId = orderRes.body.idPedido;
    const seededCode = orderRes.body.codigoVerificacaoRetirada;

    const res = await request(app.getHttpServer())
      .get(`/api/orders/${orderId}/verification-code`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    expect(res.body.codigoVerificacaoRetirada).toBe(seededCode);
  });

  it('deve retornar 400 se o pedido for do tipo entrega (sem código de verificação)', async () => {
    const orderRes = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        items: [{ variantSku: testSku, quantidade: 1 }],
        tipoRetirada: 'entrega',
      })
      .expect(201);

    const orderId = orderRes.body.idPedido;

    await request(app.getHttpServer())
      .get(`/api/orders/${orderId}/verification-code`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(400);
  });

  it('deve decrementar estoque online (qtdOnline) e registrar StockLog ao confirmar o pagamento quando tipoRetirada = entrega (US16 - Critério de Aceite)', async () => {
    const orderRes = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        items: [{ variantSku: testSku, quantidade: 3 }],
        tipoRetirada: 'entrega',
      })
      .expect(201);

    const orderId = orderRes.body.idPedido;

    // A baixa de estoque ocorre na confirmação do pagamento (gateway mock aprova na hora).
    await request(app.getHttpServer())
      .post('/api/payments')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ idPedido: orderId, captureMethod: 'pix', installments: 1 })
      .expect(201);

    const stock = await stockRepository.findOne({ where: { codigoSku: testSku } });
    expect(stock?.qtdOnline).toBe(7);
    expect(stock?.qtdLojaFisica).toBe(5);

    const logs = await stockLogRepository.find({
      where: { idPedido: orderId },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].codigoSku).toBe(testSku);
    expect(logs[0].tipoMovimentacao).toBe('venda');
    expect(logs[0].quantidadeMovimentada).toBe(3);
    expect(logs[0].valorAnteriorOnline).toBe(10);
    expect(logs[0].valorNovoOnline).toBe(7);
  });

  it('deve decrementar estoque de loja física (qtdLojaFisica) e registrar StockLog ao confirmar o pagamento quando tipoRetirada = loja (US16 - Critério de Aceite)', async () => {
    const orderRes = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        items: [{ variantSku: testSku, quantidade: 2 }],
        tipoRetirada: 'loja',
      })
      .expect(201);

    const orderId = orderRes.body.idPedido;

    await request(app.getHttpServer())
      .post('/api/payments')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ idPedido: orderId, captureMethod: 'pix', installments: 1 })
      .expect(201);

    const stock = await stockRepository.findOne({ where: { codigoSku: testSku } });
    expect(stock?.qtdLojaFisica).toBe(3);
    expect(stock?.qtdOnline).toBe(10);

    const logs = await stockLogRepository.find({
      where: { idPedido: orderId },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].tipoMovimentacao).toBe('venda');
    expect(logs[0].quantidadeMovimentada).toBe(2);
    expect(logs[0].valorAnteriorLoja).toBe(5);
    expect(logs[0].valorNovoLoja).toBe(3);
  });

  it('deve falhar com 409 e abortar transação (rollback) se estoque online insuficiente (US16 - Critério de Aceite)', async () => {
    await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        items: [{ variantSku: testSku, quantidade: 15 }],
        tipoRetirada: 'entrega',
      })
      .expect(409);

    const orderCount = await ordersRepository.count();
    expect(orderCount).toBe(0);

    const stock = await stockRepository.findOne({ where: { codigoSku: testSku } });
    expect(stock?.qtdOnline).toBe(10);

    const logCount = await stockLogRepository.count();
    expect(logCount).toBe(0);
  });

  it('deve falhar com 409 e abortar transação (rollback) se estoque da loja física for insuficiente (US16 - Critério de Aceite)', async () => {
    await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        items: [{ variantSku: testSku, quantidade: 6 }],
        tipoRetirada: 'loja',
      })
      .expect(409);

    const orderCount = await ordersRepository.count();
    expect(orderCount).toBe(0);

    const stock = await stockRepository.findOne({ where: { codigoSku: testSku } });
    expect(stock?.qtdLojaFisica).toBe(5);

    const logCount = await stockLogRepository.count();
    expect(logCount).toBe(0);
  });

  it('deve rejeitar registro de venda presencial se não autenticado (retorna 401) (US24 - Critério de Aceite)', async () => {
    await request(app.getHttpServer())
      .post('/api/orders/in-store')
      .send({
        codigoVendedor: testSellerCpf,
        items: [{ variantSku: testSku, quantidade: 1 }],
      })
      .expect(401);
  });

  it('deve impedir que clientes normais registrem vendas presenciais (retorna 403) (US24 - Critério de Aceite)', async () => {
    await request(app.getHttpServer())
      .post('/api/orders/in-store')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        codigoVendedor: testSellerCpf,
        items: [{ variantSku: testSku, quantidade: 1 }],
      })
      .expect(403);
  });

  it('deve rejeitar registro se o CPF do vendedor for inexistente no banco (retorna 400) (US24 - Critério de Aceite)', async () => {
    await request(app.getHttpServer())
      .post('/api/orders/in-store')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        codigoVendedor: '99999999999', // CPF inexistente
        items: [{ variantSku: testSku, quantidade: 1 }],
      })
      .expect(400);
  });

  it('deve permitir que funcionário caixa registre venda presencial (US24 - Critério de Aceite)', async () => {
    await request(app.getHttpServer())
      .post('/api/orders/in-store')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        codigoVendedor: invalidSellerCpf,
        items: [{ variantSku: testSku, quantidade: 1 }],
      })
      .expect(201);
  });

  it('deve registrar venda presencial com sucesso sem cliente associado (anônima) e com status paid (US24 - Critério de Aceite)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/orders/in-store')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        codigoVendedor: testSellerCpf,
        items: [{ variantSku: testSku, quantidade: 2 }],
      })
      .expect(201);

    expect(res.body).toHaveProperty('idPedido');
    expect(res.body.idUsuario).toBeNull();
    expect(res.body.idFuncionario).toBe(testSellerCpf);
    expect(res.body.status).toBe('paid');
    expect(res.body.tipoRetirada).toBe('loja');
    expect(Number(res.body.valorFrete)).toBe(0);
    expect(Number(res.body.subtotal)).toBe(240.0);
    expect(Number(res.body.valorTotal)).toBe(240.0);

    const stock = await stockRepository.findOne({ where: { codigoSku: testSku } });
    expect(stock?.qtdLojaFisica).toBe(3);

    const logs = await stockLogRepository.find({
      where: { idPedido: res.body.idPedido },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].tipoMovimentacao).toBe('venda');
    expect(logs[0].origem).toBe('venda_presencial');
    expect(logs[0].quantidadeMovimentada).toBe(2);
    expect(logs[0].valorAnteriorLoja).toBe(5);
    expect(logs[0].valorNovoLoja).toBe(3);
  });

  it('deve registrar venda presencial com sucesso para cliente cadastrado (US24 - Critério de Aceite)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/orders/in-store')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        codigoVendedor: testSellerCpf,
        idUsuario: testCpf,
        items: [{ variantSku: testSku, quantidade: 1 }],
      })
      .expect(201);

    expect(res.body.idUsuario).toBe(testCpf);
    expect(res.body.idFuncionario).toBe(testSellerCpf);
    expect(res.body.status).toBe('paid');
  });

  it('deve registrar venda presencial com sucesso mesmo que o CPF do cliente não esteja cadastrado (US24 - Critério de Aceite)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/orders/in-store')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        codigoVendedor: testSellerCpf,
        idUsuario: '11111111111',
        items: [{ variantSku: testSku, quantidade: 1 }],
      })
      .expect(201);

    // CPF não cadastrado: idUsuario fica null, CPF fica em clienteCpfAvulso
    expect(res.body.idUsuario).toBeNull();
    expect(res.body.clienteCpfAvulso).toBe('11111111111');
  });

  // Novos Testes E2E para US18 (Shipping Tracking Code & Order Query)

  it('deve rejeitar inserção de código de rastreamento se não autenticado (retorna 401) (US18 - Critério de Aceite)', async () => {
    await request(app.getHttpServer())
      .patch('/api/orders/123/tracking')
      .send({ codigo_rastreamento: 'BR123456789' })
      .expect(401);
  });

  it('deve negar inserção de código de rastreamento para clientes (retorna 403) (US18 - Critério de Aceite)', async () => {
    await request(app.getHttpServer())
      .patch('/api/orders/123/tracking')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ codigo_rastreamento: 'BR123456789' })
      .expect(403);
  });

  it('deve rejeitar inserção se o pedido for com retirada física (loja) (retorna 400) (US18 - Critério de Aceite)', async () => {
    // 1. Criar pedido com retirada na loja
    const orderRes = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        items: [{ variantSku: testSku, quantidade: 1 }],
        tipoRetirada: 'loja',
      })
      .expect(201);

    const orderId = orderRes.body.idPedido;

    // 2. Tentar inserir código de rastreamento
    await request(app.getHttpServer())
      .patch(`/api/orders/${orderId}/tracking`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ codigo_rastreamento: 'BR123456789' })
      .expect(400);
  });

  it('deve permitir que vendedor insira código de rastreamento em pedido do tipo entrega, mude status para shipped, e cliente consulte seu código (US18 - Critério de Aceite)', async () => {
    // 1. Criar pedido com entrega
    const orderRes = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        items: [{ variantSku: testSku, quantidade: 1 }],
        tipoRetirada: 'entrega',
        valorFrete: 10.0,
      })
      .expect(201);

    const orderId = orderRes.body.idPedido;

    // Simular pagamento no banco para status paid
    await ordersRepository.update({ idPedido: orderId }, { status: OrderStatus.PAID });

    // 2. Vendedor insere código de rastreamento
    const patchRes = await request(app.getHttpServer())
      .patch(`/api/orders/${orderId}/tracking`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ codigo_rastreamento: 'BR-ENTREGA-999' })
      .expect(200);

    expect(patchRes.body.codigoRastreamento).toBe('BR-ENTREGA-999');
    expect(patchRes.body.status).toBe('shipped'); // Transição correta!

    // 3. Cliente consulta seu pedido e visualiza o código
    const getRes = await request(app.getHttpServer())
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);

    expect(getRes.body.codigoRastreamento).toBe('BR-ENTREGA-999');
    expect(getRes.body.status).toBe('shipped');
  });

  it('deve negar que outro cliente consulte os detalhes de um pedido alheio (retorna 403) (US18 - Critério de Aceite)', async () => {
    const orderRes = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        items: [{ variantSku: testSku, quantidade: 1 }],
        tipoRetirada: 'entrega',
      })
      .expect(201);

    const orderId = orderRes.body.idPedido;

    await request(app.getHttpServer())
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${otherClientToken}`)
      .expect(403);
  });

  // NOVOS TESTES DE REFINAMENTO (US06, US15, US18, US24)

  it('deve rejeitar checkout online de variante inativa (retorna 400) (US06 - Critério de Aceite)', async () => {
    // Inativar variante do teste
    await productVariantRepository.update({ codigoSku: testSku }, { ativo: false });

    await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        items: [{ variantSku: testSku, quantidade: 1 }],
        tipoRetirada: 'entrega',
      })
      .expect(400);

    // Restaurar ativo
    await productVariantRepository.update({ codigoSku: testSku }, { ativo: true });
  });

  it('deve rejeitar venda presencial de variante inativa (retorna 400) (US24 - Critério de Aceite)', async () => {
    // Inativar variante do teste
    await productVariantRepository.update({ codigoSku: testSku }, { ativo: false });

    await request(app.getHttpServer())
      .post('/api/orders/in-store')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        codigoVendedor: testSellerCpf,
        items: [{ variantSku: testSku, quantidade: 1 }],
      })
      .expect(400);

    // Restaurar ativo
    await productVariantRepository.update({ codigoSku: testSku }, { ativo: true });
  });

  it('deve rejeitar venda presencial se o vendedor estiver inativo (retorna 400) (US24 - Critério de Aceite)', async () => {
    // Inativar vendedor
    await employeeRepository.update({ cpf: testSellerCpf }, { ativo: false });

    await request(app.getHttpServer())
      .post('/api/orders/in-store')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        codigoVendedor: testSellerCpf,
        items: [{ variantSku: testSku, quantidade: 1 }],
      })
      .expect(400);

    // Restaurar ativo
    await employeeRepository.update({ cpf: testSellerCpf }, { ativo: true });
  });

  it('deve rejeitar código de rastreamento se o pedido não estiver pago (retorna 400) (US18 - Critério de Aceite)', async () => {
    // 1. Criar pedido online (nasce como pending)
    const orderRes = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        items: [{ variantSku: testSku, quantidade: 1 }],
        tipoRetirada: 'entrega',
      })
      .expect(201);

    const orderId = orderRes.body.idPedido;

    // 2. Tentar atualizar rastreamento (deve falhar pois status é pending, não paid)
    await request(app.getHttpServer())
      .patch(`/api/orders/${orderId}/tracking`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ codigo_rastreamento: 'BR123456789' })
      .expect(400);
  });

  it('deve permitir atualizar código de rastreamento se o pedido estiver PAGO (retorna 200) e depois impedir se já estiver entregue (retorna 400) (US18 - Critério de Aceite)', async () => {
    // 1. Criar pedido online
    const orderRes = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        items: [{ variantSku: testSku, quantidade: 1 }],
        tipoRetirada: 'entrega',
      })
      .expect(201);

    const orderId = orderRes.body.idPedido;

    // 2. Simular pagamento no banco para status paid
    await ordersRepository.update({ idPedido: orderId }, { status: OrderStatus.PAID });

    // 3. Atualizar rastreamento (deve funcionar)
    await request(app.getHttpServer())
      .patch(`/api/orders/${orderId}/tracking`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ codigo_rastreamento: 'BR-PAGO-OK' })
      .expect(200);

    // 4. Mudar status para delivered no banco
    await ordersRepository.update({ idPedido: orderId }, { status: OrderStatus.DELIVERED });

    // 5. Tentar atualizar rastreamento novamente (deve falhar pois já está entregue)
    await request(app.getHttpServer())
      .patch(`/api/orders/${orderId}/tracking`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ codigo_rastreamento: 'BR-NOVO-ERRO' })
      .expect(400);
  });

  it('deve rejeitar confirmação de retirada se o usuário não for funcionário (retorna 403) (US15 - Critério de Aceite)', async () => {
    await request(app.getHttpServer())
      .post('/api/orders/999/confirm-pickup')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ pin: '123456' })
      .expect(403);
  });

  it('deve rejeitar confirmação de retirada se o PIN de verificação estiver incorreto (retorna 400) (US15 - Critério de Aceite)', async () => {
    // 1. Criar pedido online para retirada
    const orderRes = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        items: [{ variantSku: testSku, quantidade: 1 }],
        tipoRetirada: 'loja',
      })
      .expect(201);

    const orderId = orderRes.body.idPedido;

    // 2. Simular pagamento no banco para status paid
    await ordersRepository.update({ idPedido: orderId }, { status: OrderStatus.PAID });

    // 3. Confirmar com PIN incorreto (deve falhar)
    await request(app.getHttpServer())
      .post(`/api/orders/${orderId}/confirm-pickup`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ pin: '000000' }) // PIN errado
      .expect(400);
  });

  it('deve rejeitar confirmação de retirada se o pedido não estiver pago (retorna 400) (US15 - Critério de Aceite)', async () => {
    // 1. Criar pedido online para retirada (nasce pending)
    const orderRes = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        items: [{ variantSku: testSku, quantidade: 1 }],
        tipoRetirada: 'loja',
      })
      .expect(201);

    const orderId = orderRes.body.idPedido;
    const correctPin = orderRes.body.codigoVerificacaoRetirada;

    // 2. Confirmar sem ter pago (deve falhar)
    await request(app.getHttpServer())
      .post(`/api/orders/${orderId}/confirm-pickup`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ pin: correctPin })
      .expect(400);
  });

  it('deve permitir confirmar retirada física se o PIN estiver correto e o pedido estiver pago, alterando status para delivered (retorna 200) (US15 - Critério de Aceite)', async () => {
    // 1. Criar pedido online para retirada
    const orderRes = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        items: [{ variantSku: testSku, quantidade: 1 }],
        tipoRetirada: 'loja',
      })
      .expect(201);

    const orderId = orderRes.body.idPedido;
    const correctPin = orderRes.body.codigoVerificacaoRetirada;

    // 2. Simular pagamento no banco para status paid
    await ordersRepository.update({ idPedido: orderId }, { status: OrderStatus.PAID });

    // 3. Confirmar com PIN correto (deve funcionar)
    const confirmRes = await request(app.getHttpServer())
      .post(`/api/orders/${orderId}/confirm-pickup`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ pin: correctPin })
      .expect(200);

    expect(confirmRes.body.status).toBe('delivered');

    // 4. Verificar no banco se de fato salvou como delivered
    const orderDb = await ordersRepository.findOne({ where: { idPedido: orderId } });
    expect(orderDb?.status).toBe('delivered');
  });

  // --- NOVOS TESTES: GET /orders (gerente+) e GET /orders/my (cliente) ---

  it('deve negar listagem geral de pedidos para clientes (retorna 403) (Refinamento)', async () => {
    await request(app.getHttpServer())
      .get('/api/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(403);
  });

  it('deve negar listagem geral de pedidos sem autenticação (retorna 401) (Refinamento)', async () => {
    await request(app.getHttpServer()).get('/api/orders').expect(401);
  });

  it('deve listar pedidos paginados para gerente/admin com filtro de status (Refinamento)', async () => {
    // Criar pedido
    const orderRes = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        items: [{ variantSku: testSku, quantidade: 1 }],
        tipoRetirada: 'entrega',
      })
      .expect(201);

    const orderId = orderRes.body.idPedido;

    // Listar todos com token de caixa (role gerente não existe no setup, mas employee é caixa)
    // Usando gerente via token gerado
    const gerenteToken = jwtService.sign({
      sub: '44444444444',
      email: 'gerente@example.com',
      role: 'gerente',
    });

    const listRes = await request(app.getHttpServer())
      .get('/api/orders')
      .set('Authorization', `Bearer ${gerenteToken}`)
      .expect(200);

    expect(listRes.body).toHaveProperty('data');
    expect(listRes.body).toHaveProperty('meta');
    expect(listRes.body.meta).toHaveProperty('total');
    expect(listRes.body.meta).toHaveProperty('page');
    expect(listRes.body.meta).toHaveProperty('limit');
    expect(listRes.body.data.some((o: any) => o.idPedido === orderId)).toBe(true);

    // Filtrar por status pending — deve incluir o pedido criado
    const listPendingRes = await request(app.getHttpServer())
      .get('/api/orders?status=pending')
      .set('Authorization', `Bearer ${gerenteToken}`)
      .expect(200);

    expect(listPendingRes.body.data.some((o: any) => o.idPedido === orderId)).toBe(true);

    // Filtrar por status shipped — não deve incluir
    const listShippedRes = await request(app.getHttpServer())
      .get('/api/orders?status=shipped')
      .set('Authorization', `Bearer ${gerenteToken}`)
      .expect(200);

    expect(listShippedRes.body.data.some((o: any) => o.idPedido === orderId)).toBe(false);
  });

  it('deve retornar apenas os pedidos do próprio cliente autenticado em GET /my (Refinamento)', async () => {
    // Criar pedido do cliente testCpf
    const myOrderRes = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        items: [{ variantSku: testSku, quantidade: 1 }],
        tipoRetirada: 'entrega',
      })
      .expect(201);

    const myOrderId = myOrderRes.body.idPedido;

    // Listar meus pedidos
    const myRes = await request(app.getHttpServer())
      .get('/api/orders/my')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);

    expect(myRes.body).toHaveProperty('data');
    expect(myRes.body).toHaveProperty('meta');
    expect(myRes.body.data.some((o: any) => o.idPedido === myOrderId)).toBe(true);
    // Todos os pedidos devem pertencer ao próprio cliente
    myRes.body.data.forEach((o: any) => {
      expect(o.idUsuario).toBe(testCpf);
    });

    // Outro cliente não deve ver o pedido
    const otherRes = await request(app.getHttpServer())
      .get('/api/orders/my')
      .set('Authorization', `Bearer ${otherClientToken}`)
      .expect(200);

    expect(otherRes.body.data.some((o: any) => o.idPedido === myOrderId)).toBe(false);
  });

  it('deve retornar 401 em GET /orders/my se não autenticado (Refinamento)', async () => {
    await request(app.getHttpServer()).get('/api/orders/my').expect(401);
  });

  it('deve confirmar retirada de forma idempotente — segundo clique com PIN correto retorna 200 sem erro (Refinamento)', async () => {
    // 1. Criar pedido para retirada na loja
    const orderRes = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        items: [{ variantSku: testSku, quantidade: 1 }],
        tipoRetirada: 'loja',
      })
      .expect(201);

    const orderId = orderRes.body.idPedido;
    const correctPin = orderRes.body.codigoVerificacaoRetirada;

    // 2. Simular pagamento
    await ordersRepository.update({ idPedido: orderId }, { status: OrderStatus.PAID });

    // 3. Primeira confirmação (deve funcionar)
    const first = await request(app.getHttpServer())
      .post(`/api/orders/${orderId}/confirm-pickup`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ pin: correctPin })
      .expect(200);

    expect(first.body.status).toBe('delivered');

    // 4. Segunda confirmação com mesmo PIN (deve retornar 200 idempotente, sem erro)
    const second = await request(app.getHttpServer())
      .post(`/api/orders/${orderId}/confirm-pickup`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ pin: correctPin })
      .expect(200);

    expect(second.body.status).toBe('delivered');
  });
});
