import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { IPaymentGateway, TransactionResult } from './payment-gateway.interface';
import { CaptureMethod, PaymentStatus } from '../entities/payment.entity';
import { Order } from '../../orders/entities/order.entity';

/**
 * InfinitePayProvider
 *
 * Provedor de pagamento que integra com o Checkout do InfinitePay.
 * Gera o link de pagamento hospedado da InfinitePay de forma real.
 */
@Injectable()
export class InfinitePayProvider implements IPaymentGateway {
  private readonly logger = new Logger(InfinitePayProvider.name);

  async charge(
    amount: number,
    method: CaptureMethod,
    installments: number,
    order?: Order,
  ): Promise<TransactionResult> {
    const handle = process.env.INFINITEPAY_HANDLE || 'pabloserrapxx';
    const redirectUrl = process.env.INFINITEPAY_REDIRECT_URL || 'https://seusite.com/obrigado';
    const endpoint = 'https://api.checkout.infinitepay.io/links';

    // Map order items to InfinitePay format in cents
    const items = order?.items?.map((item) => ({
      name: `Item SKU ${item.idVariante}`,
      price: Math.round(Number(item.precoUnitario) * 100), // convert to cents
      quantity: item.quantidade,
    })) || [
      {
        name: `Cobrança de Pedido #${order?.idPedido ?? 'Generico'}`,
        price: Math.round(amount * 100),
        quantity: 1,
      },
    ];

    const payload = {
      handle,
      redirect_url: redirectUrl,
      order_nsu: String(order?.idPedido ?? Date.now()),
      items,
    };

    try {
      this.logger.log(
        `Enviando requisição de checkout para InfinitePay. NSU: ${payload.order_nsu}`,
      );
      const response = await axios.post(endpoint, payload);
      const data = response.data;

      // InfinitePay response returns payment_link or similar keys
      const paymentLink =
        data.payment_link || data.url || `https://checkout.infinitepay.io/l/${data.id}`;

      return {
        status: PaymentStatus.PENDING, // Starts as pending until user pays in the hosted checkout
        orderNsu: payload.order_nsu,
        transactionNsu: data.id || `TX-${Date.now()}`,
        invoiceSlug: data.id || `INV-${Date.now()}`,
        redirectUrl: paymentLink,
        receiptUrl: null,
      };
    } catch (error: any) {
      this.logger.error(
        `Erro ao criar link de pagamento na InfinitePay: ${error.message}`,
        error.stack,
      );
      throw new Error(
        `Falha no Gateway de Pagamento InfinitePay: ${error.response?.data?.message || error.message}`,
      );
    }
  }
}
