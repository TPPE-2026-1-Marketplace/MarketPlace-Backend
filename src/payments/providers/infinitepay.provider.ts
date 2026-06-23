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

/** Dados do comprador para pré-preencher o checkout hospedado da InfinitePay. */
interface InfinitePayCustomer {
  name?: string;
  email?: string;
  phone?: string;
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

    const payload: {
      handle: string;
      redirect_url: string;
      order_nsu: string;
      items: InfinitePayItem[];
      customer?: InfinitePayCustomer;
    } = {
      handle,
      redirect_url: redirectUrl,
      order_nsu: String(order?.idPedido ?? Date.now()),
      items: this.buildLineItems(amount, order),
    };

    // Pré-preenche nome/e-mail/telefone do comprador no checkout hospedado
    // (recurso "Dados pré-preenchidos" da InfinitePay) — menos digitação/abandono.
    const customer = this.buildCustomer(order);
    if (customer) {
      payload.customer = customer;
    }

    try {
      this.logger.log(
        `Enviando requisição de checkout para InfinitePay. NSU: ${payload.order_nsu}`,
      );
      const response = await axios.post(this.endpoint, payload, { timeout: 15000 });
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

  /**
   * Monta o comprador a partir do pedido: usa a relação `user` (cliente logado)
   * e cai para os campos avulsos (compra como convidado). Retorna `undefined`
   * quando não há nenhum dado útil para pré-preencher.
   */
  private buildCustomer(order?: Order): InfinitePayCustomer | undefined {
    if (!order) return undefined;

    const name = order.user?.nome ?? order.clienteNomeAvulso ?? undefined;
    const email = order.user?.email ?? order.clienteEmailAvulso ?? undefined;
    const phone = order.user?.telefone ?? order.clienteTelefone ?? undefined;

    const customer: InfinitePayCustomer = {};
    if (name) customer.name = name;
    if (email) customer.email = email;
    if (phone) customer.phone = phone;

    return Object.keys(customer).length > 0 ? customer : undefined;
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
