import type { Order } from '../../orders/entities/order.entity';
import type { PaymentStatus, CaptureMethod } from '../entities/payment.entity';

export const PAYMENT_GATEWAY_TOKEN = 'PAYMENT_GATEWAY_TOKEN';

export interface TransactionResult {
  status: PaymentStatus;
  orderNsu: string;
  transactionNsu: string;
  invoiceSlug: string;
  receiptUrl?: string | null;
  redirectUrl?: string | null;
}

/**
 * Interface IPaymentGateway
 *
 * Contrato para integração com gateways de pagamento externos (e.g. Stripe, MercadoPago, InfinitePay).
 * Define a assinatura padrão para processar cobranças na aplicação.
 */
export interface IPaymentGateway {
  /**
   * Processa uma tentativa de cobrança para um determinado valor, método de captura e quantidade de parcelas.
   *
   * @param amount Valor total da transação.
   * @param method Método de captura (pix, credit_card, debit_card).
   * @param installments Quantidade de parcelas.
   * @param order Entidade do pedido correspondente (opcional para enriquecer os metadados do gateway).
   * @returns Resultado da transação contendo status e dados do gateway.
   */
  charge(
    amount: number,
    method: CaptureMethod,
    installments: number,
    order?: Order,
  ): Promise<TransactionResult>;
}
