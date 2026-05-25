import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';

import { ProductVariantsController } from './product-variants.controller';
import { ProductVariantsService } from './product-variants.service';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

import type { TestingModule } from '@nestjs/testing';

const mockProductVariantsService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe('ProductVariantsController', () => {
  let controller: ProductVariantsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductVariantsController],
      providers: [
        { provide: ProductVariantsService, useValue: mockProductVariantsService },
        Reflector,
      ],
    }).compile();

    controller = module.get(ProductVariantsController);
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

  describe('GET /:sku (findOne)', () => {
    it('não tem guard — endpoint público', () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, proto().findOne);
      expect(guards).toBeUndefined();
    });
  });

  describe('PATCH /:sku (update)', () => {
    it('exige JwtAuthGuard e RolesGuard', () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, proto().update);
      expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
    });

    it('permite gerente e administrador', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, proto().update);
      expect(roles).toEqual([Role.GERENTE, Role.ADMINISTRADOR]);
    });
  });

  describe('DELETE /:sku (remove)', () => {
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
