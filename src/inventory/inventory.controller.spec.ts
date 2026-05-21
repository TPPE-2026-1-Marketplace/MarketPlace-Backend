import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { MovementType } from './entities/stock-log.entity';
import { Role } from '../common/enums/role.enum';
import { ROLES_KEY } from '../common/decorators/roles.decorator';

const mockService = {
  findPublic: jest.fn(),
  adjust: jest.fn(),
  getLogs: jest.fn(),
};

const mockUser = { sub: '12345678901', email: 'gerente@loja.com', role: Role.GERENTE };

describe('InventoryController', () => {
  let controller: InventoryController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [{ provide: InventoryService, useValue: mockService }],
    }).compile();
    controller = module.get<InventoryController>(InventoryController);
  });

  describe('GET /inventory/:sku (findPublic)', () => {
    it('retorna qtdOnline e qtdLojaFisica quando variante existe', async () => {
      mockService.findPublic.mockResolvedValue({ qtdOnline: 10, qtdLojaFisica: 5 });

      const result = await controller.findPublic('CAMISETA-P');

      expect(result).toEqual({ qtdOnline: 10, qtdLojaFisica: 5 });
      expect(mockService.findPublic).toHaveBeenCalledWith('CAMISETA-P');
    });

    it('propaga NotFoundException quando variante não existe', async () => {
      mockService.findPublic.mockRejectedValue(new NotFoundException());

      await expect(controller.findPublic('INEXISTENTE')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('PATCH /inventory/:sku (adjust)', () => {
    it('exige roles GERENTE ou ADMINISTRADOR', () => {
      const roles: Role[] = Reflect.getMetadata(ROLES_KEY, controller.adjust);
      expect(roles).toContain(Role.GERENTE);
      expect(roles).toContain(Role.ADMINISTRADOR);
    });

    it('chama service.adjust com sku, dto e cpf do usuário logado', async () => {
      const dto = { qtdOnline: 20, tipoMovimentacao: MovementType.ENTRADA };
      const updated = { codigoSku: 'CAMISETA-P', qtdOnline: 20, qtdLojaFisica: 5 };
      mockService.adjust.mockResolvedValue(updated);

      const result = await controller.adjust('CAMISETA-P', dto as any, mockUser as any);

      expect(mockService.adjust).toHaveBeenCalledWith('CAMISETA-P', dto, mockUser.sub);
      expect(result).toMatchObject({ qtdOnline: 20 });
    });

    it('propaga NotFoundException quando variante não existe', async () => {
      mockService.adjust.mockRejectedValue(new NotFoundException());

      await expect(
        controller.adjust('INEXISTENTE', { qtdOnline: 5, tipoMovimentacao: MovementType.AJUSTE } as any, mockUser as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('GET /inventory/:sku/logs (getLogs)', () => {
    it('exige role ADMINISTRADOR', () => {
      const roles: Role[] = Reflect.getMetadata(ROLES_KEY, controller.getLogs);
      expect(roles).toEqual([Role.ADMINISTRADOR]);
    });

    it('retorna logs paginados e passa filtros ao service', async () => {
      const mockResult = { data: [], meta: { page: 1, limit: 50, total: 0, totalPages: 1 } };
      mockService.getLogs.mockResolvedValue(mockResult);

      const result = await controller.getLogs('CAMISETA-P', { page: 1, limit: 50 } as any);

      expect(result).toEqual(mockResult);
      expect(mockService.getLogs).toHaveBeenCalledWith('CAMISETA-P', 1, 50, {
        tipoMovimentacao: undefined,
        dataInicio: undefined,
        dataFim: undefined,
      });
    });

    it('converte dataInicio e dataFim string para Date', async () => {
      mockService.getLogs.mockResolvedValue({ data: [], meta: {} });

      await controller.getLogs('CAMISETA-P', {
        page: 1,
        limit: 50,
        dataInicio: '2026-01-01T00:00:00Z',
        dataFim: '2026-12-31T23:59:59Z',
      } as any);

      expect(mockService.getLogs).toHaveBeenCalledWith('CAMISETA-P', 1, 50, {
        tipoMovimentacao: undefined,
        dataInicio: new Date('2026-01-01T00:00:00Z'),
        dataFim: new Date('2026-12-31T23:59:59Z'),
      });
    });

    it('filtra por tipoMovimentacao quando fornecido', async () => {
      mockService.getLogs.mockResolvedValue({ data: [], meta: {} });

      await controller.getLogs('CAMISETA-P', {
        page: 1,
        limit: 50,
        tipoMovimentacao: MovementType.ENTRADA,
      } as any);

      expect(mockService.getLogs).toHaveBeenCalledWith('CAMISETA-P', 1, 50, {
        tipoMovimentacao: MovementType.ENTRADA,
        dataInicio: undefined,
        dataFim: undefined,
      });
    });
  });
});
