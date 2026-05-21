import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '../common/enums/role.enum';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

const mockCategoriesService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe('CategoriesController', () => {
  let controller: CategoriesController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [
        { provide: CategoriesService, useValue: mockCategoriesService },
        Reflector,
      ],
    }).compile();

    controller = module.get(CategoriesController);
  });

  const proto = () => controller.constructor.prototype;

  describe('POST / (create)', () => {
    it('exige JwtAuthGuard e RolesGuard', () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, proto().create);
      expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
    });

    it('permite apenas administrador', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, proto().create);
      expect(roles).toEqual([Role.ADMINISTRADOR]);
    });
  });

  describe('GET / (findAll)', () => {
    it('não tem guard — endpoint público', () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, proto().findAll);
      expect(guards).toBeUndefined();
    });
  });

  describe('GET /:id (findOne)', () => {
    it('não tem guard — endpoint público', () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, proto().findOne);
      expect(guards).toBeUndefined();
    });
  });

  describe('PATCH /:id (update)', () => {
    it('exige JwtAuthGuard e RolesGuard', () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, proto().update);
      expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
    });

    it('permite apenas administrador', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, proto().update);
      expect(roles).toEqual([Role.ADMINISTRADOR]);
    });
  });

  describe('DELETE /:id (remove)', () => {
    it('exige JwtAuthGuard e RolesGuard', () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, proto().remove);
      expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
    });

    it('permite apenas administrador', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, proto().remove);
      expect(roles).toEqual([Role.ADMINISTRADOR]);
    });
  });
});
