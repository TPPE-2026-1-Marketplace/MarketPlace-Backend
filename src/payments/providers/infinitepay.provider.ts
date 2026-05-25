import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

import { IPaymentGateway, TransactionResult } from './payment-gateway.interface';
import { CENTS_PER_CURRENCY_UNIT } from '../../common/constants';
import { Order } from '../../orders/entities/order.entity';
import { CaptureMethod, PaymentStatus } from '../entities/payment.entity';

interface InfinitePayItem {
  name: string;
  description: string;
  price: number;
  quantity: number;
}

/**
 * InfinitePayProvider
 *
 * Provedor de pagamento que integra com o Checkout do InfinitePay.
 * Gera o link de pagamento hospedado da InfinitePay de forma real.
 */
@Injectable()
export class InfinitePayProvider implements IPaymentGateway {
  private readonly logger = new Logger(InfinitePayProvider.name);
  private readonly endpoint = 'https://api.checkout.infinitepay.io/links';

  async charge(
    amount: number,
    method: CaptureMethod,
    installments: number,
    order?: Order,
  ): Promise<TransactionResult> {
    const handle = process.env.INFINITEPAY_HANDLE || 'pabloserrapxx';
    const redirectUrl = process.env.INFINITEPAY_REDIRECT_URL || 'https://seusite.com/obrigado';

    const payload = {
      handle,
      redirect_url: redirectUrl,
      order_nsu: String(order?.idPedido ?? Date.now()),
      items: this.buildLineItems(amount, order),
    };

    try {
      this.logger.log(
        `Enviando requisição de checkout para InfinitePay. NSU: ${payload.order_nsu}`,
      );
      const response = await axios.post(this.endpoint, payload);
      const data = response.data;

      return {
        status: PaymentStatus.PENDING, // Pendente até o usuário pagar no checkout hospedado
        orderNsu: payload.order_nsu,
        transactionNsu: data.id || `TX-${Date.now()}`,
        invoiceSlug: data.id || `INV-${Date.now()}`,
        redirectUrl: this.resolvePaymentLink(data),
        receiptUrl: null,
      };
    } catch (error) {
      const message = this.extractErrorMessage(error);
      this.logger.error(`Erro ao criar link de pagamento na InfinitePay: ${message}`);
      throw new Error(`Falha no Gateway de Pagamento InfinitePay: ${message}`);
    }
  }

  private toCents(value: number): number {
    return Math.round(value * CENTS_PER_CURRENCY_UNIT);
  }

  private buildLineItems(amount: number, order?: Order): InfinitePayItem[] {
    if (order?.items && order.items.length > 0) {
      return order.items.map((item) => ({
        name: `Item SKU ${item.idVariante}`,
        description: `Produto SKU ${item.idVariante}`,
        price: this.toCents(Number(item.precoUnitario)),
        quantity: item.quantidade,
      }));
    }

    return [
      {
        name: `Cobrança de Pedido #${order?.idPedido ?? 'Generico'}`,
        description: `Pedido #${order?.idPedido ?? 'Generico'}`,
        price: this.toCents(amount),
        quantity: 1,
      },
    ];
  }

  private resolvePaymentLink(data: { payment_link?: string; url?: string; id?: string }): string {
    return data.payment_link || data.url || `https://checkout.infinitepay.io/l/${data.id}`;
  }

  private extractErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
      return error.response?.data?.message ?? error.message;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return 'erro desconhecido';
  }
}
