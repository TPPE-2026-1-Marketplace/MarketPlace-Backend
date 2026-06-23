import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';

import { CaptureMethod, Payment, PaymentStatus } from './entities/payment.entity';
import { PaymentsService } from './payments.service';
import { PAYMENT_GATEWAY_TOKEN } from './providers/payment-gateway.interface';
import { Role } from '../common/enums/role.enum';
import { StockLog } from '../inventory/entities/stock-log.entity';
import { Stock } from '../inventory/entities/stock.entity';
import { Order, OrderStatus, TipoRetirada } from '../orders/entities/order.entity';

import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import type { TestingModule } from '@nestjs/testing';

const cliente: CurrentUserPayload = { sub: '12345678901', email: 'c@e.com', role: Role.CLIENTE };
const gerente: CurrentUserPayload = { sub: '99999999999', email: 'g@e.com', role: Role.GERENTE };

function buildOrder(overrides: Partial<Order> = {}): Order {
  return {
    idPedido: 1,
    idUsuario: cliente.sub,
    status: OrderStatus.PENDING,
    valorTotal: 100,
    tipoRetirada: TipoRetirada.ENTREGA,
    items: [{ idVariante: 'SKU-1', quantidade: 2, precoUnitario: 50 }],
    ...overrides,
  } as Order;
}

describe('PaymentsService', () => {
  let service: PaymentsService;
  let gateway: { charge: jest.Mock };
  let txPaymentsRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let txOrdersRepo: { findOne: jest.Mock; save: jest.Mock };
  let txStockRepo: { findOne: jest.Mock; save: jest.Mock };
  let txStockLogRepo: { create: jest.Mock; save: jest.Mock };
  let dsOrdersRepo: { findOne: jest.Mock };
  let dsPaymentsRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();

    txPaymentsRepo = {
      findOne: jest.fn(),
      create: jest.fn((p) => p),
      save: jest.fn((p) => Promise.resolve({ idPagamento: 10, ...p })),
    };
    txOrdersRepo = { findOne: jest.fn(), save: jest.fn((o) => Promise.resolve(o)) };
    txStockRepo = { findOne: jest.fn(), save: jest.fn((s) => Promise.resolve(s)) };
    txStockLogRepo = { create: jest.fn((l) => l), save: jest.fn() };
    dsOrdersRepo = { findOne: jest.fn() };
    dsPaymentsRepo = { findOne: jest.fn() };

    const txManager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === Payment) return txPaymentsRepo;
        if (entity === Order) return txOrdersRepo;
        if (entity === Stock) return txStockRepo;
        if (entity === StockLog) return txStockLogRepo;
      }),
    };

    const mockDataSource = {
      transaction: jest.fn((cb: (m: typeof txManager) => Promise<unknown>) => cb(txManager)),
      getRepository: jest.fn((entity: unknown) => {
        if (entity === Order) return dsOrdersRepo;
        if (entity === Payment) return dsPaymentsRepo;
      }),
    };

    gateway = { charge: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Payment), useValue: {} },
        { provide: getDataSourceToken(), useValue: mockDataSource },
        { provide: PAYMENT_GATEWAY_TOKEN, useValue: gateway },
      ],
    }).compile();

    service = module.get(PaymentsService);
  });

  describe('create', () => {
    const dto = { idPedido: 1, captureMethod: CaptureMethod.PIX, installments: 1 };

    it('aprova imediatamente, marca o pedido como PAID e dá baixa no estoque quando o gateway retorna PAID', async () => {
      txOrdersRepo.findOne.mockResolvedValue(buildOrder());
      txStockRepo.findOne.mockResolvedValue({
        codigoSku: 'SKU-1',
        qtdOnline: 10,
        qtdLojaFisica: 10,
      });
      gateway.charge.mockResolvedValue({
        status: PaymentStatus.PAID,
        orderNsu: 'NSU-1',
        transactionNsu: 'TX-1',
        invoiceSlug: 'INV-1',
      });

      const result = await service.create(cliente, dto as never);

      expect(result.status).toBe(PaymentStatus.PAID);
      expect(result.paidAmount).toBe(100);
      expect(txOrdersRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: OrderStatus.PAID }),
      );
      // Baixa de estoque ocorre na confirmação do pagamento (10 - 2 = 8).
      expect(txStockRepo.save).toHaveBeenCalledWith(expect.objectContaining({ qtdOnline: 8 }));
    });

    it('mantém pedido pendente quando o gateway retorna PENDING (checkout hospedado)', async () => {
      txOrdersRepo.findOne.mockResolvedValue(buildOrder());
      gateway.charge.mockResolvedValue({
        status: PaymentStatus.PENDING,
        orderNsu: 'NSU-1',
        transactionNsu: 'TX-1',
        invoiceSlug: 'INV-1',
        redirectUrl: 'https://checkout',
      });

      const result = await service.create(cliente, dto as never);

      expect(result.status).toBe(PaymentStatus.PENDING);
      expect(result.paidAmount).toBeNull();
      expect(txOrdersRepo.save).not.toHaveBeenCalled();
    });

    it('lança NotFoundException quando o pedido não existe', async () => {
      txOrdersRepo.findOne.mockResolvedValue(null);
      await expect(service.create(cliente, dto as never)).rejects.toThrow(NotFoundException);
      expect(gateway.charge).not.toHaveBeenCalled();
    });

    it('lança ForbiddenException quando o cliente não é dono do pedido', async () => {
      txOrdersRepo.findOne.mockResolvedValue(buildOrder({ idUsuario: 'outro-cpf' }));
      await expect(service.create(cliente, dto as never)).rejects.toThrow(ForbiddenException);
    });

    it('lança ConflictException quando o pedido já está pago', async () => {
      txOrdersRepo.findOne.mockResolvedValue(buildOrder({ status: OrderStatus.PAID }));
      await expect(service.create(cliente, dto as never)).rejects.toThrow(ConflictException);
    });

    it('lança BadRequestException quando o pedido não está pendente', async () => {
      txOrdersRepo.findOne.mockResolvedValue(buildOrder({ status: OrderStatus.SHIPPED }));
      await expect(service.create(cliente, dto as never)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findByOrder', () => {
    it('lança NotFoundException quando o pedido não existe', async () => {
      dsOrdersRepo.findOne.mockResolvedValue(null);
      await expect(service.findByOrder(cliente, 1)).rejects.toThrow(NotFoundException);
    });

    it('lança ForbiddenException quando o cliente não é dono', async () => {
      dsOrdersRepo.findOne.mockResolvedValue(buildOrder({ idUsuario: 'outro' }));
      await expect(service.findByOrder(cliente, 1)).rejects.toThrow(ForbiddenException);
    });

    it('lança NotFoundException quando não há pagamento registrado', async () => {
      dsOrdersRepo.findOne.mockResolvedValue(buildOrder());
      dsPaymentsRepo.findOne.mockResolvedValue(null);
      await expect(service.findByOrder(cliente, 1)).rejects.toThrow(NotFoundException);
    });

    it('permite funcionário consultar pagamento de qualquer pedido', async () => {
      dsOrdersRepo.findOne.mockResolvedValue(buildOrder());
      const payment = { idPagamento: 10, status: PaymentStatus.PAID } as Payment;
      dsPaymentsRepo.findOne.mockResolvedValue(payment);
      const result = await service.findByOrder(gerente, 1);
      expect(result).toBe(payment);
    });
  });

  describe('handleWebhook', () => {
    it('lança NotFoundException quando o pagamento não é encontrado', async () => {
      txPaymentsRepo.findOne.mockResolvedValue(null);
      await expect(service.handleWebhook({ order_nsu: 'NSU-X' } as never)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('é idempotente: ignora notificação se o pagamento já está PAID', async () => {
      txPaymentsRepo.findOne.mockResolvedValue({
        status: PaymentStatus.PAID,
        order: buildOrder({ status: OrderStatus.PAID }),
      });
      await service.handleWebhook({ order_nsu: 'NSU-1', status: 'paid' } as never);
      expect(txPaymentsRepo.save).not.toHaveBeenCalled();
    });

    it('confirma pagamento, converte paid_amount de centavos e dá baixa no estoque', async () => {
      txPaymentsRepo.findOne.mockResolvedValue({
        status: PaymentStatus.PENDING,
        amount: 100,
        order: buildOrder(),
      });
      txStockRepo.findOne.mockResolvedValue({
        codigoSku: 'SKU-1',
        qtdOnline: 10,
        qtdLojaFisica: 10,
      });
      await service.handleWebhook({
        order_nsu: 'NSU-1',
        status: 'paid',
        paid_amount: 9990,
      } as never);

      expect(txPaymentsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: PaymentStatus.PAID, paidAmount: 99.9 }),
      );
      expect(txOrdersRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: OrderStatus.PAID }),
      );
      // Aprovação dá baixa no estoque (10 - 2 = 8).
      expect(txStockRepo.save).toHaveBeenCalledWith(expect.objectContaining({ qtdOnline: 8 }));
    });

    it('falha: cancela o pedido SEM estornar estoque ao receber status failed', async () => {
      txPaymentsRepo.findOne.mockResolvedValue({
        status: PaymentStatus.PENDING,
        amount: 100,
        order: buildOrder(),
      });

      await service.handleWebhook({ order_nsu: 'NSU-1', status: 'failed' } as never);

      expect(txPaymentsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: PaymentStatus.FAILED }),
      );
      expect(txOrdersRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: OrderStatus.CANCELLED }),
      );
      // O estoque só é debitado na confirmação do pagamento; numa falha não há o que estornar.
      expect(txStockRepo.save).not.toHaveBeenCalled();
      expect(txStockLogRepo.save).not.toHaveBeenCalled();
    });
  });
});
