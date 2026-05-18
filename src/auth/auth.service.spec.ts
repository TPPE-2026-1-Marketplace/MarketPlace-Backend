import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { Person } from '../people/entities/person.entity';
import { LoginDto } from './dtos/login.dto';
import { Role } from '../common/enums/role.enum';

jest.mock('bcrypt');

const mockPerson: Person = {
  cpf: '12345678901',
  nome: 'João Silva',
  email: 'joao@email.com',
  telefone: null,
  senha: '$2b$10$hashedpassword123456789',
};

const mockJwtToken =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwMSIsImVtYWlsIjoiam9hb0BlbWFpbC5jb20iLCJyb2xlIjoidXNlciIsImlhdCI6MTU2NzgwMDAwMCwiZXhwIjoxNTY3ODg2NDAwfQ.signature';

describe('AuthService', () => {
  let service: AuthService;
  let personRepo: jest.Mocked<Repository<Person>>;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    jest.clearAllMocks();
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(Person),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue(mockJwtToken),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    personRepo = module.get(getRepositoryToken(Person));
    jwtService = module.get(JwtService);
  });

  describe('login', () => {
    it('retorna access_token quando credenciais são válidas', async () => {
      personRepo.findOne.mockResolvedValue(mockPerson);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const loginDto: LoginDto = {
        email: mockPerson.email,
        senha: 'senha123',
      };

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('access_token');
      expect(result.access_token).toBe(mockJwtToken);
    });

    it('gera JWT com payload contendo sub (CPF), email e role', async () => {
      personRepo.findOne.mockResolvedValue(mockPerson);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const loginDto: LoginDto = {
        email: mockPerson.email,
        senha: 'senha123',
      };

      await service.login(loginDto);

      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: mockPerson.cpf,
        email: mockPerson.email,
        role: Role.CLIENTE,
      });
    });

    it('lança UnauthorizedException quando email não existe', async () => {
      personRepo.findOne.mockResolvedValue(null);

      const loginDto: LoginDto = {
        email: 'naoexiste@email.com',
        senha: 'senha123',
      };

      await expect(service.login(loginDto)).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('Email ou senha inválidos');
    });

    it('lança UnauthorizedException quando senha está vazia (NULL)', async () => {
      const personWithoutPassword: Person = {
        ...mockPerson,
        senha: null,
      };
      personRepo.findOne.mockResolvedValue(personWithoutPassword);

      const loginDto: LoginDto = {
        email: mockPerson.email,
        senha: 'qualquer_senha',
      };

      await expect(service.login(loginDto)).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('Email ou senha inválidos');
    });

    it('lança UnauthorizedException quando senha é incorreta', async () => {
      personRepo.findOne.mockResolvedValue(mockPerson);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const loginDto: LoginDto = {
        email: mockPerson.email,
        senha: 'senhaerrada',
      };

      await expect(service.login(loginDto)).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('Email ou senha inválidos');
    });

    it('valida senha com bcrypt.compare', async () => {
      personRepo.findOne.mockResolvedValue(mockPerson);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const loginDto: LoginDto = {
        email: mockPerson.email,
        senha: 'senha123',
      };

      await service.login(loginDto);

      expect(bcrypt.compare).toHaveBeenCalledWith('senha123', mockPerson.senha);
    });

    it('busca pessoa por email no repositório', async () => {
      personRepo.findOne.mockResolvedValue(mockPerson);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const loginDto: LoginDto = {
        email: mockPerson.email,
        senha: 'senha123',
      };

      await service.login(loginDto);

      expect(personRepo.findOne).toHaveBeenCalledWith({
        where: { email: mockPerson.email },
      });
    });

    it('não chama bcrypt.compare se pessoa não for encontrada', async () => {
      personRepo.findOne.mockResolvedValue(null);

      const loginDto: LoginDto = {
        email: 'nao@existe.com',
        senha: 'senha123',
      };

      await expect(service.login(loginDto)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('não chama bcrypt.compare se pessoa não tem senha', async () => {
      const personWithoutPassword: Person = {
        ...mockPerson,
        senha: null,
      };
      personRepo.findOne.mockResolvedValue(personWithoutPassword);

      const loginDto: LoginDto = {
        email: mockPerson.email,
        senha: 'senha123',
      };

      await expect(service.login(loginDto)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });
  });
});
