import { Injectable } from '@nestjs/common';

import { IPaymentGateway, TransactionResult } from './payment-gateway.interface';
import { Order } from '../../orders/entities/order.entity';
import { CaptureMethod, PaymentStatus } from '../entities/payment.entity';

/**
 * MockPaymentProvider
 *
 * Provedor de pagamento simulado.
 * Sempre retorna sucesso ("paid") para qualquer transação realizada.
 */
@Injectable()
export class MockPaymentProvider implements IPaymentGateway {
  async charge(
    _amount: number,
    _method: CaptureMethod,
    _installments: number,
    _order?: Order,
  ): Promise<TransactionResult> {
    const timestamp = Date.now();
    return {
      status: PaymentStatus.PAID,
      orderNsu: `MOCK-NSU-${timestamp}`,
      transactionNsu: `MOCK-TX-${timestamp}`,
      invoiceSlug: `MOCK-INV-${timestamp}`,
      receiptUrl: `https://receipt.mock.gateway.com/${timestamp}`,
      redirectUrl: `https://checkout.mock.gateway.com/${timestamp}`,
    };
  }
}
