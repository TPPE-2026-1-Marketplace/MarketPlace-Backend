import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PeopleService } from './people.service';
import { Person } from './entities/person.entity';

jest.mock('bcrypt');

const mockPerson: Person = {
  cpf: '12345678901',
  nome: 'João Silva',
  email: 'joao@email.com',
  telefone: null,
  senha: 'hash_bcrypt_placeholder',
};

const uniqueViolationError = new QueryFailedError('INSERT', [], {
  code: '23505',
  message: 'unique constraint violation',
} as unknown as Error);

describe('PeopleService', () => {
  let service: PeopleService;
  let repo: jest.Mocked<Repository<Person>>;

  beforeEach(async () => {
    jest.clearAllMocks();
    (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$10$hashedpassword');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PeopleService,
        {
          provide: getRepositoryToken(Person),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(PeopleService);
    repo = module.get(getRepositoryToken(Person));
  });

  describe('create', () => {
    it('cria pessoa e retorna sem o campo senha', async () => {
      repo.create.mockReturnValue(mockPerson);
      repo.save.mockResolvedValue(mockPerson);

      const result = await service.create({
        cpf: mockPerson.cpf,
        nome: mockPerson.nome,
        email: mockPerson.email,
      });

      expect(result).not.toHaveProperty('senha');
      expect(result.cpf).toBe(mockPerson.cpf);
      expect(result.nome).toBe(mockPerson.nome);
      expect(result.email).toBe(mockPerson.email);
    });

    it('aplica hash bcrypt quando senha é fornecida', async () => {
      repo.create.mockReturnValue(mockPerson);
      repo.save.mockResolvedValue(mockPerson);

      await service.create({
        cpf: mockPerson.cpf,
        nome: mockPerson.nome,
        email: mockPerson.email,
        senha: 'senha123',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('senha123', 10);
    });

    it('não chama bcrypt.hash quando senha é omitida', async () => {
      repo.create.mockReturnValue(mockPerson);
      repo.save.mockResolvedValue(mockPerson);

      await service.create({ cpf: mockPerson.cpf, nome: mockPerson.nome, email: mockPerson.email });

      expect(bcrypt.hash).not.toHaveBeenCalled();
    });

    it('lança ConflictException quando CPF ou email já existe', async () => {
      repo.create.mockReturnValue(mockPerson);
      repo.save.mockRejectedValue(uniqueViolationError);

      await expect(
        service.create({ cpf: mockPerson.cpf, nome: mockPerson.nome, email: mockPerson.email }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('repropaga erros que não são violação de unicidade', async () => {
      repo.create.mockReturnValue(mockPerson);
      repo.save.mockRejectedValue(new Error('connection lost'));

      await expect(
        service.create({ cpf: mockPerson.cpf, nome: mockPerson.nome, email: mockPerson.email }),
      ).rejects.toThrow('connection lost');
    });
  });

  describe('findAll', () => {
    it('retorna lista paginada sem o campo senha em nenhum item', async () => {
      repo.findAndCount.mockResolvedValue([[mockPerson], 1]);

      const result = await service.findAll(1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).not.toHaveProperty('senha');
      expect(result.meta).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
    });

    it('calcula totalPages corretamente', async () => {
      const pessoas = Array.from({ length: 3 }, (_, i) => ({ ...mockPerson, cpf: `0000000000${i}` }));
      repo.findAndCount.mockResolvedValue([pessoas, 25]);

      const result = await service.findAll(1, 10);

      expect(result.meta.totalPages).toBe(3);
    });

    it('retorna totalPages 1 quando não há registros', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll(1, 10);

      expect(result.meta.totalPages).toBe(1);
      expect(result.data).toHaveLength(0);
    });
  });

  describe('findOne', () => {
    it('retorna pessoa sem o campo senha quando CPF existe', async () => {
      repo.findOne.mockResolvedValue(mockPerson);

      const result = await service.findOne(mockPerson.cpf);

      expect(result).not.toHaveProperty('senha');
      expect(result.cpf).toBe(mockPerson.cpf);
    });

    it('lança NotFoundException quando CPF não existe', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne('00000000000')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('atualiza e retorna pessoa sem o campo senha', async () => {
      const updated: Person = { ...mockPerson, nome: 'João Atualizado' };
      repo.findOne.mockResolvedValue(mockPerson);
      repo.save.mockResolvedValue(updated);

      const result = await service.update(mockPerson.cpf, { nome: 'João Atualizado' });

      expect(result).not.toHaveProperty('senha');
      expect(result.nome).toBe('João Atualizado');
    });

    it('aplica hash bcrypt ao atualizar senha', async () => {
      repo.findOne.mockResolvedValue(mockPerson);
      repo.save.mockResolvedValue(mockPerson);

      await service.update(mockPerson.cpf, { senha: 'novaSenha123' });

      expect(bcrypt.hash).toHaveBeenCalledWith('novaSenha123', 10);
    });

    it('não chama bcrypt.hash quando senha não está no payload de update', async () => {
      repo.findOne.mockResolvedValue(mockPerson);
      repo.save.mockResolvedValue(mockPerson);

      await service.update(mockPerson.cpf, { nome: 'Apenas nome' });

      expect(bcrypt.hash).not.toHaveBeenCalled();
    });

    it('lança NotFoundException quando CPF não existe', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.update('00000000000', { nome: 'X' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lança ConflictException quando email já pertence a outra pessoa', async () => {
      repo.findOne.mockResolvedValue(mockPerson);
      repo.save.mockRejectedValue(uniqueViolationError);

      await expect(
        service.update(mockPerson.cpf, { email: 'outro@email.com' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('remove', () => {
    it('remove sem erros quando CPF existe', async () => {
      repo.delete.mockResolvedValue({ affected: 1, raw: [] });

      await expect(service.remove(mockPerson.cpf)).resolves.toBeUndefined();
    });

    it('lança NotFoundException quando CPF não existe', async () => {
      repo.delete.mockResolvedValue({ affected: 0, raw: [] });

      await expect(service.remove('00000000000')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('validatePassword', () => {
    it('retorna true para senha correta', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const result = await service.validatePassword('senha123', '$2b$10$hash');
      expect(result).toBe(true);
    });

    it('retorna false para senha incorreta', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      const result = await service.validatePassword('errada', '$2b$10$hash');
      expect(result).toBe(false);
    });
  });

  describe('findByEmailWithPassword', () => {
    it('retorna pessoa COM o campo senha (uso interno do AuthService)', async () => {
      repo.findOne.mockResolvedValue(mockPerson);

      const result = await service.findByEmailWithPassword(mockPerson.email);

      expect(result).toHaveProperty('senha');
    });

    it('retorna null quando email não existe', async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.findByEmailWithPassword('nao@existe.com');

      expect(result).toBeNull();
    });
  });
});
