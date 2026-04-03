import { Injectable, Logger } from '@nestjs/common';

export interface WhatsAppMessage {
  to: string; // phone number with country code, e.g. +5511999999999
  message: string;
}

export interface WhatsAppTemplateMessage {
  to: string;
  templateName: string;
  parameters: Record<string, string>;
}

export interface WhatsAppMessageResponse {
  messageId: string;
  status: 'sent' | 'queued' | 'failed';
  timestamp: string;
}

/**
 * WhatsApp Business API integration stub.
 * Replace with actual WhatsApp Cloud API calls when credentials are available.
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 */
@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  sendMessage(payload: WhatsAppMessage): Promise<WhatsAppMessageResponse> {
    this.logger.log(`[STUB] Sending WhatsApp message to ${payload.to}`);

    return Promise.resolve({
      messageId: `WA-${Date.now()}`,
      status: 'sent',
      timestamp: new Date().toISOString(),
    });
  }

  sendTemplate(
    payload: WhatsAppTemplateMessage,
  ): Promise<WhatsAppMessageResponse> {
    this.logger.log(
      `[STUB] Sending WhatsApp template '${payload.templateName}' to ${payload.to}`,
    );

    return Promise.resolve({
      messageId: `WA-TPL-${Date.now()}`,
      status: 'sent',
      timestamp: new Date().toISOString(),
    });
  }

  sendOrderConfirmation(
    phone: string,
    orderData: { orderId: string; total: number; itemCount: number },
  ): Promise<WhatsAppMessageResponse> {
    const message =
      `✅ *Pedido Confirmado!*\n\n` +
      `Olá! Seu pedido #${orderData.orderId} foi confirmado.\n` +
      `Itens: ${orderData.itemCount}\n` +
      `Total: R$ ${orderData.total.toFixed(2)}\n\n` +
      `Obrigado pela sua compra! 🛍️`;

    return this.sendMessage({ to: phone, message });
  }

  sendShippingNotification(
    phone: string,
    trackingData: { orderId: string; trackingCode: string },
  ): Promise<WhatsAppMessageResponse> {
    const message =
      `📦 *Pedido Enviado!*\n\n` +
      `Seu pedido #${trackingData.orderId} foi despachado.\n` +
      `Código de rastreamento: ${trackingData.trackingCode}\n\n` +
      `Acompanhe em: https://rastreamento.correios.com.br`;

    return this.sendMessage({ to: phone, message });
  }
}
