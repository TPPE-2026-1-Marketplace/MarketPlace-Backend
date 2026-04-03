import { Injectable, Logger } from '@nestjs/common';

export interface ShippingQuoteRequest {
  originZip: string;
  destinationZip: string;
  weightKg: number;
  heightCm: number;
  widthCm: number;
  lengthCm: number;
}

export interface ShippingQuoteResponse {
  carrier: string;
  service: string;
  price: number;
  estimatedDays: number;
  trackingAvailable: boolean;
}

/**
 * Correios integration stub.
 * Replace with actual Correios Web API calls when credentials are available.
 * Docs: https://www.correios.com.br/atendimento/developers
 */
@Injectable()
export class CorreiosService {
  private readonly logger = new Logger(CorreiosService.name);

  getShippingQuote(
    request: ShippingQuoteRequest,
  ): Promise<ShippingQuoteResponse[]> {
    this.logger.log(
      `[STUB] Fetching shipping quote from ${request.originZip} to ${request.destinationZip}`,
    );

    // Stub response — replace with real API call
    return Promise.resolve([
      {
        carrier: 'Correios',
        service: 'PAC',
        price: 18.9,
        estimatedDays: 7,
        trackingAvailable: true,
      },
      {
        carrier: 'Correios',
        service: 'SEDEX',
        price: 35.5,
        estimatedDays: 2,
        trackingAvailable: true,
      },
    ]);
  }

  trackPackage(
    trackingCode: string,
  ): Promise<{ status: string; events: unknown[] }> {
    this.logger.log(`[STUB] Tracking package: ${trackingCode}`);

    return Promise.resolve({
      status: 'IN_TRANSIT',
      events: [
        {
          date: new Date().toISOString(),
          location: 'Centro de Distribuição SP',
          description: 'Objeto em trânsito',
        },
      ],
    });
  }
}
