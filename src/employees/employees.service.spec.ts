import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, QueryFailedError } from 'typeorm';

import { EmployeesService } from './employees.service';
import { Employee } from './entities/employee.entity';
import { Role } from '../common/enums/role.enum';
import { Person } from '../people/entities/person.entity';

import type { TestingModule } from '@nestjs/testing';
import type { Repository } from 'typeorm';

const mockPerson: Person = {
  cpf: '12345678901',
  nome: 'João Silva',
  email: 'joao@email.com',
  telefone: null,
  senha: null,
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

const uniqueViolationError = new QueryFailedError('INSERT', [], {
  code: '23505',
  message: 'unique constraint violation',
} as unknown as Error);

describe('EmployeesService', () => {
  let service: EmployeesService;
  let employeesRepo: jest.Mocked<Repository<Employee>>;
  let personRepo: jest.Mocked<Repository<Person>>;
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();

    employeesRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
    } as unknown as jest.Mocked<Repository<Employee>>;

    personRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<Person>>;

    const manager: { getRepository: jest.Mock } = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === Person) {
          return personRepo;
        }
        return employeesRepo;
      }),
    };

    dataSource = {
      transaction: jest.fn(async (callback: (manager: any) => Promise<unknown>) =>
        callback(manager as any),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        {
          provide: getRepositoryToken(Employee),
          useValue: employeesRepo,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    service = module.get(EmployeesService);
  });

  describe('create', () => {
    it('cria Person e Employee em transação atômica quando Person não existe', async () => {
      // Clonamos os mocks para evitar vazamento de mutação no Javascript
      const localPerson = { ...mockPerson };
      const localEmployee = { ...mockEmployee, person: localPerson };

      personRepo.findOne.mockResolvedValue(null);
      personRepo.create.mockReturnValue(localPerson);
      personRepo.save.mockResolvedValue(localPerson);
      employeesRepo.create.mockReturnValue(localEmployee);
      employeesRepo.save.mockResolvedValue(localEmployee);

      const result = await service.create({
        cpf: localPerson.cpf,
        nome: localPerson.nome!,
        email: localPerson.email,
        role_perfil: Role.CAIXA,
      });

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(personRepo.create).toHaveBeenCalled();
      expect(personRepo.save).toHaveBeenCalledWith(localPerson);
      expect(employeesRepo.save).toHaveBeenCalledWith(localEmployee);

      // Construímos o objeto esperado sem a propriedade "senha",
      // pois sabemos que o service aplicou o delete nela por segurança.
      const expectedPerson = {
        cpf: localPerson.cpf,
        nome: localPerson.nome,
        email: localPerson.email,
        telefone: localPerson.telefone,
      };

      expect(result).toEqual({
        ...localEmployee,
        person: expectedPerson,
        senha_temporaria: expect.any(String),
      });
    });

    it('cria apenas Employee e atualiza dados quando Person já existe', async () => {
      const localPerson = { ...mockPerson };
      const localEmployee = { ...mockEmployee, person: localPerson };

      personRepo.findOne.mockResolvedValue(localPerson);
      employeesRepo.findOne.mockResolvedValue(null);

      personRepo.save.mockResolvedValue({ ...localPerson, nome: 'Nome Atualizado' });
      employeesRepo.create.mockReturnValue(localEmployee);

      employeesRepo.save.mockResolvedValue({
        ...localEmployee,
        person: { ...localPerson, nome: 'Nome Atualizado' },
      });

      const result = await service.create({
        cpf: localPerson.cpf,
        nome: 'Nome Atualizado',
        email: localPerson.email,
        role_perfil: Role.CAIXA,
      });

      expect(employeesRepo.findOne).toHaveBeenCalledWith({ where: { cpf: localPerson.cpf } });
      expect(personRepo.create).not.toHaveBeenCalled();
      expect(personRepo.save).toHaveBeenCalled();
      expect(employeesRepo.create).toHaveBeenCalled();

      const expectedPerson = {
        cpf: localPerson.cpf,
        nome: 'Nome Atualizado',
        email: localPerson.email,
        telefone: localPerson.telefone,
      };

      expect(result).toEqual({
        ...localEmployee,
        person: expectedPerson,
        senha_temporaria: expect.any(String),
      });
    });

    it('lança ConflictException quando Employee já existe', async () => {
      personRepo.findOne.mockResolvedValue(mockPerson);
      employeesRepo.findOne.mockResolvedValue(mockEmployee);

      await expect(
        service.create({
          cpf: mockPerson.cpf,
          nome: mockPerson.nome!,
          email: mockPerson.email,
          role_perfil: Role.CAIXA,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('propaga violação de unicidade como conflito e falha a transação', async () => {
      personRepo.findOne.mockResolvedValue(null);
      personRepo.create.mockReturnValue(mockPerson);
      personRepo.save.mockResolvedValue(mockPerson);
      employeesRepo.create.mockReturnValue(mockEmployee);
      employeesRepo.save.mockRejectedValue(uniqueViolationError);

      await expect(
        service.create({
          cpf: mockPerson.cpf,
          nome: mockPerson.nome!,
          email: mockPerson.email,
          role_perfil: Role.CAIXA,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('findAll', () => {
    it('retorna paginação de employees', async () => {
      employeesRepo.findAndCount.mockResolvedValue([[mockEmployee], 1]);

      const result = await service.findAll(1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
    });
  });

  describe('findOne', () => {
    it('retorna employee quando CPF existe sem senha na person aninhada', async () => {
      employeesRepo.findOne.mockResolvedValue(mockEmployee);

      const result = await service.findOne(mockEmployee.cpf);

      expect(result.cpf).toBe(mockEmployee.cpf);
      expect(result.person).not.toHaveProperty('senha');
    });

    it('lança NotFoundException quando employee não existe', async () => {
      employeesRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('00000000000')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('atualiza Person e Employee em transação', async () => {
      const updatedPerson = { ...mockPerson, nome: 'João Atualizado' };
      const updatedEmployee = { ...mockEmployee, role_perfil: Role.GERENTE };

      employeesRepo.findOne.mockResolvedValue(mockEmployee);
      personRepo.findOne.mockResolvedValue(mockPerson);
      personRepo.save.mockResolvedValue(updatedPerson);
      employeesRepo.save.mockResolvedValue(updatedEmployee);

      const result = await service.update(mockEmployee.cpf, {
        nome: 'João Atualizado',
        role_perfil: Role.GERENTE,
      });

      expect(personRepo.save).toHaveBeenCalled();
      expect(employeesRepo.save).toHaveBeenCalled();
      expect(result.cpf).toBe(mockEmployee.cpf);
      expect(result.role_perfil).toBe(Role.GERENTE);
      expect(result.person).not.toHaveProperty('senha');
    });

    it('lança NotFoundException quando employee não existe', async () => {
      employeesRepo.findOne.mockResolvedValue(null);

      await expect(service.update('00000000000', { nome: 'X' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
