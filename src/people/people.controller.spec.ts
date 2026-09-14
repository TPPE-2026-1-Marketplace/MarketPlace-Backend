import { Writable } from 'stream';

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
import type { Response } from 'express';

const mockPeopleService = {
  registerPerson: jest.fn(),
  registerUser: jest.fn(),
  getAllForExport: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

/**
 * Fake de `Response` que se comporta como um Writable de verdade — necessário
 * porque `exportPeople` faz `csvStream.pipe(res)`, e `.pipe()` exige que o
 * destino seja um stream real (não um objeto qualquer com `.write`/`.end`).
 */
function createFakeResponse() {
  const chunks: string[] = [];
  const writable = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      chunks.push(chunk.toString());
      callback();
    },
  });

  const res = writable as unknown as Response & { chunks: string[] };
  res.setHeader = jest.fn();
  res.chunks = chunks;

  return res;
}

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

  describe('exportPeople', () => {
    it('deve exigir JwtAuthGuard, RolesGuard e papel administrador', () => {
      const guards = Reflect.getMetadata(
        GUARDS_METADATA,
        controller.constructor.prototype.exportPeople,
      );
      const roles = Reflect.getMetadata(ROLES_KEY, controller.constructor.prototype.exportPeople);

      expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
      expect(roles).toEqual([Role.ADMINISTRADOR]);
    });

    it('deve preencher nome e telefone no CSV quando presentes', async () => {
      mockPeopleService.getAllForExport.mockResolvedValue([
        { cpf: '11111111111', nome: 'Maria', email: 'maria@email.com', telefone: '61999999999' },
      ]);
      const res = createFakeResponse();

      await controller.exportPeople(res);
      await new Promise((resolve) => res.once('finish', resolve));

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="clientes.csv"',
      );
      const csv = res.chunks.join('');
      expect(csv).toContain('Maria');
      expect(csv).toContain('61999999999');
    });

    it('deve cair no fallback de string vazia quando nome e telefone estão ausentes', async () => {
      mockPeopleService.getAllForExport.mockResolvedValue([
        { cpf: '22222222222', nome: null, email: 'sem-dados@email.com', telefone: null },
      ]);
      const res = createFakeResponse();

      await controller.exportPeople(res);
      await new Promise((resolve) => res.once('finish', resolve));

      const csv = res.chunks.join('');
      expect(csv).toContain('sem-dados@email.com');
      // fast-csv serializa null/undefined como campo vazio, não como "null".
      expect(csv).not.toContain('null');
    });
  });

  describe('findAll', () => {
    it('deve exigir JwtAuthGuard e RolesGuard para funcionários', () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, controller.constructor.prototype.findAll);
      const roles = Reflect.getMetadata(ROLES_KEY, controller.constructor.prototype.findAll);

      expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
      expect(roles).toEqual([Role.CAIXA, Role.VENDEDOR, Role.GERENTE, Role.ADMINISTRADOR]);
    });

    it('deve repassar page e limit separadamente para o service', () => {
      mockPeopleService.findAll.mockReturnValue({ data: [], meta: {} });

      void controller.findAll({ page: 2, limit: 10 });

      expect(mockPeopleService.findAll).toHaveBeenCalledWith(2, 10);
    });
  });

  describe('findOne', () => {
    it('deve exigir apenas JwtAuthGuard (sem restrição de role)', () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, controller.constructor.prototype.findOne);
      const roles = Reflect.getMetadata(ROLES_KEY, controller.constructor.prototype.findOne);

      expect(guards).toEqual([JwtAuthGuard]);
      expect(roles).toBeUndefined();
    });

    it('deve delegar para o service pelo cpf', () => {
      mockPeopleService.findOne.mockReturnValue({ cpf: '12345678901' });

      void controller.findOne('12345678901');

      expect(mockPeopleService.findOne).toHaveBeenCalledWith('12345678901');
    });
  });

  describe('update', () => {
    it('deve delegar cpf e dto para o service', () => {
      mockPeopleService.update.mockReturnValue({ cpf: '12345678901' });

      void controller.update('12345678901', { nome: 'Novo Nome' });

      expect(mockPeopleService.update).toHaveBeenCalledWith('12345678901', { nome: 'Novo Nome' });
    });
  });

  describe('remove', () => {
    it('deve delegar o cpf para o service', () => {
      void controller.remove('12345678901');

      expect(mockPeopleService.remove).toHaveBeenCalledWith('12345678901');
    });
  });
});
