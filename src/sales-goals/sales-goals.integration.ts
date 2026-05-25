import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';

import { AppModule } from '../app.module';
import { SalesGoal } from './entities/sales-goal.entity';
import { Employee } from '../employees/entities/employee.entity';
import { Order, OrderStatus, TipoRetirada } from '../orders/entities/order.entity';
import { Person } from '../people/entities/person.entity';

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

describe('SalesGoalsModule Integration - Schema and API', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let salesGoalsRepository: Repository<SalesGoal>;
  let employeeRepository: Repository<Employee>;
  let peopleRepository: Repository<Person>;
  let ordersRepository: Repository<Order>;
  let jwtService: JwtService;

  const testEmployeeCpf = '12345678901';
  let adminToken: string;
  let clientToken: string;

  beforeAll(async () => {
    loadDevelopmentEnv();

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ZodValidationPipe());
    app.setGlobalPrefix('api');
    await app.init();

    salesGoalsRepository = moduleRef.get(getRepositoryToken(SalesGoal));
    employeeRepository = moduleRef.get(getRepositoryToken(Employee));
    peopleRepository = moduleRef.get(getRepositoryToken(Person));
    ordersRepository = moduleRef.get(getRepositoryToken(Order));
    jwtService = moduleRef.get<JwtService>(JwtService);

    // Generate Tokens
    adminToken = jwtService.sign({
      sub: '00000000000',
      email: 'admin@example.com',
      role: 'administrador',
    });

    clientToken = jwtService.sign({
      sub: '11111111111',
      email: 'client@example.com',
      role: 'cliente',
    });
  });

  beforeEach(async () => {
    // Clean database
    await salesGoalsRepository.createQueryBuilder().delete().execute();
    await ordersRepository.createQueryBuilder().delete().execute();
    await employeeRepository.createQueryBuilder().delete().execute();
    await peopleRepository.delete({ cpf: testEmployeeCpf });

    // Seed Person and Employee Vendedor
    await peopleRepository.save({
      cpf: testEmployeeCpf,
      nome: 'Vendedor Metas',
      email: 'vendedor_metas@example.com',
      telefone: '11999999999',
      senha: 'hashed_password',
    });

    await employeeRepository.save({
      cpf: testEmployeeCpf,
      ativo: true,
      role_perfil: 'vendedor' as any,
      taxa_comissao: 0.025,
      codigo_funcionario: 'VEND-GOAL',
    });
  });

  afterAll(async () => {
    if (app) {
      await salesGoalsRepository.createQueryBuilder().delete().execute();
      await ordersRepository.createQueryBuilder().delete().execute();
      await employeeRepository.createQueryBuilder().delete().execute();
      await peopleRepository.delete({ cpf: testEmployeeCpf });
      await app.close();
    }
  });

  // --- SECURITY TESTS ---

  it('deve rejeitar criação de meta se não autenticado (retorna 401)', async () => {
    await request(app.getHttpServer())
      .post('/api/sales-goals')
      .send({
        cpfFuncionario: testEmployeeCpf,
        mes: 5,
        ano: 2026,
        valorMeta: 50000.0,
      })
      .expect(401);
  });

  it('deve rejeitar criação de meta se autenticado como cliente comum (retorna 403)', async () => {
    await request(app.getHttpServer())
      .post('/api/sales-goals')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        cpfFuncionario: testEmployeeCpf,
        mes: 5,
        ano: 2026,
        valorMeta: 50000.0,
      })
      .expect(403);
  });

  // --- CRUD AND CONSTRAINT TESTS ---

  it('deve cadastrar meta individual com sucesso por um Administrador (retorna 201) (Critério de Aceite)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/sales-goals')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        cpfFuncionario: testEmployeeCpf,
        mes: 5,
        ano: 2026,
        valorMeta: 50000.0,
        taxaComissaoBonus: 0.015,
      })
      .expect(201);

    expect(res.body.idGoal).toBeDefined();
    expect(res.body.cpfFuncionario).toBe(testEmployeeCpf);
    expect(res.body.mes).toBe(5);
    expect(res.body.ano).toBe(2026);
    expect(Number(res.body.valorMeta)).toBe(50000.0);
    expect(Number(res.body.taxaComissaoBonus)).toBe(0.015);
  });

  it('deve cadastrar meta coletiva com sucesso (CPF nulo) por um Administrador (retorna 201)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/sales-goals')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        mes: 5,
        ano: 2026,
        valorMeta: 200000.0,
      })
      .expect(201);

    expect(res.body.idGoal).toBeDefined();
    expect(res.body.cpfFuncionario).toBeNull();
    expect(res.body.mes).toBe(5);
    expect(res.body.ano).toBe(2026);
    expect(Number(res.body.valorMeta)).toBe(200000.0);
  });

  it('deve rejeitar duas metas para o mesmo funcionário no mesmo mês/ano (retorna 409) (Critério de Aceite)', async () => {
    // 1. Cadastrar primeira meta
    await request(app.getHttpServer())
      .post('/api/sales-goals')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        cpfFuncionario: testEmployeeCpf,
        mes: 5,
        ano: 2026,
        valorMeta: 50000.0,
      })
      .expect(201);

    // 2. Tentar cadastrar segunda meta para o mesmo funcionário no mesmo mês e ano (deve retornar 409)
    const conflictRes = await request(app.getHttpServer())
      .post('/api/sales-goals')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        cpfFuncionario: testEmployeeCpf,
        mes: 5,
        ano: 2026,
        valorMeta: 75000.0,
      })
      .expect(409);

    expect(conflictRes.body.message).toContain('Já existe uma meta cadastrada para o funcionário');
  });

  it('deve rejeitar duas metas coletivas para o mesmo período (retorna 409)', async () => {
    // 1. Cadastrar primeira meta coletiva
    await request(app.getHttpServer())
      .post('/api/sales-goals')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        mes: 5,
        ano: 2026,
        valorMeta: 200000.0,
      })
      .expect(201);

    // 2. Tentar cadastrar segunda meta coletiva no mesmo período (deve retornar 409)
    await request(app.getHttpServer())
      .post('/api/sales-goals')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        mes: 5,
        ano: 2026,
        valorMeta: 300000.0,
      })
      .expect(409);
  });

  it('deve retornar 404 se tentar cadastrar meta para funcionário inexistente', async () => {
    await request(app.getHttpServer())
      .post('/api/sales-goals')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        cpfFuncionario: '99999999999',
        mes: 5,
        ano: 2026,
        valorMeta: 50000.0,
      })
      .expect(404);
  });

  it('deve rejeitar DTO se o mês for fora de 1-12 ou o ano for negativo', async () => {
    await request(app.getHttpServer())
      .post('/api/sales-goals')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        cpfFuncionario: testEmployeeCpf,
        mes: 13, // Inválido
        ano: 2026,
        valorMeta: 50000.0,
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/sales-goals')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        cpfFuncionario: testEmployeeCpf,
        mes: 5,
        ano: -2026, // Inválido
        valorMeta: 50000.0,
      })
      .expect(400);
  });

  // --- LIST (GET) TESTS ---

  it('deve listar todas as metas para o Administrador', async () => {
    // 1. Criar meta individual e coletiva
    await salesGoalsRepository.save([
      { cpfFuncionario: testEmployeeCpf, mes: 5, ano: 2026, valorMeta: 50000 },
      { cpfFuncionario: null, mes: 6, ano: 2026, valorMeta: 150000 },
    ]);

    // 2. Buscar listagem
    const res = await request(app.getHttpServer())
      .get('/api/sales-goals')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.length).toBe(2);
  });

  it('deve listar metas aplicando filtros de mes e ano', async () => {
    await salesGoalsRepository.save([
      { cpfFuncionario: testEmployeeCpf, mes: 5, ano: 2026, valorMeta: 50000 },
      { cpfFuncionario: null, mes: 6, ano: 2026, valorMeta: 150000 },
    ]);

    const res = await request(app.getHttpServer())
      .get('/api/sales-goals?mes=5&ano=2026')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.length).toBe(1);
    expect(res.body[0].cpfFuncionario).toBe(testEmployeeCpf);
    expect(res.body[0].mes).toBe(5);
  });

  it('deve rejeitar listagem (GET) para não-administrador', async () => {
    await request(app.getHttpServer())
      .get('/api/sales-goals')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(403);
  });

  // --- UPDATE (PATCH) TESTS ---

  it('deve atualizar meta com sucesso por um Administrador', async () => {
    const goal = await salesGoalsRepository.save({
      cpfFuncionario: testEmployeeCpf,
      mes: 5,
      ano: 2026,
      valorMeta: 50000,
    });

    const res = await request(app.getHttpServer())
      .patch(`/api/sales-goals/${goal.idGoal}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        valorMeta: 60000.0,
        taxaComissaoBonus: 0.02,
      })
      .expect(200);

    expect(Number(res.body.valorMeta)).toBe(60000.0);
    expect(Number(res.body.taxaComissaoBonus)).toBe(0.02);
  });

  it('deve rejeitar atualização para funcionário inexistente', async () => {
    const goal = await salesGoalsRepository.save({
      cpfFuncionario: testEmployeeCpf,
      mes: 5,
      ano: 2026,
      valorMeta: 50000,
    });

    await request(app.getHttpServer())
      .patch(`/api/sales-goals/${goal.idGoal}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        cpfFuncionario: '99999999999',
      })
      .expect(404);
  });

  it('deve rejeitar atualização que cause duplicidade de período para o funcionário', async () => {
    // Criar duas metas
    await salesGoalsRepository.save({
      cpfFuncionario: testEmployeeCpf,
      mes: 5,
      ano: 2026,
      valorMeta: 50000,
    });

    const goal2 = await salesGoalsRepository.save({
      cpfFuncionario: testEmployeeCpf,
      mes: 6,
      ano: 2026,
      valorMeta: 70000,
    });

    // Tentar atualizar a meta 2 para o mês da meta 1 (5/2026) -> deve retornar 409
    await request(app.getHttpServer())
      .patch(`/api/sales-goals/${goal2.idGoal}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        mes: 5,
      })
      .expect(409);
  });

  it('deve rejeitar atualização (PATCH) para não-administrador', async () => {
    const goal = await salesGoalsRepository.save({
      cpfFuncionario: testEmployeeCpf,
      mes: 5,
      ano: 2026,
      valorMeta: 50000,
    });

    await request(app.getHttpServer())
      .patch(`/api/sales-goals/${goal.idGoal}`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        valorMeta: 60000,
      })
      .expect(403);
  });

  // --- DELETE TESTS ---

  it('deve deletar meta com sucesso por um Administrador', async () => {
    const goal = await salesGoalsRepository.save({
      cpfFuncionario: testEmployeeCpf,
      mes: 5,
      ano: 2026,
      valorMeta: 50000,
    });

    await request(app.getHttpServer())
      .delete(`/api/sales-goals/${goal.idGoal}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    const check = await salesGoalsRepository.findOne({ where: { idGoal: goal.idGoal } });
    expect(check).toBeNull();
  });

  it('deve retornar 404 ao tentar deletar meta inexistente', async () => {
    await request(app.getHttpServer())
      .delete('/api/sales-goals/9999')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('deve rejeitar exclusão (DELETE) para não-administrador', async () => {
    const goal = await salesGoalsRepository.save({
      cpfFuncionario: testEmployeeCpf,
      mes: 5,
      ano: 2026,
      valorMeta: 50000,
    });

    await request(app.getHttpServer())
      .delete(`/api/sales-goals/${goal.idGoal}`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(403);
  });

  // --- PROGRESS (GET /api/sales-goals/progress) TESTS ---

  it('deve rejeitar acesso ao progresso se não for Administrador (403)', async () => {
    await request(app.getHttpServer())
      .get('/api/sales-goals/progress')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get('/api/sales-goals/progress/team')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(403);
  });

  it('deve calcular corretamente o progresso das metas individuais (GET /api/sales-goals/progress)', async () => {
    // 1. Cadastrar meta individual (meta: 1000.0) em Maio de 2026
    await salesGoalsRepository.save({
      cpfFuncionario: testEmployeeCpf,
      mes: 5,
      ano: 2026,
      valorMeta: 1000.0,
    });

    // 2. Criar vendas faturadas no período para o vendedor (total: 500.0)
    await ordersRepository.save({
      idFuncionario: testEmployeeCpf,
      status: OrderStatus.PAID,
      tipoRetirada: TipoRetirada.LOJA,
      subtotal: 500.0,
      valorFrete: 0,
      valorTotal: 500.0,
      dataPedido: new Date('2026-05-15T12:00:00Z'),
    });

    // 3. Buscar progresso das metas individuais
    const res = await request(app.getHttpServer())
      .get('/api/sales-goals/progress?mes=5&ano=2026')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.length).toBe(1);
    expect(res.body[0].funcionario.cpf).toBe(testEmployeeCpf);
    expect(Number(res.body[0].meta)).toBe(1000.0);
    expect(Number(res.body[0].realizado)).toBe(500.0);
    expect(Number(res.body[0].percentual)).toBe(50.0); // 500 / 1000 * 100
  });

  it('deve calcular corretamente o progresso da meta coletiva (GET /api/sales-goals/progress/team)', async () => {
    // 1. Cadastrar meta coletiva (meta: 5000.0) em Maio de 2026
    await salesGoalsRepository.save({
      cpfFuncionario: null,
      mes: 5,
      ano: 2026,
      valorMeta: 5000.0,
    });

    // 2. Criar vendas faturadas no período (total: 2000.0)
    await ordersRepository.save([
      {
        idFuncionario: testEmployeeCpf,
        status: OrderStatus.PAID,
        tipoRetirada: TipoRetirada.LOJA,
        subtotal: 1200.0,
        valorFrete: 0,
        valorTotal: 1200.0,
        dataPedido: new Date('2026-05-15T12:00:00Z'),
      },
      {
        idFuncionario: testEmployeeCpf,
        status: OrderStatus.DELIVERED,
        tipoRetirada: TipoRetirada.LOJA,
        subtotal: 800.0,
        valorFrete: 0,
        valorTotal: 800.0,
        dataPedido: new Date('2026-05-25T15:00:00Z'),
      },
    ]);

    // 3. Buscar progresso coletivo
    const res = await request(app.getHttpServer())
      .get('/api/sales-goals/progress/team?mes=5&ano=2026')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Number(res.body.meta)).toBe(5000.0);
    expect(Number(res.body.realizado)).toBe(2000.0);
    expect(Number(res.body.percentual)).toBe(40.0); // 2000 / 5000 * 100
  });

  it('deve excluir automaticamente a meta individual quando o funcionário associado for deletado (CASCADE)', async () => {
    // 1. Cadastrar meta individual para o vendedor
    const goal = await salesGoalsRepository.save({
      cpfFuncionario: testEmployeeCpf,
      mes: 5,
      ano: 2026,
      valorMeta: 1000.0,
    });

    // 2. Deletar o funcionário
    await employeeRepository.delete({ cpf: testEmployeeCpf });

    // 3. Confirmar que a meta foi automaticamente excluída via CASCADE
    const check = await salesGoalsRepository.findOne({ where: { idGoal: goal.idGoal } });
    expect(check).toBeNull();
  });
});
