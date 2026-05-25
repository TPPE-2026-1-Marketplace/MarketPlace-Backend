import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';

import { PeopleController } from './people.controller';
import { PeopleService } from './people.service';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

import type { TestingModule } from '@nestjs/testing';

const mockPeopleService = {
  registerPerson: jest.fn(),
  registerUser: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe('PeopleController', () => {
  let controller: PeopleController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PeopleController],
      providers: [
        {
          provide: PeopleService,
          useValue: mockPeopleService,
        },
        Reflector,
      ],
    }).compile();

    controller = module.get(PeopleController);
  });

  describe('registerPerson', () => {
    it('deve exigir JwtAuthGuard e RolesGuard', () => {
      const guards = Reflect.getMetadata(
        GUARDS_METADATA,
        controller.constructor.prototype.registerPerson,
      );

      expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
    });

    it('deve permitir apenas caixa ou cargos acima', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, controller.constructor.prototype.registerPerson);

      expect(roles).toEqual([Role.CAIXA, Role.VENDEDOR, Role.GERENTE, Role.ADMINISTRADOR]);
    });

    it('deve delegar para o service', async () => {
      mockPeopleService.registerPerson.mockResolvedValue({ cpf: '12345678901' });

      await controller.registerPerson({
        cpf: '12345678901',
        nome: 'João',
        email: 'joao@email.com',
      });

      expect(mockPeopleService.registerPerson).toHaveBeenCalledWith({
        cpf: '12345678901',
        nome: 'João',
        email: 'joao@email.com',
      });
    });
  });

  describe('registerUser', () => {
    it('não deve carregar metadados de guard específico', () => {
      const guards = Reflect.getMetadata(
        GUARDS_METADATA,
        controller.constructor.prototype.registerUser,
      );

      expect(guards).toBeUndefined();
    });
  });
});
