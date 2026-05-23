import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';

import { AppModule } from '../app.module';
import { Person } from './entities/person.entity';
import { Role } from '../common/enums/role.enum';
import { Employee } from '../employees/entities/employee.entity';

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

describe('PeopleModule CSV Export integration', () => {
  jest.setTimeout(30000);

  let app: INestApplication;
  let moduleRef: TestingModule;
  let peopleRepository: Repository<Person>;
  let employeeRepository: Repository<Employee>;
  let jwtService: JwtService;

  const testCpf = '99999999999';
  const testEmployeeCpf = '88888888888';
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

    peopleRepository = moduleRef.get(getRepositoryToken(Person));
    employeeRepository = moduleRef.get(getRepositoryToken(Employee));
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
  });

  beforeEach(async () => {
    // Limpar pessoas de teste anteriores
    await employeeRepository.delete({ cpf: testEmployeeCpf });
    await peopleRepository.delete({ cpf: testCpf });
    await peopleRepository.delete({ cpf: testEmployeeCpf });

    // Cadastrar cliente de teste
    await peopleRepository.save({
      cpf: testCpf,
      nome: 'Cliente Export Teste',
      email: 'export_teste@example.com',
      telefone: '11999999999',
      senha: 'hashed_password_that_must_never_be_in_csv',
    });

    // Cadastrar funcionário de teste para garantir que NÃO é exportado
    await peopleRepository.save({
      cpf: testEmployeeCpf,
      nome: 'Funcionario Export Teste',
      email: 'funcionario_teste@example.com',
      telefone: '11888888888',
      senha: 'hashed_password_for_employee',
    });
    await employeeRepository.save({
      cpf: testEmployeeCpf,
      ativo: true,
      role_perfil: Role.CAIXA,
      taxa_comissao: 0.025,
      meta_vendas: 1000.0,
      codigo_funcionario: 'EMP-TEST-999',
    });
  });

  afterAll(async () => {
    if (employeeRepository) {
      await employeeRepository.delete({ cpf: testEmployeeCpf });
    }
    if (peopleRepository) {
      await peopleRepository.delete({ cpf: testCpf });
      await peopleRepository.delete({ cpf: testEmployeeCpf });
    }
    if (app) {
      await app.close();
    }
  });

  it('deve rejeitar acesso ao endpoint de exportação se não autenticado (retorna 401) (Critério de Aceite)', async () => {
    await request(app.getHttpServer()).get('/api/people/export').expect(401);
  });

  it('deve rejeitar acesso ao endpoint de exportação se não for administrador (retorna 403)', async () => {
    await request(app.getHttpServer())
      .get('/api/people/export')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(403);
  });

  it('deve exportar a base de clientes em formato CSV para Administradores (Critério de Aceite)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/people/export')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // 1. Verificar cabeçalhos de resposta HTTP
    expect(res.header['content-type']).toContain('text/csv');
    expect(res.header['content-disposition']).toContain('attachment');
    expect(res.header['content-disposition']).toContain('filename="clientes.csv"');

    // 2. Verificar conteúdo do arquivo CSV
    const csvContent = res.text;

    // Deve conter o cabeçalho correto
    expect(csvContent).toContain('email,nome,telefone,cpf');

    // Deve conter os dados do cliente cadastrado
    expect(csvContent).toContain('export_teste@example.com');
    expect(csvContent).toContain('Cliente Export Teste');
    expect(csvContent).toContain('11999999999');
    expect(csvContent).toContain(testCpf);

    // NUNCA deve conter dados de funcionários (apenas clientes reais)
    expect(csvContent).not.toContain('funcionario_teste@example.com');
    expect(csvContent).not.toContain('Funcionario Export Teste');
    expect(csvContent).not.toContain(testEmployeeCpf);

    // NUNCA deve expor senhas ou hashes de senhas (Critério de Aceite)
    expect(csvContent).not.toContain('hashed_password_that_must_never_be_in_csv');
  });
});
