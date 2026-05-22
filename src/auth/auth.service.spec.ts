import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service';
import { Role } from '../common/enums/role.enum';
import { Employee } from '../employees/entities/employee.entity';
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

  beforeEach(async () => {
    jest.clearAllMocks();
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
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
});
