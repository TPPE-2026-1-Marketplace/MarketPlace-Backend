import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { THROTTLE_AUTH, THROTTLE_DEFAULT } from '../common/config/throttle.config';

import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';

describe('AuthController rate limiting (#156)', () => {
  let app: INestApplication;
  const authService = { login: jest.fn().mockResolvedValue({ access_token: 'token' }) };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([THROTTLE_DEFAULT])],
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const LIMIT = THROTTLE_AUTH.default.limit;
  const payload = { email: 'alvo@teste.local', senha: 'qualquer' };

  it(`libera as primeiras ${LIMIT} requisições de login`, async () => {
    for (let i = 0; i < LIMIT; i++) {
      await request(app.getHttpServer()).post('/auth/login').send(payload).expect(200);
    }
  });

  it('retorna 429 na requisição seguinte, após estourar o limite', async () => {
    await request(app.getHttpServer()).post('/auth/login').send(payload).expect(429);
  });
});
