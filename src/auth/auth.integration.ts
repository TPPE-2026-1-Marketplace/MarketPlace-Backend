import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';

import { AppModule } from '../app.module';
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

/**
 * Fluxo de autenticação (US02 / issue #84): registrar → login → acessar rota
 * protegida → rejeitar request sem token. Rota protegida usada: GET /api/people/:cpf
 * (apenas JwtAuthGuard — qualquer usuário autenticado serve, inclusive cliente).
 */
describe('Auth flow (US02) integration', () => {
  jest.setTimeout(30000);

  let app: INestApplication;
  let moduleRef: TestingModule;
  let peopleRepository: Repository<Person>;

  const user = {
    cpf: '70000000001',
    email: 'auth_flow@example.com',
    senha: 'senhaSegura123',
    nome: 'Auth Flow',
  };
  const newUser = {
    cpf: '70000000002',
    email: 'auth_flow_new@example.com',
    senha: 'outraSenha123',
    nome: 'Novo Cadastro',
  };

  function login(email: string, senha: string) {
    return request(app.getHttpServer()).post('/api/auth/login').send({ email, senha });
  }

  beforeAll(async () => {
    loadDevelopmentEnv();

    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ZodValidationPipe());
    app.setGlobalPrefix('api');
    await app.init();

    peopleRepository = moduleRef.get(getRepositoryToken(Person));

    await peopleRepository.delete({ cpf: user.cpf });
    await peopleRepository.delete({ cpf: newUser.cpf });

    // Usuário base usado pelos testes de login e rota protegida.
    await request(app.getHttpServer()).post('/api/people/register-user').send(user).expect(201);
  });

  afterAll(async () => {
    if (peopleRepository) {
      await peopleRepository.delete({ cpf: user.cpf });
      await peopleRepository.delete({ cpf: newUser.cpf });
    }
    if (app) {
      await app.close();
    }
  });

  it('registra um novo usuário pelo auto-cadastro (201) e nunca persiste a senha em texto plano', async () => {
    await request(app.getHttpServer()).post('/api/people/register-user').send(newUser).expect(201);

    const persisted = await peopleRepository.findOne({ where: { cpf: newUser.cpf } });
    expect(persisted).not.toBeNull();
    expect(persisted?.email).toBe(newUser.email);
    expect(persisted?.senha).toBeTruthy();
    expect(persisted?.senha).not.toBe(newUser.senha);
  });

  it('rejeita auto-cadastro com email já existente (409)', async () => {
    await request(app.getHttpServer()).post('/api/people/register-user').send(user).expect(409);
  });

  it('faz login com credenciais corretas e retorna um access_token', async () => {
    const res = await login(user.email, user.senha).expect(200);
    expect(typeof res.body.access_token).toBe('string');
    expect(res.body.access_token.length).toBeGreaterThan(0);
  });

  it('rejeita login com senha incorreta (401)', async () => {
    await login(user.email, 'senhaErrada123').expect(401);
  });

  it('acessa uma rota protegida com o token obtido no login (200)', async () => {
    const loginRes = await login(user.email, user.senha).expect(200);
    const token = loginRes.body.access_token;

    await request(app.getHttpServer())
      .get(`/api/people/${user.cpf}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('rejeita a rota protegida sem token (401)', async () => {
    await request(app.getHttpServer()).get(`/api/people/${user.cpf}`).expect(401);
  });

  it('rejeita a rota protegida com token inválido (401)', async () => {
    await request(app.getHttpServer())
      .get(`/api/people/${user.cpf}`)
      .set('Authorization', 'Bearer token-invalido')
      .expect(401);
  });
});
