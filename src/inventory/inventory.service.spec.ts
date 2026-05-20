import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Between, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { ProductVariant } from '../product-variants/entities/product-variant.entity';
import { MovementType, StockLog } from './entities/stock-log.entity';
import { Stock } from './entities/stock.entity';
import { InventoryService } from './inventory.service';

const mockVariant: ProductVariant = {
  codigoSku: 'CAMISETA-P',
  precoVariante: 49.9,
  ativo: true,
  cor: 'branco',
  tamanho: 'P',
  medidas: null,
  catalogImages: [],
  product: {} as any,
};

const mockStock: Stock = {
  codigoSku: 'CAMISETA-P',
  qtdOnline: 10,
  qtdLojaFisica: 5,
  variant: mockVariant,
};

const mockLog: StockLog = {
  idLog: 1,
  codigoSku: 'CAMISETA-P',
  idPedido: null,
  tipoMovimentacao: MovementType.AJUSTE,
  quantidadeMovimentada: 5,
  dataCriacao: new Date('2026-05-20T10:00:00Z'),
  valorAnteriorOnline: 10,
  valorNovoOnline: 15,
  valorAnteriorLoja: 5,
  valorNovoLoja: 5,
  origem: '12345678901',
  motivo: null,
  variant: mockVariant,
};

describe('InventoryService', () => {
  let service: InventoryService;
  let stockRepo: jest.Mocked<Repository<Stock>>;
  let stockLogRepo: jest.Mocked<Repository<StockLog>>;
  let variantRepo: jest.Mocked<Repository<ProductVariant>>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        {
          provide: getRepositoryToken(Stock),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            findAndCount: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(StockLog),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findAndCount: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ProductVariant),
          useValue: { existsBy: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(InventoryService);
    stockRepo = module.get(getRepositoryToken(Stock));
    stockLogRepo = module.get(getRepositoryToken(StockLog));
    variantRepo = module.get(getRepositoryToken(ProductVariant));
  });

  describe('findPublic', () => {
    it('retorna qtdOnline e qtdLojaFisica quando variante e estoque existem', async () => {
      variantRepo.existsBy.mockResolvedValue(true);
      stockRepo.findOne.mockResolvedValue(mockStock);

      const result = await service.findPublic('CAMISETA-P');

      expect(result).toEqual({ qtdOnline: 10, qtdLojaFisica: 5 });
    });

    it('retorna zeros quando variante existe mas estoque ainda não foi criado', async () => {
      variantRepo.existsBy.mockResolvedValue(true);
      stockRepo.findOne.mockResolvedValue(null);

      const result = await service.findPublic('CAMISETA-P');

      expect(result).toEqual({ qtdOnline: 0, qtdLojaFisica: 0 });
    });

    it('lança NotFoundException quando variante não existe', async () => {
      variantRepo.existsBy.mockResolvedValue(false);

      await expect(service.findPublic('INEXISTENTE')).rejects.toBeInstanceOf(NotFoundException);

      expect(stockRepo.findOne).not.toHaveBeenCalled();
    });
  });

  describe('findBySku', () => {
    it('retorna o estoque quando SKU existe', async () => {
      stockRepo.findOne.mockResolvedValue(mockStock);

      const result = await service.findBySku('CAMISETA-P');

      expect(result).toEqual(mockStock);
      expect(stockRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { codigoSku: 'CAMISETA-P' } }),
      );
    });

    it('lança NotFoundException quando SKU não existe', async () => {
      stockRepo.findOne.mockResolvedValue(null);

      await expect(service.findBySku('INEXISTENTE')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('adjust', () => {
    it('atualiza qtdOnline do estoque existente', async () => {
      const current = { ...mockStock };
      stockRepo.findOne.mockResolvedValue(current);
      stockRepo.save.mockResolvedValue({ ...current, qtdOnline: 20 });
      stockLogRepo.create.mockReturnValue(mockLog);
      stockLogRepo.save.mockResolvedValue(mockLog);

      await service.adjust(
        'CAMISETA-P',
        { qtdOnline: 20, tipoMovimentacao: MovementType.ENTRADA },
        '12345678901',
      );

      expect(stockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ qtdOnline: 20 }),
      );
    });

    it('preserva qtdLojaFisica quando apenas qtdOnline é fornecido', async () => {
      stockRepo.findOne.mockResolvedValue({ ...mockStock });
      stockRepo.save.mockResolvedValue({ ...mockStock, qtdOnline: 20 });
      stockLogRepo.create.mockReturnValue(mockLog);
      stockLogRepo.save.mockResolvedValue(mockLog);

      await service.adjust('CAMISETA-P', { qtdOnline: 20, tipoMovimentacao: MovementType.AJUSTE });

      expect(stockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ qtdLojaFisica: 5 }),
      );
    });

    it('cria registro de estoque quando variante existe mas ainda não tem estoque', async () => {
      const newStock = { codigoSku: 'CAMISETA-P', qtdOnline: 0, qtdLojaFisica: 0 } as Stock;
      stockRepo.findOne.mockResolvedValue(null);
      variantRepo.existsBy.mockResolvedValue(true);
      stockRepo.create.mockReturnValue(newStock);
      stockRepo.save.mockResolvedValue({ ...newStock, qtdOnline: 15 });
      stockLogRepo.create.mockReturnValue(mockLog);
      stockLogRepo.save.mockResolvedValue(mockLog);

      await service.adjust(
        'CAMISETA-P',
        { qtdOnline: 15, tipoMovimentacao: MovementType.ENTRADA },
      );

      expect(stockRepo.create).toHaveBeenCalledWith({
        codigoSku: 'CAMISETA-P',
        qtdOnline: 0,
        qtdLojaFisica: 0,
      });
    });

    it('lança NotFoundException quando variante não existe', async () => {
      stockRepo.findOne.mockResolvedValue(null);
      variantRepo.existsBy.mockResolvedValue(false);

      await expect(
        service.adjust('INEXISTENTE', { qtdOnline: 10, tipoMovimentacao: MovementType.AJUSTE }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(stockRepo.save).not.toHaveBeenCalled();
    });

    it('registra log com valores anterior e novo corretos', async () => {
      stockRepo.findOne.mockResolvedValue({ ...mockStock, qtdOnline: 10, qtdLojaFisica: 5 });
      stockRepo.save.mockResolvedValue({ ...mockStock, qtdOnline: 15 });
      stockLogRepo.create.mockReturnValue(mockLog);
      stockLogRepo.save.mockResolvedValue(mockLog);

      await service.adjust(
        'CAMISETA-P',
        { qtdOnline: 15, tipoMovimentacao: MovementType.ENTRADA },
        '12345678901',
      );

      expect(stockLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          valorAnteriorOnline: 10,
          valorNovoOnline: 15,
          valorAnteriorLoja: 5,
          valorNovoLoja: 5,
          origem: '12345678901',
        }),
      );
    });

    it('grava motivo no log quando fornecido', async () => {
      stockRepo.findOne.mockResolvedValue({ ...mockStock });
      stockRepo.save.mockResolvedValue(mockStock);
      stockLogRepo.create.mockReturnValue(mockLog);
      stockLogRepo.save.mockResolvedValue(mockLog);

      await service.adjust('CAMISETA-P', {
        qtdOnline: 10,
        tipoMovimentacao: MovementType.AJUSTE,
        motivo: 'Inventário mensal',
      });

      expect(stockLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ motivo: 'Inventário mensal' }),
      );
    });

    it('grava null no log quando origem não é fornecida', async () => {
      stockRepo.findOne.mockResolvedValue({ ...mockStock });
      stockRepo.save.mockResolvedValue(mockStock);
      stockLogRepo.create.mockReturnValue(mockLog);
      stockLogRepo.save.mockResolvedValue(mockLog);

      await service.adjust('CAMISETA-P', { qtdOnline: 10, tipoMovimentacao: MovementType.AJUSTE });

      expect(stockLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ origem: null }),
      );
    });
  });

  describe('getLogs', () => {
    it('retorna logs paginados com meta correto', async () => {
      stockLogRepo.findAndCount.mockResolvedValue([[mockLog], 1]);

      const result = await service.getLogs('CAMISETA-P', 1, 50);

      expect(result.data).toEqual([mockLog]);
      expect(result.meta).toEqual({ page: 1, limit: 50, total: 1, totalPages: 1 });
    });

    it('calcula totalPages corretamente', async () => {
      stockLogRepo.findAndCount.mockResolvedValue([[], 110]);

      const result = await service.getLogs('CAMISETA-P', 1, 50);

      expect(result.meta.totalPages).toBe(3);
    });

    it('retorna totalPages 1 quando não há registros', async () => {
      stockLogRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.getLogs('CAMISETA-P', 1, 50);

      expect(result.meta.totalPages).toBe(1);
    });

    it('aplica skip correto para page > 1', async () => {
      stockLogRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.getLogs('CAMISETA-P', 3, 50);

      expect(stockLogRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 100, take: 50 }),
      );
    });

    it('ordena por dataCriacao DESC', async () => {
      stockLogRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.getLogs('CAMISETA-P', 1, 50);

      expect(stockLogRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ order: { dataCriacao: 'DESC' } }),
      );
    });

    it('filtra por tipoMovimentacao quando fornecido', async () => {
      stockLogRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.getLogs('CAMISETA-P', 1, 50, { tipoMovimentacao: MovementType.ENTRADA });

      expect(stockLogRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tipoMovimentacao: MovementType.ENTRADA }),
        }),
      );
    });

    it('aplica MoreThanOrEqual quando apenas dataInicio é fornecido', async () => {
      stockLogRepo.findAndCount.mockResolvedValue([[], 0]);
      const dataInicio = new Date('2026-01-01');

      await service.getLogs('CAMISETA-P', 1, 50, { dataInicio });

      expect(stockLogRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ dataCriacao: MoreThanOrEqual(dataInicio) }),
        }),
      );
    });

    it('aplica LessThanOrEqual quando apenas dataFim é fornecido', async () => {
      stockLogRepo.findAndCount.mockResolvedValue([[], 0]);
      const dataFim = new Date('2026-12-31');

      await service.getLogs('CAMISETA-P', 1, 50, { dataFim });

      expect(stockLogRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ dataCriacao: LessThanOrEqual(dataFim) }),
        }),
      );
    });

    it('aplica Between quando dataInicio e dataFim são fornecidos', async () => {
      stockLogRepo.findAndCount.mockResolvedValue([[], 0]);
      const dataInicio = new Date('2026-01-01');
      const dataFim = new Date('2026-12-31');

      await service.getLogs('CAMISETA-P', 1, 50, { dataInicio, dataFim });

      expect(stockLogRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ dataCriacao: Between(dataInicio, dataFim) }),
        }),
      );
    });
  });
});
