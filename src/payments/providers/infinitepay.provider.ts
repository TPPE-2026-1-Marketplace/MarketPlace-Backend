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

interface InfinitePayCustomer {
  name?: string;
  email?: string;
  phone_number?: string;
}

interface InfinitePayAddress {
  cep?: string;
  street?: string;
  neighborhood?: string;
  number?: string;
  complement?: string;
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
    const redirectUrl = this.buildRedirectUrl(order);

    const payload: {
      handle: string;
      redirect_url: string;
      order_nsu: string;
      items: InfinitePayItem[];
      customer?: InfinitePayCustomer;
      address?: InfinitePayAddress;
    } = {
      handle,
      redirect_url: redirectUrl,
      order_nsu: String(order?.idPedido ?? Date.now()),
      items: this.buildLineItems(amount, order),
    };

    const customer = this.buildCustomer(order);
    if (customer) {
      payload.customer = customer;
    }

    const address = this.buildAddress(order);
    if (address) {
      payload.address = address;
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
      const items = order.items.map((item) => ({
        name: `Item SKU ${item.idVariante}`,
        description: `Produto SKU ${item.idVariante}`,
        price: this.toCents(Number(item.precoUnitario)),
        quantity: item.quantidade,
      }));

      const shipping = this.buildShippingItem(order);
      return shipping ? [...items, shipping] : items;
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

  private buildShippingItem(order: Order): InfinitePayItem | null {
    const shippingAmount = Number(order.valorFrete);
    if (!Number.isFinite(shippingAmount) || shippingAmount <= 0) {
      return null;
    }

    return {
      name: 'Frete',
      description: `Frete do pedido #${order.idPedido}`,
      price: this.toCents(shippingAmount),
      quantity: 1,
    };
  }

  private buildRedirectUrl(order?: Order): string {
    const fallback = 'http://localhost:5173/pedido/{orderId}';
    const configured = process.env.INFINITEPAY_REDIRECT_URL || fallback;
    const orderId = String(order?.idPedido ?? '');

    if (configured.includes('{orderId}')) {
      return configured.replaceAll('{orderId}', orderId);
    }

    return configured;
  }

  private buildCustomer(order?: Order): InfinitePayCustomer | undefined {
    if (!order) return undefined;

    return this.compactObject({
      name: this.firstText(order.clienteNomeAvulso, this.userName(order)),
      email: this.firstText(order.clienteEmailAvulso, this.userEmail(order)),
      phone_number: this.customerPhone(order),
    });
  }

  private buildAddress(order?: Order): InfinitePayAddress | undefined {
    if (!order) return undefined;

    return this.compactObject({
      cep: this.cleanDigits(order.enderecoCep),
      street: this.textOrUndefined(order.enderecoRua),
      neighborhood: this.textOrUndefined(order.enderecoBairro),
      number: this.textOrUndefined(order.enderecoNumero),
      complement: this.textOrUndefined(order.enderecoComplemento),
    });
  }

  private customerPhone(order: Order): string | undefined {
    const phone = this.firstText(order.clienteTelefone, order.user?.telefone);
    return phone ? this.formatPhone(phone) : undefined;
  }

  private userName(order: Order): string | null | undefined {
    return order.user?.nome;
  }

  private userEmail(order: Order): string | null | undefined {
    return order.user?.email;
  }

  private firstText(...values: Array<string | null | undefined>): string | undefined {
    return values.map((value) => this.textOrUndefined(value)).find(Boolean);
  }

  private textOrUndefined(value: string | null | undefined): string | undefined {
    return value || undefined;
  }

  private cleanDigits(value: string | null | undefined): string | undefined {
    return value ? value.replace(/\D/g, '') : undefined;
  }

  private compactObject<T extends Record<string, string | undefined>>(value: T): T | undefined {
    const entries = Object.entries(value).filter(([, item]) => item);
    return entries.length > 0 ? (Object.fromEntries(entries) as T) : undefined;
  }

  private formatPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (!digits) {
      return phone;
    }
    return digits.startsWith('55') ? `+${digits}` : `+55${digits}`;
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
