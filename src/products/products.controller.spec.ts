import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '../common/enums/role.enum';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

const mockProductsService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  addCategory: jest.fn(),
  removeCategory: jest.fn(),
};

describe('ProductsController', () => {
  let controller: ProductsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        { provide: ProductsService, useValue: mockProductsService },
        Reflector,
      ],
    }).compile();

    controller = module.get(ProductsController);
  });

  const proto = () => controller.constructor.prototype;

  describe('POST / (create)', () => {
    it('exige JwtAuthGuard e RolesGuard', () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, proto().create);
      expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
    });

    it('permite gerente e administrador', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, proto().create);
      expect(roles).toEqual([Role.GERENTE, Role.ADMINISTRADOR]);
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

    it('permite gerente e administrador', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, proto().update);
      expect(roles).toEqual([Role.GERENTE, Role.ADMINISTRADOR]);
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

  describe('POST /:id/categories/:categoryId (addCategory)', () => {
    it('exige JwtAuthGuard e RolesGuard', () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, proto().addCategory);
      expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
    });

    it('permite gerente e administrador', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, proto().addCategory);
      expect(roles).toEqual([Role.GERENTE, Role.ADMINISTRADOR]);
    });
  });

  describe('DELETE /:id/categories/:categoryId (removeCategory)', () => {
    it('exige JwtAuthGuard e RolesGuard', () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, proto().removeCategory);
      expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
    });

    it('permite gerente e administrador', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, proto().removeCategory);
      expect(roles).toEqual([Role.GERENTE, Role.ADMINISTRADOR]);
    });
  });
});
