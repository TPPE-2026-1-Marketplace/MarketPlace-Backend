import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';

import { AppModule } from '../app.module';
import { EmployeesService } from './employees.service';
import { Employee } from './entities/employee.entity';
import { Order, OrderStatus, TipoRetirada } from '../orders/entities/order.entity';
import { Person } from '../people/entities/person.entity';
import { SalesGoal } from '../sales-goals/entities/sales-goal.entity';

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

describe('EmployeesCommission Integration Tests', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let employeesService: EmployeesService;
  let employeesRepository: Repository<Employee>;
  let peopleRepository: Repository<Person>;
  let ordersRepository: Repository<Order>;
  let salesGoalsRepository: Repository<SalesGoal>;
  let jwtService: JwtService;

  let caixaToken: string;
  let clientToken: string;

  const vendedorCpf = '22222222222';
  const outroVendedorCpf = '33333333333';

  beforeAll(async () => {
    loadDevelopmentEnv();

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ZodValidationPipe());
    app.setGlobalPrefix('api');
    await app.init();

    employeesService = moduleRef.get<EmployeesService>(EmployeesService);
    employeesRepository = moduleRef.get(getRepositoryToken(Employee));
    peopleRepository = moduleRef.get(getRepositoryToken(Person));
    ordersRepository = moduleRef.get(getRepositoryToken(Order));
    salesGoalsRepository = moduleRef.get(getRepositoryToken(SalesGoal));
    jwtService = moduleRef.get<JwtService>(JwtService);

    // Generate tokens

    caixaToken = jwtService.sign({
      sub: '44444444444',
      email: 'caixa@example.com',
      role: 'caixa',
    });

    clientToken = jwtService.sign({
      sub: '55555555555',
      email: 'cliente@example.com',
      role: 'cliente',
    });
  });

  beforeEach(async () => {
    // Limpar tabelas
    await salesGoalsRepository.createQueryBuilder().delete().execute();
    await ordersRepository.createQueryBuilder().delete().execute();
    await employeesRepository.createQueryBuilder().delete().execute();
    await peopleRepository.delete({ cpf: vendedorCpf });
    await peopleRepository.delete({ cpf: outroVendedorCpf });

    // Seed Vendedor Principal
    await peopleRepository.save({
      cpf: vendedorCpf,
      nome: 'Vendedor Comissoes',
      email: 'comissoes@example.com',
      senha: 'hashed_password',
    });

    await employeesRepository.save({
      cpf: vendedorCpf,
      ativo: true,
      role_perfil: 'vendedor' as any,
      taxa_comissao: 0.025, // 2.5%
      codigo_funcionario: 'VEND-COM1',
    });

    // Seed Outro Vendedor
    await peopleRepository.save({
      cpf: outroVendedorCpf,
      nome: 'Outro Vendedor',
      email: 'outro_vendedor@example.com',
      senha: 'hashed_password',
    });

    await employeesRepository.save({
      cpf: outroVendedorCpf,
      ativo: true,
      role_perfil: 'vendedor' as any,
      taxa_comissao: 0.025,
      codigo_funcionario: 'VEND-COM2',
    });
  });

  afterAll(async () => {
    if (app) {
      await salesGoalsRepository.createQueryBuilder().delete().execute();
      await ordersRepository.createQueryBuilder().delete().execute();
      await employeesRepository.createQueryBuilder().delete().execute();
      await peopleRepository.delete({ cpf: vendedorCpf });
      await peopleRepository.delete({ cpf: outroVendedorCpf });
      await app.close();
    }
  });

  it('deve somar corretamente vendas presenciais de um vendedor no mês especificado (getSalesByEmployee)', async () => {
    // 1. Pedidos do vendedor principal em Maio de 2026 (devem somar)
    await ordersRepository.save([
      {
        idFuncionario: vendedorCpf,
        status: OrderStatus.PAID,
        tipoRetirada: TipoRetirada.LOJA,
        subtotal: 500.0,
        valorFrete: 0,
        valorTotal: 500.0,
        dataPedido: new Date('2026-05-10T14:30:00Z'),
      },
      {
        idFuncionario: vendedorCpf,
        status: OrderStatus.DELIVERED,
        tipoRetirada: TipoRetirada.LOJA,
        subtotal: 1000.0,
        valorFrete: 0,
        valorTotal: 1000.0,
        dataPedido: new Date('2026-05-25T10:00:00Z'),
      },
    ]);

    // 2. Pedidos que NÃO devem ser somados
    await ordersRepository.save([
      // Outro mês (Junho 2026)
      {
        idFuncionario: vendedorCpf,
        status: OrderStatus.PAID,
        tipoRetirada: TipoRetirada.LOJA,
        subtotal: 800.0,
        valorFrete: 0,
        valorTotal: 800.0,
        dataPedido: new Date('2026-06-01T09:00:00Z'),
      },
      // Outro vendedor
      {
        idFuncionario: outroVendedorCpf,
        status: OrderStatus.PAID,
        tipoRetirada: TipoRetirada.LOJA,
        subtotal: 400.0,
        valorFrete: 0,
        valorTotal: 400.0,
        dataPedido: new Date('2026-05-15T12:00:00Z'),
      },
      // Status pendente (não pago)
      {
        idFuncionario: vendedorCpf,
        status: OrderStatus.PENDING,
        tipoRetirada: TipoRetirada.LOJA,
        subtotal: 2000.0,
        valorFrete: 0,
        valorTotal: 2000.0,
        dataPedido: new Date('2026-05-20T16:00:00Z'),
      },
      // Venda online (idFuncionario nulo)
      {
        idFuncionario: null,
        status: OrderStatus.PAID,
        tipoRetirada: TipoRetirada.ENTREGA,
        subtotal: 300.0,
        valorFrete: 20.0,
        valorTotal: 320.0,
        dataPedido: new Date('2026-05-18T11:00:00Z'),
      },
    ]);

    // Executar soma
    const result = await employeesService.getSalesByEmployee(vendedorCpf, 5, 2026);

    expect(result.total).toBe(1500.0);
    expect(result.pedidos.length).toBe(2);
  });

  it('deve calcular comissão base de 2,5% quando nenhuma meta foi atingida (calculateCommission)', async () => {
    // Venda de 1000.0 no mês
    await ordersRepository.save({
      idFuncionario: vendedorCpf,
      status: OrderStatus.PAID,
      tipoRetirada: TipoRetirada.LOJA,
      subtotal: 1000.0,
      valorFrete: 0,
      valorTotal: 1000.0,
      dataPedido: new Date('2026-05-15T12:00:00Z'),
    });

    // Sem meta cadastrada no período (ou meta não batida)
    const result = await employeesService.calculateCommission(vendedorCpf, 5, 2026);

    expect(result.total_vendas).toBe(1000.0);
    expect(result.comissao).toBe(25.0); // 1000.0 * 2.5%
    expect(result.meta_batida).toBe(false);
  });

  it('deve aplicar comissão com taxa de bônus adicional quando a meta individual for atingida', async () => {
    // Venda de 1500.0 no mês
    await ordersRepository.save({
      idFuncionario: vendedorCpf,
      status: OrderStatus.PAID,
      tipoRetirada: TipoRetirada.LOJA,
      subtotal: 1500.0,
      valorFrete: 0,
      valorTotal: 1500.0,
      dataPedido: new Date('2026-05-15T12:00:00Z'),
    });

    // Cadastrar meta individual batida (meta 1000.0, bônus 1.5% = 0.015)
    await salesGoalsRepository.save({
      cpfFuncionario: vendedorCpf,
      mes: 5,
      ano: 2026,
      valorMeta: 1000.0,
      taxaComissaoBonus: 0.015,
    });

    const result = await employeesService.calculateCommission(vendedorCpf, 5, 2026);

    expect(result.total_vendas).toBe(1500.0);
    expect(result.meta_batida).toBe(true);
    // Comissão = 1500.0 * (2.5% + 1.5%) = 1500.0 * 4.0% = 60.0
    expect(result.comissao).toBe(60.0);
  });

  it('deve aplicar comissão com taxa de bônus da meta coletiva caso não haja meta individual', async () => {
    // Venda de 1500.0 no mês
    await ordersRepository.save({
      idFuncionario: vendedorCpf,
      status: OrderStatus.PAID,
      tipoRetirada: TipoRetirada.LOJA,
      subtotal: 1500.0,
      valorFrete: 0,
      valorTotal: 1500.0,
      dataPedido: new Date('2026-05-15T12:00:00Z'),
    });

    // Cadastrar meta coletiva (meta 1200.0, bônus 2.0% = 0.02)
    await salesGoalsRepository.save({
      cpfFuncionario: null,
      mes: 5,
      ano: 2026,
      valorMeta: 1200.0,
      taxaComissaoBonus: 0.02,
    });

    const result = await employeesService.calculateCommission(vendedorCpf, 5, 2026);

    expect(result.total_vendas).toBe(1500.0);
    expect(result.meta_batida).toBe(true);
    // Comissão = 1500.0 * (2.5% + 2.0%) = 1500.0 * 4.5% = 67.5
    expect(result.comissao).toBe(67.5);
  });

  // --- RANKING (GET /api/employees/ranking) TESTS ---

  it('deve rejeitar acesso ao ranking de vendedores se não autenticado (401)', async () => {
    await request(app.getHttpServer()).get('/api/employees/ranking').expect(401);
  });

  it('deve rejeitar acesso ao ranking de vendedores para cliente comum (403)', async () => {
    await request(app.getHttpServer())
      .get('/api/employees/ranking')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(403);
  });

  it('deve retornar ranking ordenado por total de vendas decrescente para perfil caixa+', async () => {
    // 1. Criar vendas presenciais para o vendedor 1 (total: 1200.0) em Maio de 2026
    await ordersRepository.save({
      idFuncionario: vendedorCpf,
      status: OrderStatus.PAID,
      tipoRetirada: TipoRetirada.LOJA,
      subtotal: 1200.0,
      valorFrete: 0,
      valorTotal: 1200.0,
      dataPedido: new Date('2026-05-10T12:00:00Z'),
    });

    // Outro vendedor com 0 vendas no mês (já cadastrado no beforeEach, mas sem pedidos)

    // 2. Chamar ranking como Caixa
    const res = await request(app.getHttpServer())
      .get('/api/employees/ranking?mes=5&ano=2026')
      .set('Authorization', `Bearer ${caixaToken}`)
      .expect(200);

    expect(res.body.length).toBe(2); // Vendedor Principal e Outro Vendedor (ambos com role vendedor)

    // Vendedor Principal deve estar na 1ª posição com total_vendas = 1200.0
    expect(res.body[0].codigo_funcionario).toBe('VEND-COM1');
    expect(Number(res.body[0].total_vendas)).toBe(1200.0);
    expect(res.body[0].posicao).toBe(1);

    // Outro Vendedor com 0 vendas deve estar na última posição (2ª) com total_vendas = 0
    expect(res.body[1].codigo_funcionario).toBe('VEND-COM2');
    expect(Number(res.body[1].total_vendas)).toBe(0.0);
    expect(res.body[1].posicao).toBe(2);
  });
});
