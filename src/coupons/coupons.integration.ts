import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';

import { CouponsService } from './coupons.service';
import { AppModule } from '../app.module';
import { Coupon } from './entities/coupon.entity';
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

describe('CouponsModule integration (CRUD, Validation, Products N:N & Influencers)', () => {
  jest.setTimeout(30000);

  let app: INestApplication;
  let moduleRef: TestingModule;
  let couponsRepository: Repository<Coupon>;
  let productsRepository: Repository<Product>;
  let couponsService: CouponsService;
  let jwtService: JwtService;

  const testCouponCode = 'INTEGRATIONTEST10';
  let adminToken: string;
  let clientToken: string;

  let testProduct1: Product;
  let testProduct2: Product;

  beforeAll(async () => {
    loadDevelopmentEnv();

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ZodValidationPipe());
    app.setGlobalPrefix('api');
    await app.init();

    couponsRepository = moduleRef.get(getRepositoryToken(Coupon));
    productsRepository = moduleRef.get(getRepositoryToken(Product));
    couponsService = moduleRef.get<CouponsService>(CouponsService);
    jwtService = moduleRef.get<JwtService>(JwtService);

    // Gerar token JWT válido para Administrador
    adminToken = jwtService.sign({
      sub: '00000000000',
      email: 'admin@example.com',
      role: 'administrador',
    });

    // Gerar token JWT válido para Cliente comum
    clientToken = jwtService.sign({
      sub: '11111111111',
      email: 'client@example.com',
      role: 'cliente',
    });

    // Cadastrar produtos de teste
    await productsRepository.delete({ sku: 'SKUTESTE1' });
    await productsRepository.delete({ sku: 'SKUTESTE2' });

    testProduct1 = await productsRepository.save({
      titulo: 'Produto Teste 1',
      precoBase: 100.0,
      sku: 'SKUTESTE1',
    });

    testProduct2 = await productsRepository.save({
      titulo: 'Produto Teste 2',
      precoBase: 200.0,
      sku: 'SKUTESTE2',
    });
  });

  beforeEach(async () => {
    // Limpar cupom de teste anterior
    await couponsRepository.delete({ numeroDoCupom: testCouponCode });
  });

  afterAll(async () => {
    if (couponsRepository) {
      await couponsRepository.delete({ numeroDoCupom: testCouponCode });
    }
    if (productsRepository) {
      await productsRepository.delete({ sku: 'SKUTESTE1' });
      await productsRepository.delete({ sku: 'SKUTESTE2' });
    }
    if (app) {
      await app.close();
    }
  });

  // --- TESTES DE SEGURANÇA E AUTORIZAÇÃO (POST, GET, PATCH, DELETE) ---

  it('deve rejeitar operações administrativas de CRUD se não autenticado (retorna 401)', async () => {
    await request(app.getHttpServer()).post('/api/coupons').send({}).expect(401);
    await request(app.getHttpServer()).get('/api/coupons').expect(401);
    await request(app.getHttpServer()).patch(`/api/coupons/${testCouponCode}`).send({}).expect(401);
    await request(app.getHttpServer()).delete(`/api/coupons/${testCouponCode}`).expect(401);
  });

  it('deve rejeitar operações administrativas se o usuário for cliente comum (retorna 403)', async () => {
    await request(app.getHttpServer())
      .post('/api/coupons')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        numeroDoCupom: testCouponCode,
        tipoCupom: 'fixo',
        valorDesconto: 10,
        dataInicio: '2026-05-20T00:00:00Z',
        dataFim: '2026-05-22T00:00:00Z',
      })
      .expect(403);

    await request(app.getHttpServer())
      .get('/api/coupons')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(403);
  });

  // --- TESTES DE CRUD FELIZ (ADMINISTRADOR) ---

  it('deve gerenciar cupons perfeitamente via CRUD (POST, GET, PATCH, DELETE) por um Administrador', async () => {
    // 1. Cadastrar (POST)
    const postRes = await request(app.getHttpServer())
      .post('/api/coupons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        numeroDoCupom: testCouponCode,
        tipoCupom: 'porcentagem',
        valorDesconto: 10,
        ativo: true,
        dataInicio: '2026-05-20T00:00:00.000Z',
        dataFim: '2026-05-30T00:00:00.000Z',
        usoMaximo: 50,
      })
      .expect(201);

    expect(postRes.body).toHaveProperty('numeroDoCupom', testCouponCode);
    expect(Number(postRes.body.valorDesconto)).toBe(10);
    expect(postRes.body).toHaveProperty('usosAtuais', 0);

    // 2. Listar Todos (GET /)
    const listRes = await request(app.getHttpServer())
      .get('/api/coupons')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(listRes.body.some((c: any) => c.numeroDoCupom === testCouponCode)).toBe(true);

    // 3. Atualizar Parcialmente (PATCH /:numero)
    const patchRes = await request(app.getHttpServer())
      .patch(`/api/coupons/${testCouponCode}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        valorDesconto: 15,
        nomeInfluenciador: 'Novo Influenciador',
      })
      .expect(200);

    expect(Number(patchRes.body.valorDesconto)).toBe(15);
    expect(patchRes.body.nomeInfluenciador).toBe('Novo Influenciador');

    // 4. Remover (DELETE /:numero)
    await request(app.getHttpServer())
      .delete(`/api/coupons/${testCouponCode}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    // 5. Confirmar que foi excluído
    await request(app.getHttpServer())
      .patch(`/api/coupons/${testCouponCode}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ valorDesconto: 20 })
      .expect(404);
  });

  // --- TESTES DE RELAÇÃO N:N COM PRODUTOS (POST/DELETE E SEGURANÇA) ---

  it('deve associar e desassociar produtos a um cupom com sucesso por um Administrador', async () => {
    // Criar cupom
    await couponsRepository.save({
      numeroDoCupom: testCouponCode,
      tipoCupom: 'fixo',
      valorDesconto: 10,
      ativo: true,
      dataInicio: new Date('2026-05-15T00:00:00Z'),
      dataFim: new Date('2026-05-30T00:00:00Z'),
    });

    // Associar produto (POST)
    await request(app.getHttpServer())
      .post(`/api/coupons/${testCouponCode}/products/${testProduct1.idProduto}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    // Verificar se relação foi gravada
    const couponWithProducts = await couponsRepository.findOne({
      where: { numeroDoCupom: testCouponCode },
      relations: { products: true },
    });
    expect(couponWithProducts?.products.some((p) => p.idProduto === testProduct1.idProduto)).toBe(
      true,
    );

    // Desassociar produto (DELETE)
    await request(app.getHttpServer())
      .delete(`/api/coupons/${testCouponCode}/products/${testProduct1.idProduto}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    // Verificar se relação foi removida
    const couponAfterDelete = await couponsRepository.findOne({
      where: { numeroDoCupom: testCouponCode },
      relations: { products: true },
    });
    expect(couponAfterDelete?.products.length).toBe(0);
  });

  it('deve rejeitar associação e desassociação de produtos se o usuário for um cliente', async () => {
    await request(app.getHttpServer())
      .post(`/api/coupons/${testCouponCode}/products/${testProduct1.idProduto}`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(403);
  });

  // --- TESTES DE VALIDAÇÃO PÚBLICA & REGRAS DE ELEGIBILIDADE DE PRODUTOS ---

  it('deve retornar valid: true para cupom sem associação com produtos (regra default) independente do pedido', async () => {
    await couponsRepository.save({
      numeroDoCupom: testCouponCode,
      tipoCupom: 'porcentagem',
      valorDesconto: 20.0,
      ativo: true,
      dataInicio: new Date('2026-05-15T00:00:00Z'),
      dataFim: new Date('2026-05-30T00:00:00Z'),
    });

    // Validar sem passar IDs
    const resSemIds = await request(app.getHttpServer())
      .get(`/api/coupons/validate/${testCouponCode}`)
      .expect(200);

    expect(resSemIds.body.valid).toBe(true);

    // Validar passando ID qualquer
    const resComIds = await request(app.getHttpServer())
      .get(`/api/coupons/validate/${testCouponCode}?productIds=${testProduct1.idProduto}`)
      .expect(200);

    expect(resComIds.body.valid).toBe(true);
  });

  it('deve validar cupom associado a produtos específicos somente se carrinho tiver ao menos um elegível (Critério de Aceite)', async () => {
    // 1. Criar cupom
    const coupon = await couponsRepository.save({
      numeroDoCupom: testCouponCode,
      tipoCupom: 'porcentagem',
      valorDesconto: 15.0,
      ativo: true,
      dataInicio: new Date('2026-05-15T00:00:00Z'),
      dataFim: new Date('2026-05-30T00:00:00Z'),
    });

    // 2. Associar apenas testProduct1
    coupon.products = [testProduct1];
    await couponsRepository.save(coupon);

    // Caso A: Carrinho não contém o produto elegível (passa testProduct2) -> Deve rejeitar!
    const resInvalido = await request(app.getHttpServer())
      .get(`/api/coupons/validate/${testCouponCode}?productIds=${testProduct2.idProduto}`)
      .expect(200);

    expect(resInvalido.body).toEqual({
      valid: false,
      reason: 'ineligible_products',
    });

    // Caso B: Carrinho não contém nenhum produto -> Deve rejeitar!
    const resVazio = await request(app.getHttpServer())
      .get(`/api/coupons/validate/${testCouponCode}`)
      .expect(200);

    expect(resVazio.body).toEqual({
      valid: false,
      reason: 'ineligible_products',
    });

    // Caso C: Carrinho contém testProduct1 (produto elegível único) -> Deve aprovar!
    const resValidoUnico = await request(app.getHttpServer())
      .get(`/api/coupons/validate/${testCouponCode}?productIds=${testProduct1.idProduto}`)
      .expect(200);

    expect(resValidoUnico.body).toEqual({
      valid: true,
      tipoCupom: 'porcentagem',
      valorDesconto: 15.0,
    });

    // Caso D: Carrinho contém múltiplos produtos incluindo pelo menos um elegível (testProduct2, testProduct1) -> Deve aprovar!
    const resValidoMultiplo = await request(app.getHttpServer())
      .get(
        `/api/coupons/validate/${testCouponCode}?productIds=${testProduct2.idProduto},${testProduct1.idProduto}`,
      )
      .expect(200);

    expect(resValidoMultiplo.body.valid).toBe(true);
  });

  // --- TESTES DE INFLUENCIADORES (NOME_INFLUENCIADOR, NULL/VAZIO E ENDPOINT) ---

  it('deve aceitar string vazia, opcional ou nula para nome_influenciador (Critério de Aceite)', async () => {
    // Caso 1: Nulo (null)
    const resNull = await request(app.getHttpServer())
      .post('/api/coupons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        numeroDoCupom: testCouponCode,
        tipoCupom: 'fixo',
        valorDesconto: 10,
        dataInicio: '2026-05-20T00:00:00Z',
        dataFim: '2026-05-22T00:00:00Z',
        nomeInfluenciador: null,
      })
      .expect(201);

    expect(resNull.body.nomeInfluenciador).toBeNull();

    // Limpar
    await couponsRepository.delete({ numeroDoCupom: testCouponCode });

    // Caso 2: Vazio ("")
    const resVazio = await request(app.getHttpServer())
      .post('/api/coupons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        numeroDoCupom: testCouponCode,
        tipoCupom: 'fixo',
        valorDesconto: 10,
        dataInicio: '2026-05-20T00:00:00Z',
        dataFim: '2026-05-22T00:00:00Z',
        nomeInfluenciador: '',
      })
      .expect(201);

    expect(resVazio.body.nomeInfluenciador).toBe('');
  });

  it('deve listar todos os cupons de um influenciador específico de forma insensível a maiúsculas/minúsculas (Critério de Aceite)', async () => {
    const influencerName = 'Influencer Legal';

    // Cadastrar cupom do influenciador
    await couponsRepository.save({
      numeroDoCupom: testCouponCode,
      tipoCupom: 'fixo',
      valorDesconto: 10,
      ativo: true,
      dataInicio: new Date('2026-05-15T00:00:00Z'),
      dataFim: new Date('2026-05-30T00:00:00Z'),
      nomeInfluenciador: influencerName,
    });

    // 1. Caso feliz: com nome correspondente exato
    const resExato = await request(app.getHttpServer())
      .get(`/api/coupons/by-influencer/${influencerName}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(resExato.body.length).toBe(1);
    expect(resExato.body[0].numeroDoCupom).toBe(testCouponCode);

    // 2. Caso insensível: com minúsculas
    const resMinusculo = await request(app.getHttpServer())
      .get(`/api/coupons/by-influencer/influencer legal`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(resMinusculo.body.length).toBe(1);

    // 3. Caso não existente: influenciador diferente
    const resDiferente = await request(app.getHttpServer())
      .get(`/api/coupons/by-influencer/Diferente`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(resDiferente.body.length).toBe(0);

    // 4. Segurança: tentar acessar sendo cliente
    await request(app.getHttpServer())
      .get(`/api/coupons/by-influencer/${influencerName}`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(403);
  });

  it('deve incrementar o uso do cupom de forma atômica no banco de dados (Refinamento Concorrência)', async () => {
    // 1. Criar cupom
    await couponsRepository.save({
      numeroDoCupom: testCouponCode,
      tipoCupom: 'fixo',
      valorDesconto: 10,
      ativo: true,
      dataInicio: new Date('2026-05-15T00:00:00Z'),
      dataFim: new Date('2026-05-30T00:00:00Z'),
      usosAtuais: 0,
    });

    // 2. Chamar incrementUsage
    await couponsService.incrementUsage(testCouponCode);

    // 3. Verificar se incrementou no banco
    const coupon = await couponsRepository.findOne({
      where: { numeroDoCupom: testCouponCode },
    });
    expect(coupon?.usosAtuais).toBe(1);

    // 4. Chamar de novo
    await couponsService.incrementUsage(testCouponCode);

    const coupon2 = await couponsRepository.findOne({
      where: { numeroDoCupom: testCouponCode },
    });
    expect(coupon2?.usosAtuais).toBe(2);

    // 5. Testar lançar erro para cupom inexistente
    await expect(couponsService.incrementUsage('INEXISTENTE')).rejects.toThrow();
  });

  // --- TESTES DE VALIDAÇÃO DE TIPO E LIMITE DE PORCENTAGEM (REFINAMENTOS) ---

  it('deve rejeitar a criação de cupom com tipoCupom inválido (diferente de fixo ou porcentagem)', async () => {
    await request(app.getHttpServer())
      .post('/api/coupons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        numeroDoCupom: testCouponCode,
        tipoCupom: 'outro_tipo',
        valorDesconto: 10,
        ativo: true,
        dataInicio: '2026-05-20T00:00:00Z',
        dataFim: '2026-05-30T00:00:00Z',
      })
      .expect(400);
  });

  it('deve rejeitar a criação de cupom do tipo porcentagem com desconto maior que 100%', async () => {
    await request(app.getHttpServer())
      .post('/api/coupons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        numeroDoCupom: testCouponCode,
        tipoCupom: 'porcentagem',
        valorDesconto: 120,
        ativo: true,
        dataInicio: '2026-05-20T00:00:00Z',
        dataFim: '2026-05-30T00:00:00Z',
      })
      .expect(400);
  });

  it('deve rejeitar a atualização de um cupom se violar o limite de porcentagem ou o tipo de cupom', async () => {
    // Criar um cupom válido do tipo fixo primeiro
    await couponsRepository.save({
      numeroDoCupom: testCouponCode,
      tipoCupom: 'fixo',
      valorDesconto: 50,
      ativo: true,
      dataInicio: new Date('2026-05-15T00:00:00Z'),
      dataFim: new Date('2026-05-30T00:00:00Z'),
    });

    // 1. Tentar atualizar para tipoCupom inválido
    await request(app.getHttpServer())
      .patch(`/api/coupons/${testCouponCode}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        tipoCupom: 'invalido',
      })
      .expect(400);

    // 2. Tentar atualizar tipoCupom para porcentagem mantendo valorDesconto 50 (válido, pois <= 100)
    await request(app.getHttpServer())
      .patch(`/api/coupons/${testCouponCode}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        tipoCupom: 'porcentagem',
      })
      .expect(200);

    // 3. Tentar atualizar valorDesconto para 150 (violando limite, pois agora o tipo é porcentagem)
    await request(app.getHttpServer())
      .patch(`/api/coupons/${testCouponCode}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        valorDesconto: 150,
      })
      .expect(400);

    // 4. Tentar atualizar ambos ao mesmo tempo violando limite
    await request(app.getHttpServer())
      .patch(`/api/coupons/${testCouponCode}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        tipoCupom: 'porcentagem',
        valorDesconto: 110,
      })
      .expect(400);
  });
});
