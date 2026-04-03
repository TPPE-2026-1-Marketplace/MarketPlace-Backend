import { Injectable, Logger } from '@nestjs/common';

export interface PaymentRequest {
  amount: number;
  description: string;
  customerName: string;
  customerDocument: string;
  paymentMethod: 'credit_card' | 'debit_card' | 'pix' | 'boleto';
  installments?: number;
}

export interface PaymentResponse {
  transactionId: string;
  status: 'approved' | 'pending' | 'declined';
  amount: number;
  paymentMethod: string;
  paidAt?: string;
  pixQrCode?: string;
  boletoUrl?: string;
}

export interface RefundRequest {
  transactionId: string;
  amount: number;
  reason: string;
}

/**
 * InfinitePay payment gateway integration stub.
 * Replace with actual InfinitePay API calls when credentials are available.
 * Docs: https://developers.infinitepay.io
 */
@Injectable()
export class InfinitePayService {
  private readonly logger = new Logger(InfinitePayService.name);

  createPayment(request: PaymentRequest): Promise<PaymentResponse> {
    this.logger.log(
      `[STUB] Creating payment of R$${request.amount} via ${request.paymentMethod}`,
    );

    const response: PaymentResponse = {
      transactionId: `INF-${Date.now()}`,
      status: 'approved',
      amount: request.amount,
      paymentMethod: request.paymentMethod,
      paidAt: new Date().toISOString(),
    };

    if (request.paymentMethod === 'pix') {
      response.pixQrCode = '00020126580014br.gov.bcb.pix...stub_qr_code';
      response.status = 'pending';
    }

    if (request.paymentMethod === 'boleto') {
      response.boletoUrl = 'https://boleto.infinitepay.io/stub/123456';
      response.status = 'pending';
    }

    return Promise.resolve(response);
  }

  getPaymentStatus(transactionId: string): Promise<PaymentResponse> {
    this.logger.log(`[STUB] Getting payment status for: ${transactionId}`);

    return Promise.resolve({
      transactionId,
      status: 'approved',
      amount: 0,
      paymentMethod: 'credit_card',
      paidAt: new Date().toISOString(),
    });
  }

  refund(
    request: RefundRequest,
  ): Promise<{ success: boolean; refundId: string }> {
    this.logger.log(
      `[STUB] Refunding transaction ${request.transactionId} - R$${request.amount}`,
    );

    return Promise.resolve({
      success: true,
      refundId: `REF-${Date.now()}`,
    });
  }
}
