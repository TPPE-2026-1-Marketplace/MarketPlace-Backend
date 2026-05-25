import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';

import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

import type { TestingModule } from '@nestjs/testing';

const mockEmployeesService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
};

describe('EmployeesController', () => {
  let controller: EmployeesController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmployeesController],
      providers: [
        {
          provide: EmployeesService,
          useValue: mockEmployeesService,
        },
      ],
    }).compile();

    controller = module.get(EmployeesController);
  });

  it('protege o controller com JwtAuthGuard e RolesGuard', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, EmployeesController);
    expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
  });

  it('restringe o acesso ao papel de administrador', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, EmployeesController);
    expect(roles).toEqual([Role.ADMINISTRADOR]);
  });

  it('delega create ao service', async () => {
    mockEmployeesService.create.mockResolvedValue({ cpf: '12345678901' });

    await controller.create({
      cpf: '12345678901',
      nome: 'Ana',
      email: 'ana@email.com',
      role_perfil: Role.CAIXA,
    } as never);

    expect(mockEmployeesService.create).toHaveBeenCalled();
  });
});
