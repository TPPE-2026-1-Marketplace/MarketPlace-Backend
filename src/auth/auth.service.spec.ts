import {
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';

import { AuthService, FORGOT_PASSWORD_MESSAGE } from './auth.service';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { Role } from '../common/enums/role.enum';
import { Employee } from '../employees/entities/employee.entity';
import { MailService } from '../mail/mail.service';
import { Person as PersonEntity } from '../people/entities/person.entity';
import { PeopleService } from '../people/people.service';

import type { LoginDto } from './dtos/login.dto';
import type { Person } from '../people/entities/person.entity';
import type { TestingModule } from '@nestjs/testing';
import type { Repository } from 'typeorm';

jest.mock('bcrypt');

const mockPerson: Person = {
  cpf: '12345678901',
  nome: 'João Silva',
  email: 'joao@email.com',
  telefone: null,
  senha: '$2b$10$hashedpassword123456789',
};

const mockEmployee: Employee = {
  cpf: mockPerson.cpf,
  person: mockPerson,
  ativo: true,
  role_perfil: Role.CAIXA,
  taxa_comissao: 0.025,
  meta_vendas: null,
  codigo_funcionario: null,
};

const mockJwtToken =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwMSIsImVtYWlsIjoiam9hb0BlbWFpbC5jb20iLCJyb2xlIjoidXNlciIsImlhdCI6MTU2NzgwMDAwMCwiZXhwIjoxNTY3ODg2NDAwfQ.signature';

describe('AuthService', () => {
  let service: AuthService;
  let peopleService: jest.Mocked<PeopleService>;
  let employeeRepo: jest.Mocked<Repository<Employee>>;
  let jwtService: jest.Mocked<JwtService>;
  let resetTokens: { create: jest.Mock; save: jest.Mock; delete: jest.Mock };
  let txTokens: { findOne: jest.Mock; save: jest.Mock; delete: jest.Mock };
  let txPeople: { update: jest.Mock };
  let mail: { isEnabled: jest.Mock; send: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    resetTokens = {
      create: jest.fn((t) => t),
      save: jest.fn((t) => Promise.resolve(t)),
      delete: jest.fn(),
    };
    txTokens = { findOne: jest.fn(), save: jest.fn((t) => Promise.resolve(t)), delete: jest.fn() };
    txPeople = { update: jest.fn() };
    mail = { isEnabled: jest.fn(() => true), send: jest.fn().mockResolvedValue(undefined) };
    const txManager = {
      getRepository: jest.fn((entity: unknown) =>
        entity === PasswordResetToken ? txTokens : entity === PersonEntity ? txPeople : undefined,
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(PasswordResetToken), useValue: resetTokens },
        { provide: MailService, useValue: mail },
        {
          provide: getDataSourceToken(),
          useValue: { transaction: jest.fn((cb: (m: unknown) => unknown) => cb(txManager)) },
        },
        {
          provide: PeopleService,
          useValue: { findByEmailWithPassword: jest.fn() },
        },
        {
          provide: getRepositoryToken(Employee),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue(mockJwtToken) },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    peopleService = module.get(PeopleService);
    employeeRepo = module.get(getRepositoryToken(Employee));
    jwtService = module.get(JwtService);
  });

  describe('login', () => {
    it('retorna access_token quando credenciais são válidas', async () => {
      peopleService.findByEmailWithPassword.mockResolvedValue(mockPerson);
      employeeRepo.findOne.mockResolvedValue(null);

      const result = await service.login({ email: mockPerson.email, senha: 'senha123' });

      expect(result).toHaveProperty('access_token');
      expect(result.access_token).toBe(mockJwtToken);
    });

    it('gera JWT com role CLIENTE quando person não é funcionário', async () => {
      peopleService.findByEmailWithPassword.mockResolvedValue(mockPerson);
      employeeRepo.findOne.mockResolvedValue(null);

      await service.login({ email: mockPerson.email, senha: 'senha123' });

      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: mockPerson.cpf,
        email: mockPerson.email,
        role: Role.CLIENTE,
      });
    });

    it('gera JWT com role do funcionário quando person é employee', async () => {
      peopleService.findByEmailWithPassword.mockResolvedValue(mockPerson);
      employeeRepo.findOne.mockResolvedValue(mockEmployee);

      await service.login({ email: mockPerson.email, senha: 'senha123' });

      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: mockPerson.cpf,
        email: mockPerson.email,
        role: Role.CAIXA,
      });
    });

    it('lança UnauthorizedException quando email não existe', async () => {
      peopleService.findByEmailWithPassword.mockResolvedValue(null);

      const loginDto: LoginDto = { email: 'naoexiste@email.com', senha: 'senha123' };

      await expect(service.login(loginDto)).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('Email ou senha inválidos');
    });

    it('lança UnauthorizedException quando senha está vazia (NULL)', async () => {
      peopleService.findByEmailWithPassword.mockResolvedValue({ ...mockPerson, senha: null });

      await expect(
        service.login({ email: mockPerson.email, senha: 'qualquer_senha' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('lança UnauthorizedException quando senha é incorreta', async () => {
      peopleService.findByEmailWithPassword.mockResolvedValue(mockPerson);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: mockPerson.email, senha: 'senhaerrada' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('não chama bcrypt.compare se pessoa não for encontrada', async () => {
      peopleService.findByEmailWithPassword.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nao@existe.com', senha: 'senha123' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('não chama bcrypt.compare se pessoa não tem senha', async () => {
      peopleService.findByEmailWithPassword.mockResolvedValue({ ...mockPerson, senha: null });

      await expect(
        service.login({ email: mockPerson.email, senha: 'senha123' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('não chama employeeRepo se autenticação falhar', async () => {
      peopleService.findByEmailWithPassword.mockResolvedValue(mockPerson);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: mockPerson.email, senha: 'errada' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(employeeRepo.findOne).not.toHaveBeenCalled();
    });
  });
  describe('forgotPassword (#250)', () => {
    const flush = () => new Promise((resolve) => setImmediate(resolve));

    beforeEach(() => {
      process.env.FRONTEND_URL = 'https://loja.exemplo/';
    });

    afterEach(() => {
      delete process.env.FRONTEND_URL;
    });

    it('gera token de uso único, guarda só o hash e envia o link por e-mail', async () => {
      peopleService.findByEmailWithPassword.mockResolvedValue(mockPerson);

      await expect(service.forgotPassword(mockPerson.email)).resolves.toEqual({
        message: FORGOT_PASSWORD_MESSAGE,
      });
      await flush();

      expect(resetTokens.delete).toHaveBeenCalledWith(
        expect.objectContaining({ cpf: mockPerson.cpf }),
      );
      const saved = resetTokens.save.mock.calls[0][0];
      expect(saved.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(saved.expiraEm.getTime()).toBeGreaterThan(Date.now() + 29 * 60_000);

      const message = mail.send.mock.calls[0][0];
      expect(message.to).toBe(mockPerson.email);
      const token = /redefinir-senha\?token=([\w-]+)/.exec(message.text)?.[1];
      expect(message.text).toContain('https://loja.exemplo/redefinir-senha?token=');
      // O link leva o token puro; o banco, só o hash dele.
      expect(token).toBeDefined();
      expect(saved.tokenHash).not.toBe(token);
    });

    it('responde igual quando o e-mail não tem conta, sem enviar nada', async () => {
      peopleService.findByEmailWithPassword.mockResolvedValue(null);

      await expect(service.forgotPassword('ninguem@ex.com')).resolves.toEqual({
        message: FORGOT_PASSWORD_MESSAGE,
      });
      await flush();
      expect(mail.send).not.toHaveBeenCalled();
      expect(resetTokens.save).not.toHaveBeenCalled();
    });

    it('ignora conta anonimizada (LGPD)', async () => {
      peopleService.findByEmailWithPassword.mockResolvedValue({
        ...mockPerson,
        email: 'anon123@anonimizado.invalid',
      });

      await service.forgotPassword('anon123@anonimizado.invalid');
      await flush();
      expect(mail.send).not.toHaveBeenCalled();
    });

    it('não expõe falha de envio na resposta', async () => {
      peopleService.findByEmailWithPassword.mockResolvedValue(mockPerson);
      mail.send.mockRejectedValue(new ServiceUnavailableException());

      await expect(service.forgotPassword(mockPerson.email)).resolves.toEqual({
        message: FORGOT_PASSWORD_MESSAGE,
      });
      await flush();
    });

    it('responde 503 quando o envio de e-mail não está configurado', async () => {
      mail.isEnabled.mockReturnValue(false);
      await expect(service.forgotPassword(mockPerson.email)).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(peopleService.findByEmailWithPassword).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword (#250)', () => {
    const validToken = () => ({
      id: 1,
      cpf: mockPerson.cpf,
      tokenHash: 'h',
      expiraEm: new Date(Date.now() + 60_000),
      usadoEm: null as Date | null,
    });

    it('grava a nova senha com bcrypt, marca o token como usado e invalida os demais', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('novo-hash');
      const token = validToken();
      txTokens.findOne.mockResolvedValue(token);

      await service.resetPassword({ token: 'x'.repeat(43), novaSenha: 'novaSenha123' });

      expect(bcrypt.hash).toHaveBeenCalledWith('novaSenha123', 10);
      expect(txPeople.update).toHaveBeenCalledWith({ cpf: mockPerson.cpf }, { senha: 'novo-hash' });
      expect(txTokens.save).toHaveBeenCalledWith(
        expect.objectContaining({ usadoEm: expect.any(Date) }),
      );
      expect(txTokens.delete).toHaveBeenCalledWith(
        expect.objectContaining({ cpf: mockPerson.cpf }),
      );
      // Busca pelo hash, nunca pelo token puro.
      expect(txTokens.findOne.mock.calls[0][0].where.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it.each([
      ['inexistente', null],
      ['já usado', { ...validToken(), usadoEm: new Date() }],
      ['expirado', { ...validToken(), expiraEm: new Date(Date.now() - 1) }],
    ])('recusa token %s com 400 sem mexer na senha', async (_label, token) => {
      txTokens.findOne.mockResolvedValue(token);

      await expect(
        service.resetPassword({ token: 'x'.repeat(43), novaSenha: 'novaSenha123' }),
      ).rejects.toThrow(BadRequestException);
      expect(txPeople.update).not.toHaveBeenCalled();
    });
  });
});
