import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { SalesGoal } from './entities/sales-goal.entity';
import { SalesGoalsService } from './sales-goals.service';
import { Role } from '../common/enums/role.enum';
import { Employee } from '../employees/entities/employee.entity';
import { OrdersService } from '../orders/orders.service';

import type { CreateSalesGoalDto } from './dtos/create-sales-goal.dto';
import type { TestingModule } from '@nestjs/testing';
import type { Repository } from 'typeorm';

const CPF_FUNCIONARIO = '11122233344';

const buildEmployee = (overrides: Partial<Employee> = {}): Employee => ({
  cpf: CPF_FUNCIONARIO,
  person: {
    cpf: CPF_FUNCIONARIO,
    nome: 'Funcionário Teste',
    email: 'func@test.com',
    telefone: null,
    senha: null,
  },
  ativo: true,
  role_perfil: Role.VENDEDOR,
  taxa_comissao: 0.025,
  meta_vendas: null,
  codigo_funcionario: 'F001',
  ...overrides,
});

const buildGoal = (overrides: Partial<SalesGoal> = {}): SalesGoal => ({
  idGoal: 1,
  cpfFuncionario: CPF_FUNCIONARIO,
  employee: null,
  mes: 6,
  ano: 2026,
  valorMeta: 10000,
  valorBonus: null,
  ...overrides,
});

const makeQueryBuilder = (overrides: Partial<Record<string, jest.Mock>> = {}) => ({
  innerJoin: jest.fn().mockReturnThis(),
  leftJoin: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  addGroupBy: jest.fn().mockReturnThis(),
  getRawMany: jest.fn().mockResolvedValue([]),
  ...overrides,
});

describe('SalesGoalsService', () => {
  let service: SalesGoalsService;
  let salesGoalsRepo: jest.Mocked<Repository<SalesGoal>>;
  let employeeRepo: jest.Mocked<Repository<Employee>>;
  let ordersService: { sumTotalInStoreSalesByPeriod: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();

    ordersService = { sumTotalInStoreSalesByPeriod: jest.fn().mockResolvedValue(0) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesGoalsService,
        {
          provide: getRepositoryToken(SalesGoal),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Employee),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: OrdersService,
          useValue: ordersService,
        },
      ],
    }).compile();

    service = module.get(SalesGoalsService);
    salesGoalsRepo = module.get(getRepositoryToken(SalesGoal));
    employeeRepo = module.get(getRepositoryToken(Employee));
  });

  const createDto: CreateSalesGoalDto = {
    cpfFuncionario: CPF_FUNCIONARIO,
    mes: 6,
    ano: 2026,
    valorMeta: 10000,
  };

  describe('create', () => {
    it('cria uma meta individual quando funcionário existe e período é único', async () => {
      employeeRepo.findOne.mockResolvedValue(buildEmployee());
      salesGoalsRepo.findOne.mockResolvedValue(null);
      salesGoalsRepo.create.mockReturnValue(buildGoal());
      salesGoalsRepo.save.mockResolvedValue(buildGoal());

      const result = await service.create(createDto);

      expect(result).toEqual(buildGoal());
      expect(employeeRepo.findOne).toHaveBeenCalledWith({ where: { cpf: CPF_FUNCIONARIO } });
    });

    it('cria uma meta coletiva quando cpfFuncionario não é informado', async () => {
      salesGoalsRepo.findOne.mockResolvedValue(null);
      salesGoalsRepo.create.mockReturnValue(buildGoal({ cpfFuncionario: null }));
      salesGoalsRepo.save.mockResolvedValue(buildGoal({ cpfFuncionario: null }));

      const result = await service.create({ mes: 6, ano: 2026, valorMeta: 50000 });

      expect(result.cpfFuncionario).toBeNull();
      expect(employeeRepo.findOne).not.toHaveBeenCalled();
    });

    it('lança NotFoundException quando o funcionário informado não existe', async () => {
      employeeRepo.findOne.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    });

    it('lança ConflictException quando já existe meta individual no período', async () => {
      employeeRepo.findOne.mockResolvedValue(buildEmployee());
      salesGoalsRepo.findOne.mockResolvedValue(buildGoal());

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });

    it('lança ConflictException quando já existe meta coletiva no período', async () => {
      salesGoalsRepo.findOne.mockResolvedValue(buildGoal({ cpfFuncionario: null }));

      await expect(service.create({ mes: 6, ano: 2026, valorMeta: 50000 })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    it('filtra por mês e ano quando informados', async () => {
      salesGoalsRepo.find.mockResolvedValue([buildGoal()]);

      const result = await service.findAll({ mes: 6, ano: 2026 });

      expect(result).toEqual([buildGoal()]);
      expect(salesGoalsRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { mes: 6, ano: 2026 } }),
      );
    });

    it('não filtra quando mês/ano não são informados', async () => {
      salesGoalsRepo.find.mockResolvedValue([]);

      await service.findAll({});

      expect(salesGoalsRepo.find).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    });
  });

  describe('findOne', () => {
    it('retorna a meta quando encontrada', async () => {
      salesGoalsRepo.findOne.mockResolvedValue(buildGoal());

      const result = await service.findOne(1);

      expect(result).toEqual(buildGoal());
    });

    it('lança NotFoundException quando a meta não existe', async () => {
      salesGoalsRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('atualiza os campos informados e salva', async () => {
      salesGoalsRepo.findOne.mockResolvedValue(buildGoal());
      salesGoalsRepo.save.mockImplementation((g) => Promise.resolve(g as SalesGoal));

      const result = await service.update(1, { valorMeta: 20000 });

      expect(result.valorMeta).toBe(20000);
    });

    it('lança NotFoundException quando a meta a atualizar não existe', async () => {
      salesGoalsRepo.findOne.mockResolvedValue(null);

      await expect(service.update(999, { valorMeta: 20000 })).rejects.toThrow(NotFoundException);
    });

    it('lança NotFoundException quando o novo funcionário informado não existe', async () => {
      salesGoalsRepo.findOne.mockResolvedValue(buildGoal());
      employeeRepo.findOne.mockResolvedValue(null);

      await expect(service.update(1, { cpfFuncionario: '99988877766' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lança ConflictException quando o novo período já está ocupado por outra meta', async () => {
      salesGoalsRepo.findOne
        .mockResolvedValueOnce(buildGoal({ idGoal: 1, mes: 6 }))
        .mockResolvedValueOnce(buildGoal({ idGoal: 2, mes: 7 }));

      await expect(service.update(1, { mes: 7 })).rejects.toThrow(ConflictException);
    });

    it('não revalida unicidade quando período não muda', async () => {
      salesGoalsRepo.findOne.mockResolvedValue(buildGoal());
      salesGoalsRepo.save.mockImplementation((g) => Promise.resolve(g as SalesGoal));

      await service.update(1, { valorBonus: 0.05 });

      expect(salesGoalsRepo.findOne).toHaveBeenCalledTimes(1);
    });
  });

  describe('remove', () => {
    it('remove a meta existente', async () => {
      const goal = buildGoal();
      salesGoalsRepo.findOne.mockResolvedValue(goal);

      await service.remove(1);

      expect(salesGoalsRepo.remove).toHaveBeenCalledWith(goal);
    });

    it('lança NotFoundException quando a meta a remover não existe', async () => {
      salesGoalsRepo.findOne.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getIndividualProgress', () => {
    it('calcula o percentual de progresso de cada funcionário', async () => {
      salesGoalsRepo.createQueryBuilder.mockReturnValue(
        makeQueryBuilder({
          getRawMany: jest.fn().mockResolvedValue([
            {
              cpf: CPF_FUNCIONARIO,
              nome: 'Funcionário Teste',
              codigo_funcionario: 'F001',
              meta: '10000.00',
              realizado: '2500.00',
            },
          ]),
        }) as never,
      );

      const result = await service.getIndividualProgress({ mes: 6, ano: 2026 });

      expect(result).toEqual([
        {
          funcionario: {
            cpf: CPF_FUNCIONARIO,
            nome: 'Funcionário Teste',
            codigo_funcionario: 'F001',
          },
          meta: 10000,
          realizado: 2500,
          percentual: 25,
        },
      ]);
    });

    it('retorna percentual 0 quando a meta é 0 (evita divisão por zero)', async () => {
      salesGoalsRepo.createQueryBuilder.mockReturnValue(
        makeQueryBuilder({
          getRawMany: jest.fn().mockResolvedValue([
            {
              cpf: CPF_FUNCIONARIO,
              nome: 'Funcionário Teste',
              codigo_funcionario: 'F001',
              meta: '0',
              realizado: '500.00',
            },
          ]),
        }) as never,
      );

      const result = await service.getIndividualProgress({ mes: 6, ano: 2026 });

      expect(result[0].percentual).toBe(0);
    });

    it('usa mês/ano atuais quando não informados', async () => {
      const qb = makeQueryBuilder();
      salesGoalsRepo.createQueryBuilder.mockReturnValue(qb as never);

      await service.getIndividualProgress({});

      expect(qb.andWhere).toHaveBeenCalledWith('goal.mes = :mes', expect.any(Object));
      expect(qb.andWhere).toHaveBeenCalledWith('goal.ano = :ano', expect.any(Object));
    });
  });

  describe('getTeamProgress', () => {
    it('calcula o percentual de progresso da meta coletiva', async () => {
      salesGoalsRepo.findOne.mockResolvedValue(
        buildGoal({ cpfFuncionario: null, valorMeta: 100000 }),
      );
      ordersService.sumTotalInStoreSalesByPeriod.mockResolvedValue(30000);

      const result = await service.getTeamProgress({ mes: 6, ano: 2026 });

      expect(result).toEqual({ meta: 100000, realizado: 30000, percentual: 30 });
    });

    it('lança NotFoundException quando não há meta coletiva cadastrada no período', async () => {
      salesGoalsRepo.findOne.mockResolvedValue(null);

      await expect(service.getTeamProgress({ mes: 6, ano: 2026 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('retorna percentual 0 quando a meta coletiva é 0', async () => {
      salesGoalsRepo.findOne.mockResolvedValue(buildGoal({ cpfFuncionario: null, valorMeta: 0 }));
      ordersService.sumTotalInStoreSalesByPeriod.mockResolvedValue(0);

      const result = await service.getTeamProgress({ mes: 6, ano: 2026 });

      expect(result.percentual).toBe(0);
    });
  });
});
