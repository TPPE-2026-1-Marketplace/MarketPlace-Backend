import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '../common/enums/role.enum';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { ImagesController } from './images.controller';
import { ImagesService } from './images.service';

const mockImagesService = {
  createImage: jest.fn(),
  linkImageToVariant: jest.fn(),
  findCatalogByVariantSku: jest.fn(),
};

describe('ImagesController', () => {
  let controller: ImagesController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImagesController],
      providers: [
        { provide: ImagesService, useValue: mockImagesService },
        Reflector,
      ],
    }).compile();

    controller = module.get(ImagesController);
  });

  const proto = () => controller.constructor.prototype;

  describe('POST / (createImage)', () => {
    it('exige JwtAuthGuard e RolesGuard', () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, proto().createImage);
      expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
    });

    it('permite gerente e administrador', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, proto().createImage);
      expect(roles).toEqual([Role.GERENTE, Role.ADMINISTRADOR]);
    });
  });

  describe('POST /catalog (linkImageToVariant)', () => {
    it('exige JwtAuthGuard e RolesGuard', () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, proto().linkImageToVariant);
      expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
    });

    it('permite gerente e administrador', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, proto().linkImageToVariant);
      expect(roles).toEqual([Role.GERENTE, Role.ADMINISTRADOR]);
    });
  });

  describe('GET /catalog/:variantSku (findCatalogByVariantSku)', () => {
    it('não tem guard — endpoint público', () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, proto().findCatalogByVariantSku);
      expect(guards).toBeUndefined();
    });
  });
});
