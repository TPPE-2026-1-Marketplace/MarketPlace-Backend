import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';

import { OrderItem } from './entities/order-item.entity';
import { Order, OrderStatus, TipoRetirada } from './entities/order.entity';
import { OrdersService } from './orders.service';
import { CouponsService } from '../coupons/coupons.service';
import { StockLog } from '../inventory/entities/stock-log.entity';
import { Stock } from '../inventory/entities/stock.entity';
import { PeopleService } from '../people/people.service';
import { ProductVariant } from '../product-variants/entities/product-variant.entity';

import type { Person } from '../people/entities/person.entity';
import type { TestingModule } from '@nestjs/testing';

function buildVariant(overrides: Partial<ProductVariant> = {}): ProductVariant {
  return {
    codigoSku: 'SKU-1',
    precoVariante: 50,
    ativo: true,
    cor: null,
    tamanho: null,
    medidas: null,
    catalogImages: [],
    product: {} as never,
    ...overrides,
  } as ProductVariant;
}

describe('OrdersService', () => {
  let service: OrdersService;
  let manager: {
    findOne: jest.Mock;
    getRepository: jest.Mock;
  };
  let ordersRepo: { create: jest.Mock; save: jest.Mock };
  let orderItemsRepo: { create: jest.Mock };
  let variantsRepo: { find: jest.Mock };
  let stockRepo: { find: jest.Mock; create: jest.Mock; save: jest.Mock };
  let stockLogRepo: { create: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();

    ordersRepo = {
      create: jest.fn((o) => o),
      save: jest.fn((o) => Promise.resolve({ idPedido: 1, ...o })),
    };
    orderItemsRepo = { create: jest.fn((i) => i) };
    variantsRepo = { find: jest.fn() };
    stockRepo = { find: jest.fn(), create: jest.fn((s) => s), save: jest.fn() };
    stockLogRepo = { create: jest.fn((l) => l), save: jest.fn() };

    manager = {
      findOne: jest.fn(),
      getRepository: jest.fn((entity: unknown) => {
        if (entity === Order) return ordersRepo;
        if (entity === OrderItem) return orderItemsRepo;
        if (entity === ProductVariant) return variantsRepo;
        if (entity === Stock) return stockRepo;
        if (entity === StockLog) return stockLogRepo;
      }),
    };

    const mockDataSource = {
      transaction: jest.fn((cb: (m: typeof manager) => Promise<unknown>) => cb(manager)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: {} },
        { provide: getRepositoryToken(OrderItem), useValue: {} },
        { provide: getRepositoryToken(ProductVariant), useValue: {} },
        { provide: CouponsService, useValue: { validate: jest.fn(), incrementUsage: jest.fn() } },
        { provide: PeopleService, useValue: {} },
        { provide: getDataSourceToken(), useValue: mockDataSource },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  const baseDto = {
    items: [{ variantSku: 'SKU-1', quantidade: 2 }],
    tipoRetirada: TipoRetirada.ENTREGA,
    valorFrete: 10,
  };

  it('lança NotFoundException quando o cliente não existe', async () => {
    manager.findOne.mockResolvedValue(null);
    await expect(service.create('00000000000', baseDto as never)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('lança NotFoundException quando a variante não existe no catálogo', async () => {
    manager.findOne.mockResolvedValue({ cpf: '1' } as Person);
    variantsRepo.find.mockResolvedValue([]);
    await expect(service.create('1', baseDto as never)).rejects.toThrow(NotFoundException);
  });

  it('lança BadRequestException quando a variante está inativa', async () => {
    manager.findOne.mockResolvedValue({ cpf: '1' } as Person);
    variantsRepo.find.mockResolvedValue([buildVariant({ ativo: false })]);
    await expect(service.create('1', baseDto as never)).rejects.toThrow(BadRequestException);
  });

  it('lança ConflictException quando o estoque online é insuficiente', async () => {
    manager.findOne.mockResolvedValue({ cpf: '1' } as Person);
    variantsRepo.find.mockResolvedValue([buildVariant()]);
    stockRepo.find.mockResolvedValue([{ codigoSku: 'SKU-1', qtdOnline: 1, qtdLojaFisica: 0 }]);
    await expect(service.create('1', baseDto as never)).rejects.toThrow(ConflictException);
  });

  it('calcula subtotal + frete e cria pedido PENDING no caminho feliz', async () => {
    manager.findOne.mockResolvedValue({ cpf: '1' } as Person);
    variantsRepo.find.mockResolvedValue([buildVariant({ precoVariante: 50 })]);
    stockRepo.find.mockResolvedValue([{ codigoSku: 'SKU-1', qtdOnline: 10, qtdLojaFisica: 0 }]);

    const result = await service.create('1', baseDto as never);

    expect(result.idPedido).toBe(1);
    expect(ordersRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        subtotal: 100,
        valorFrete: 10,
        valorTotal: 110,
        status: OrderStatus.PENDING,
        tipoRetirada: TipoRetirada.ENTREGA,
      }),
    );
    expect(stockRepo.save).toHaveBeenCalled();
    expect(stockLogRepo.save).toHaveBeenCalled();
  });

  it('gera código de verificação e zera o frete em retirada na loja', async () => {
    manager.findOne.mockResolvedValue({ cpf: '1' } as Person);
    variantsRepo.find.mockResolvedValue([buildVariant({ precoVariante: 50 })]);
    stockRepo.find.mockResolvedValue([{ codigoSku: 'SKU-1', qtdOnline: 0, qtdLojaFisica: 10 }]);

    await service.create('1', {
      items: [{ variantSku: 'SKU-1', quantidade: 2 }],
      tipoRetirada: TipoRetirada.LOJA,
      valorFrete: 0,
    } as never);

    const created = ordersRepo.create.mock.calls[0][0];
    expect(created.valorFrete).toBe(0);
    expect(created.codigoVerificacaoRetirada).toMatch(/^\d{6}$/);
  });
});
