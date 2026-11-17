import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';

import { AppModule } from '../app.module';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { MailService } from '../mail/mail.service';
import { Person } from '../people/entities/person.entity';

import type { MailMessage } from '../mail/interfaces/mail-message.interface';
import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import type { Repository } from 'typeorm';

/**
 * Recuperação de senha (#250) contra o Postgres real: pedir o link → redefinir
 * → login com a senha nova. O e-mail é capturado por um MailService falso.
 */
describe('Recuperação de senha (#250) integration', () => {
  jest.setTimeout(30000);

  let app: INestApplication;
  let moduleRef: TestingModule;
  let peopleRepository: Repository<Person>;
  let tokensRepository: Repository<PasswordResetToken>;
  const mailMock = { isEnabled: jest.fn(() => true), send: jest.fn() };

  const user = {
    cpf: '66281083253',
    email: 'reset_flow@example.com',
    senha: 'senhaAntiga123',
    nome: 'Reset Flow',
  };

  const server = () => app.getHttpServer();
  const login = (senha: string) =>
    request(server()).post('/api/auth/login').send({ email: user.email, senha });

  /** O envio roda fora da resposta; espera o e-mail chegar ao mock e extrai o token. */
  async function tokenFromEmail(): Promise<string> {
    for (let attempt = 0; attempt < 50 && mailMock.send.mock.calls.length === 0; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    const message = mailMock.send.mock.calls.at(-1)?.[0] as MailMessage;
    const token = /redefinir-senha\?token=([\w-]+)/.exec(message.text)?.[1];
    if (!token) throw new Error('E-mail sem link de redefinição');
    return token;
  }

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue(mailMock)
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ZodValidationPipe());
    app.setGlobalPrefix('api');
    await app.init();

    peopleRepository = moduleRef.get(getRepositoryToken(Person));
    tokensRepository = moduleRef.get(getRepositoryToken(PasswordResetToken));
  });

  beforeEach(async () => {
    mailMock.send.mockReset();
    mailMock.send.mockResolvedValue(undefined);
    await peopleRepository.delete({ cpf: user.cpf });
    await request(server()).post('/api/people/register-user').send(user).expect(201);
  });

  afterAll(async () => {
    await peopleRepository?.delete({ cpf: user.cpf });
    await app?.close();
  });

  it('redefine a senha pelo link do e-mail e o link não pode ser reutilizado', async () => {
    const forgot = await request(server())
      .post('/api/auth/forgot-password')
      .send({ email: user.email })
      .expect(200);
    expect(forgot.body.message).toContain('Se o e-mail estiver cadastrado');

    const token = await tokenFromEmail();
    expect(mailMock.send.mock.calls[0][0].to).toBe(user.email);

    // No banco fica só o hash.
    const stored = await tokensRepository.findOneByOrFail({ cpf: user.cpf });
    expect(stored.tokenHash).not.toBe(token);

    await request(server())
      .post('/api/auth/reset-password')
      .send({ token, novaSenha: 'senhaNova456' })
      .expect(200);

    await login('senhaNova456').expect(200);
    await login(user.senha).expect(401);

    await request(server())
      .post('/api/auth/reset-password')
      .send({ token, novaSenha: 'outraSenha789' })
      .expect(400);
  });

  it('um pedido novo invalida o link anterior', async () => {
    await request(server()).post('/api/auth/forgot-password').send({ email: user.email });
    const first = await tokenFromEmail();
    mailMock.send.mockClear();

    await request(server()).post('/api/auth/forgot-password').send({ email: user.email });
    const second = await tokenFromEmail();

    await request(server())
      .post('/api/auth/reset-password')
      .send({ token: first, novaSenha: 'senhaNova456' })
      .expect(400);
    await request(server())
      .post('/api/auth/reset-password')
      .send({ token: second, novaSenha: 'senhaNova456' })
      .expect(200);
  });

  it('responde igual para e-mail sem conta e não envia nada', async () => {
    const res = await request(server())
      .post('/api/auth/forgot-password')
      .send({ email: 'ninguem_reset@example.com' })
      .expect(200);

    expect(res.body.message).toContain('Se o e-mail estiver cadastrado');
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(mailMock.send).not.toHaveBeenCalled();
  });

  it('valida a nova senha (mínimo de 8 caracteres)', async () => {
    await request(server())
      .post('/api/auth/reset-password')
      .send({ token: 'x'.repeat(43), novaSenha: 'curta' })
      .expect(400);
  });
});
