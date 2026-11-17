import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';

import { OrderItem } from './entities/order-item.entity';
import { Order, OrderStatus, TipoRetirada } from './entities/order.entity';
import { OrdersService } from './orders.service';
import { CouponsService } from '../coupons/coupons.service';
import { StockLog } from '../inventory/entities/stock-log.entity';
import { Stock } from '../inventory/entities/stock.entity';
import { MailService } from '../mail/mail.service';
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
  let ordersRepository: { findOne: jest.Mock };
  let mailService: { isEnabled: jest.Mock; send: jest.Mock };

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

    ordersRepository = { findOne: jest.fn() };
    mailService = { isEnabled: jest.fn(() => true), send: jest.fn().mockResolvedValue(undefined) };

    const mockDataSource = {
      transaction: jest.fn((cb: (m: typeof manager) => Promise<unknown>) => cb(manager)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: ordersRepository },
        { provide: getRepositoryToken(OrderItem), useValue: {} },
        { provide: getRepositoryToken(ProductVariant), useValue: {} },
        { provide: CouponsService, useValue: { validate: jest.fn(), incrementUsage: jest.fn() } },
        { provide: PeopleService, useValue: {} },
        { provide: MailService, useValue: mailService },
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
    // A criação do pedido NÃO baixa estoque — isso ocorre na confirmação do pagamento.
    expect(stockRepo.save).not.toHaveBeenCalled();
    expect(stockLogRepo.save).not.toHaveBeenCalled();
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

  describe('createInStore (CPF do cliente)', () => {
    const seller = { cpf: '22222222222', ativo: true, role_perfil: 'vendedor' };
    const inStoreDto = {
      codigoVendedor: 'ANA01',
      items: [{ variantSku: 'SKU-1', quantidade: 1 }],
    };

    it('rejeita CPF novo (avulso) com dígito verificador inválido', async () => {
      manager.findOne.mockResolvedValueOnce(seller).mockResolvedValueOnce(null);

      await expect(
        service.createInStore({ ...inStoreDto, idUsuario: '12345678900' } as never),
      ).rejects.toThrow(new BadRequestException('CPF do cliente inválido.'));
    });

    it('não revalida o CPF de cliente já cadastrado (dado antigo continua vendável)', async () => {
      manager.findOne
        .mockResolvedValueOnce(seller)
        .mockResolvedValueOnce({ cpf: '12345678900' } as Person);
      variantsRepo.find.mockResolvedValue([]);

      // Passou da checagem de CPF e só parou na variante inexistente.
      await expect(
        service.createInStore({ ...inStoreDto, idUsuario: '12345678900' } as never),
      ).rejects.toThrow(NotFoundException);
    });
  });
  describe('sendPickupCode (#247)', () => {
    function pickupOrder(overrides: Partial<Order> = {}): Order {
      return {
        idPedido: 42,
        tipoRetirada: TipoRetirada.LOJA,
        status: OrderStatus.PAID,
        codigoVerificacaoRetirada: '123456',
        user: { nome: 'Maria Silva', email: 'maria@cliente.com' },
        clienteNomeAvulso: null,
        clienteEmailAvulso: null,
        ...overrides,
      } as Order;
    }

    it('envia o código para o e-mail da cliente cadastrada', async () => {
      ordersRepository.findOne.mockResolvedValue(pickupOrder());

      const result = await service.sendPickupCode(42);

      expect(result).toMatchObject({ idPedido: 42, destinatario: 'ma***@cliente.com' });
      const message = mailService.send.mock.calls[0][0];
      expect(message.to).toBe('maria@cliente.com');
      expect(message.subject).toContain('#42');
      expect(message.text).toContain('123456');
      expect(message.text).toContain('Olá, Maria!');
    });

    it('usa o e-mail informado no checkout do pedido de convidado', async () => {
      ordersRepository.findOne.mockResolvedValue(
        pickupOrder({
          user: null,
          clienteNomeAvulso: 'Ana',
          clienteEmailAvulso: 'ana@convidada.com',
        }),
      );

      await service.sendPickupCode(42);

      expect(mailService.send.mock.calls[0][0].to).toBe('ana@convidada.com');
    });

    it.each([
      ['pedido com entrega', { tipoRetirada: TipoRetirada.ENTREGA }],
      ['pedido pendente', { status: OrderStatus.PENDING }],
      ['pedido já retirado', { status: OrderStatus.DELIVERED }],
      ['venda do PDV sem código', { codigoVerificacaoRetirada: null }],
      ['pedido sem e-mail', { user: null, clienteEmailAvulso: null }],
    ])('recusa %s com 400 e não envia', async (_label, overrides) => {
      ordersRepository.findOne.mockResolvedValue(pickupOrder(overrides as Partial<Order>));

      await expect(service.sendPickupCode(42)).rejects.toThrow(BadRequestException);
      expect(mailService.send).not.toHaveBeenCalled();
    });

    it('lança NotFoundException quando o pedido não existe', async () => {
      ordersRepository.findOne.mockResolvedValue(null);
      await expect(service.sendPickupCode(42)).rejects.toThrow(NotFoundException);
    });

    it('repassa a falha do envio', async () => {
      ordersRepository.findOne.mockResolvedValue(pickupOrder());
      mailService.send.mockRejectedValue(new ServiceUnavailableException());
      await expect(service.sendPickupCode(42)).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('notifyPickupCode (#247)', () => {
    it('não consulta o pedido quando o e-mail está desabilitado', async () => {
      mailService.isEnabled.mockReturnValue(false);
      await service.notifyPickupCode(42);
      expect(ordersRepository.findOne).not.toHaveBeenCalled();
    });

    it('engole a falha do envio para não afetar o pagamento', async () => {
      ordersRepository.findOne.mockResolvedValue({
        idPedido: 42,
        tipoRetirada: TipoRetirada.LOJA,
        status: OrderStatus.PAID,
        codigoVerificacaoRetirada: '123456',
        user: { nome: 'Maria', email: 'maria@cliente.com' },
      });
      mailService.send.mockRejectedValue(new ServiceUnavailableException());

      await expect(service.notifyPickupCode(42)).resolves.toBeUndefined();
      expect(mailService.send).toHaveBeenCalledTimes(1);
    });
  });
});
