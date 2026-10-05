import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { QueryFailedError } from 'typeorm';

import { PeopleService } from './people.service';
import { AddressesService } from '../addresses/addresses.service';
import { Person } from './entities/person.entity';
import { Role } from '../common/enums/role.enum';
import { Employee } from '../employees/entities/employee.entity';
import { Order } from '../orders/entities/order.entity';

import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import type { TestingModule } from '@nestjs/testing';
import type { Repository } from 'typeorm';

jest.mock('bcrypt');

const mockPerson: Person = {
  cpf: '12345678901',
  nome: 'João Silva',
  email: 'joao@email.com',
  telefone: null,
  senha: 'hash_bcrypt_placeholder',
};

const ownerOf = (cpf: string): CurrentUserPayload => ({
  sub: cpf,
  email: 'owner@email.com',
  role: Role.CLIENTE,
});

const employee = (role: Role): CurrentUserPayload => ({
  sub: '99999999999',
  email: 'func@email.com',
  role,
});

const uniqueViolationError = new QueryFailedError('INSERT', [], {
  code: '23505',
  message: 'unique constraint violation',
} as unknown as Error);

describe('PeopleService', () => {
  let service: PeopleService;
  let repo: jest.Mocked<Repository<Person>>;
  let addressesService: jest.Mocked<AddressesService>;
  let manager: {
    findOne: jest.Mock;
    count: jest.Mock;
    update: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let employeesRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    manager = {
      findOne: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockResolvedValue({ affected: 0 }),
      save: jest.fn((_entity, person: Person) => Promise.resolve(person)),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
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
        {
          provide: AddressesService,
          useValue: { create: jest.fn() },
        },
        {
          provide: getDataSourceToken(),
          useValue: {
            transaction: jest.fn((work: (m: typeof manager) => Promise<unknown>) => work(manager)),
          },
        },
        {
          provide: getRepositoryToken(Employee),
          useValue: { findOne: jest.fn().mockResolvedValue(null) },
        },
      ],
    }).compile();

    service = module.get(PeopleService);
    repo = module.get(getRepositoryToken(Person));
    addressesService = module.get(AddressesService);
    employeesRepo = module.get(getRepositoryToken(Employee));
  });

  describe('registerPerson', () => {
    it('cria pessoa sem senha quando email não existe', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue(mockPerson);
      repo.save.mockResolvedValue(mockPerson);

      const result = await service.registerPerson({
        cpf: mockPerson.cpf,
        email: mockPerson.email,
        nome: mockPerson.nome!,
      });

      expect(result).not.toHaveProperty('senha');
      expect(repo.create).toHaveBeenCalledWith({
        cpf: mockPerson.cpf,
        nome: mockPerson.nome,
        email: mockPerson.email,
        telefone: null,
        senha: null,
      });
    });

    it('retorna ConflictException quando CPF já existe', async () => {
      repo.findOne.mockResolvedValue(mockPerson);

      await expect(
        service.registerPerson({
          cpf: mockPerson.cpf,
          email: mockPerson.email,
          nome: mockPerson.nome!,
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(bcrypt.hash).not.toHaveBeenCalled();
    });
  });

  describe('registerUser', () => {
    it('cria usuário completo com email e senha quando CPF não existe', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue(mockPerson);
      repo.save.mockResolvedValue(mockPerson);

      const result = await service.registerUser({
        email: mockPerson.email,
        senha: 'senha123',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('senha123', 10);
      expect(result).not.toHaveProperty('senha');
    });

    it('atualiza Person existente com senha quando CPF já existe', async () => {
      const personWithoutSenha = { ...mockPerson, senha: null };
      repo.findOne.mockResolvedValue(personWithoutSenha);
      repo.save.mockResolvedValue(mockPerson);

      const result = await service.registerUser({
        cpf: mockPerson.cpf,
        email: mockPerson.email,
        senha: 'senha123',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('senha123', 10);
      expect(result).not.toHaveProperty('senha');
    });

    it('retorna ConflictException quando CPF já tem senha completa', async () => {
      repo.findOne.mockResolvedValue(mockPerson);

      await expect(
        service.registerUser({
          cpf: mockPerson.cpf,
          email: mockPerson.email,
          senha: 'senha123',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('retorna ConflictException quando email já existe', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue(mockPerson);
      repo.save.mockRejectedValue(uniqueViolationError);

      await expect(
        service.registerUser({
          email: mockPerson.email,
          senha: 'senha123',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('persiste endereço quando fornecido no cadastro de pessoa nova', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue(mockPerson);
      repo.save.mockResolvedValue(mockPerson);
      addressesService.create.mockResolvedValue({} as any);

      await service.registerUser({
        email: mockPerson.email,
        senha: 'senha123',
        endereco: {
          cep: '70040010',
          logradouro: 'Esplanada dos Ministérios',
          numero: '1',
          bairro: 'Zona Cívico-Administrativa',
          cidade: 'Brasília',
          uf: 'DF',
        },
      });

      expect(addressesService.create).toHaveBeenCalledWith(
        mockPerson.cpf,
        expect.objectContaining({ cep: '70040010', uf: 'DF' }),
      );
    });

    it('não chama addressesService quando endereço não é fornecido', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue(mockPerson);
      repo.save.mockResolvedValue(mockPerson);

      await service.registerUser({ email: mockPerson.email, senha: 'senha123' });

      expect(addressesService.create).not.toHaveBeenCalled();
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
      const pessoas = Array.from({ length: 3 }, (_, i) => ({
        ...mockPerson,
        cpf: `0000000000${i}`,
      }));
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

      const result = await service.findOne(mockPerson.cpf, ownerOf(mockPerson.cpf));

      expect(result).not.toHaveProperty('senha');
      expect(result.cpf).toBe(mockPerson.cpf);
    });

    it('lança NotFoundException quando CPF não existe', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne('00000000000', ownerOf('00000000000'))).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('atualiza e retorna pessoa sem o campo senha', async () => {
      const updated: Person = { ...mockPerson, nome: 'João Atualizado' };
      repo.findOne.mockResolvedValue(mockPerson);
      repo.save.mockResolvedValue(updated);

      const result = await service.update(
        mockPerson.cpf,
        { nome: 'João Atualizado' },
        ownerOf(mockPerson.cpf),
      );

      expect(result).not.toHaveProperty('senha');
      expect(result.nome).toBe('João Atualizado');
    });

    it('aplica hash bcrypt ao atualizar senha', async () => {
      repo.findOne.mockResolvedValue(mockPerson);
      repo.save.mockResolvedValue(mockPerson);

      await service.update(mockPerson.cpf, { senha: 'novaSenha123' }, ownerOf(mockPerson.cpf));

      expect(bcrypt.hash).toHaveBeenCalledWith('novaSenha123', 10);
    });

    it('não chama bcrypt.hash quando senha não está no payload de update', async () => {
      repo.findOne.mockResolvedValue(mockPerson);
      repo.save.mockResolvedValue(mockPerson);

      await service.update(mockPerson.cpf, { nome: 'Apenas nome' }, ownerOf(mockPerson.cpf));

      expect(bcrypt.hash).not.toHaveBeenCalled();
    });

    it('lança NotFoundException quando CPF não existe', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.update('00000000000', { nome: 'X' }, ownerOf('00000000000')),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lança ConflictException quando email já pertence a outra pessoa', async () => {
      repo.findOne.mockResolvedValue(mockPerson);
      repo.save.mockRejectedValue(uniqueViolationError);

      await expect(
        service.update(mockPerson.cpf, { email: 'outro@email.com' }, ownerOf(mockPerson.cpf)),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('remove (anonimização LGPD #197)', () => {
    const owner = ownerOf(mockPerson.cpf);

    beforeEach(() => {
      repo.create.mockImplementation((data) => data as Person);
    });

    it('apaga o cadastro quando não há pedidos vinculados', async () => {
      manager.findOne.mockResolvedValue(mockPerson);

      await expect(service.remove(mockPerson.cpf, owner)).resolves.toBeUndefined();

      expect(manager.save).not.toHaveBeenCalled();
      expect(manager.delete).toHaveBeenCalledWith(Person, { cpf: mockPerson.cpf });
    });

    it('lança NotFoundException quando CPF não existe', async () => {
      manager.findOne.mockResolvedValue(null);

      await expect(service.remove(mockPerson.cpf, owner)).rejects.toBeInstanceOf(NotFoundException);
      expect(manager.delete).not.toHaveBeenCalled();
    });

    it('409 quando há pedido em andamento, sem alterar nada', async () => {
      manager.findOne.mockResolvedValue(mockPerson);
      manager.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);

      await expect(service.remove(mockPerson.cpf, owner)).rejects.toBeInstanceOf(ConflictException);
      expect(manager.update).not.toHaveBeenCalled();
      expect(manager.delete).not.toHaveBeenCalled();
    });

    it('com pedidos encerrados, move os pedidos para um pseudônimo e apaga a pessoa', async () => {
      manager.findOne.mockResolvedValue(mockPerson);
      manager.count.mockResolvedValueOnce(3).mockResolvedValueOnce(0);

      await service.remove(mockPerson.cpf, owner);

      const pseudonym = manager.save.mock.calls[0][1] as Person;
      expect(pseudonym.cpf).toMatch(/^X[0-9a-f]{10}$/);
      expect(pseudonym.email).toBe(`${pseudonym.cpf.toLowerCase()}@anonimizado.invalid`);
      expect(pseudonym).toMatchObject({ nome: 'Cliente removido', telefone: null, senha: null });

      expect(manager.update).toHaveBeenCalledWith(
        Order,
        { idUsuario: mockPerson.cpf },
        expect.objectContaining({
          idUsuario: pseudonym.cpf,
          clienteTelefone: null,
          enderecoCep: null,
          enderecoRua: null,
          enderecoNumero: null,
        }),
      );
      expect(manager.delete).toHaveBeenCalledWith(Person, { cpf: mockPerson.cpf });
    });

    it('redige pedidos de loja feitos com o CPF avulso', async () => {
      manager.findOne.mockResolvedValue(mockPerson);

      await service.remove(mockPerson.cpf, owner);

      expect(manager.update).toHaveBeenCalledWith(
        Order,
        { clienteCpfAvulso: mockPerson.cpf },
        expect.objectContaining({ clienteCpfAvulso: null, clienteNomeAvulso: null }),
      );
    });
  });

  describe('autorização de acesso por CPF (IDOR #154)', () => {
    describe('findOne', () => {
      it('403 quando cliente acessa CPF alheio, sem tocar o repositório', async () => {
        await expect(
          service.findOne(mockPerson.cpf, ownerOf('00000000000')),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(repo.findOne).not.toHaveBeenCalled();
      });

      it('permite funcionário acessar CPF alheio', async () => {
        repo.findOne.mockResolvedValue(mockPerson);

        const result = await service.findOne(mockPerson.cpf, employee(Role.CAIXA));

        expect(result.cpf).toBe(mockPerson.cpf);
      });
    });

    describe('update', () => {
      it('403 quando caixa/vendedor altera CPF alheio, sem tocar o repositório', async () => {
        await expect(
          service.update(mockPerson.cpf, { nome: 'X' }, employee(Role.CAIXA)),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(repo.findOne).not.toHaveBeenCalled();
      });

      it('403 quando gerente tenta alterar senha de CPF alheio', async () => {
        await expect(
          service.update(mockPerson.cpf, { senha: 'novaSenha123' }, employee(Role.GERENTE)),
        ).rejects.toBeInstanceOf(ForbiddenException);
      });

      it('403 quando gerente tenta alterar email de CPF alheio', async () => {
        await expect(
          service.update(mockPerson.cpf, { email: 'x@email.com' }, employee(Role.GERENTE)),
        ).rejects.toBeInstanceOf(ForbiddenException);
      });

      it.each([
        ['cliente', null],
        ['caixa', Role.CAIXA],
        ['vendedor', Role.VENDEDOR],
      ])('permite gerente alterar dados não sensíveis de %s', async (_alvo, cargo) => {
        employeesRepo.findOne.mockResolvedValue(
          cargo ? { cpf: mockPerson.cpf, role_perfil: cargo } : null,
        );
        repo.findOne.mockResolvedValue(mockPerson);
        repo.save.mockResolvedValue({ ...mockPerson, nome: 'Corrigido' });

        const result = await service.update(
          mockPerson.cpf,
          { nome: 'Corrigido' },
          employee(Role.GERENTE),
        );

        expect(result.nome).toBe('Corrigido');
      });

      it.each([Role.GERENTE, Role.ADMINISTRADOR])(
        '403 quando gerente altera o cadastro de %s',
        async (cargo) => {
          employeesRepo.findOne.mockResolvedValue({ cpf: mockPerson.cpf, role_perfil: cargo });

          await expect(
            service.update(mockPerson.cpf, { nome: 'X' }, employee(Role.GERENTE)),
          ).rejects.toBeInstanceOf(ForbiddenException);
          expect(repo.save).not.toHaveBeenCalled();
        },
      );

      it.each([Role.CAIXA, Role.GERENTE, Role.ADMINISTRADOR])(
        'permite administrador alterar senha e email de %s',
        async (cargo) => {
          employeesRepo.findOne.mockResolvedValue({ cpf: mockPerson.cpf, role_perfil: cargo });
          repo.findOne.mockResolvedValue({ ...mockPerson });
          repo.save.mockImplementation((p) => Promise.resolve(p as Person));

          const result = await service.update(
            mockPerson.cpf,
            { senha: 'novaSenha123', email: 'recuperado@email.com' },
            employee(Role.ADMINISTRADOR),
          );

          expect(bcrypt.hash).toHaveBeenCalledWith('novaSenha123', expect.any(Number));
          expect(result.email).toBe('recuperado@email.com');
          expect(result).not.toHaveProperty('senha');
        },
      );

      it('permite administrador alterar senha de cliente', async () => {
        repo.findOne.mockResolvedValue({ ...mockPerson });
        repo.save.mockImplementation((p) => Promise.resolve(p as Person));

        await expect(
          service.update(mockPerson.cpf, { senha: 'novaSenha123' }, employee(Role.ADMINISTRADOR)),
        ).resolves.toBeDefined();
        expect(employeesRepo.findOne).not.toHaveBeenCalled();
      });
    });

    describe('remove', () => {
      it('403 quando cliente remove CPF alheio, sem tocar o repositório', async () => {
        await expect(service.remove(mockPerson.cpf, ownerOf('00000000000'))).rejects.toBeInstanceOf(
          ForbiddenException,
        );
        expect(manager.findOne).not.toHaveBeenCalled();
      });

      it('403 quando funcionário (inclusive admin) remove CPF alheio', async () => {
        await expect(
          service.remove(mockPerson.cpf, employee(Role.ADMINISTRADOR)),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(manager.findOne).not.toHaveBeenCalled();
      });
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
