import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CalculateShippingDto } from './calculate-shipping.dto';

export interface ShippingOption {
  id: number;
  name: string;
  price: number;
  company: { id: number; name: string };
  delivery_time: number;
  delivery_range?: { min: number; max: number };
}

@Injectable()
export class ShippingService {
  private static readonly logger = new Logger(ShippingService.name);

  // Dimensões padrão de um vestido embalado (cm)
  private static readonly DEFAULT_HEIGHT = 5;
  private static readonly DEFAULT_WIDTH = 30;
  private static readonly DEFAULT_LENGTH = 40;
  private static readonly DEFAULT_WEIGHT = 0.5;

  constructor(private readonly configService: ConfigService) {}

  async calculate(dto: CalculateShippingDto): Promise<ShippingOption[]> {
    const baseUrl = this.configService.get<string>('MELHOR_ENVIO_BASE_URL');
    const token = this.configService.get<string>('MELHOR_ENVIO_ACCESS_TOKEN');
    const userAgent = this.configService.get<string>('MELHOR_ENVIO_USER_AGENT');
    const cepOrigem = this.configService.get<string>('LOJA_CEP_ORIGEM') || '70002900';

    // Se não houver token configurado, retorna fallback simulado
    if (!token || !baseUrl) {
      ShippingService.logger.warn('Melhor Envio não configurado — usando frete simulado');
      return this.fallbackSimulation(dto);
    }

    const body = {
      from: { postal_code: cepOrigem.replace(/\D/g, '') },
      to: { postal_code: dto.cep_destino.replace(/\D/g, '') },
      package: {
        height: dto.altura ?? ShippingService.DEFAULT_HEIGHT,
        width: dto.largura ?? ShippingService.DEFAULT_WIDTH,
        length: dto.comprimento ?? ShippingService.DEFAULT_LENGTH,
        weight: dto.peso ?? ShippingService.DEFAULT_WEIGHT,
      },
      options: {
        receipt: false,
        own_hand: false,
      },
      services: '1,2', // 1=PAC, 2=Sedex
    };

    try {
      const response = await fetch(`${baseUrl}/api/v2/me/shipment/calculate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          'User-Agent': userAgent || 'DK Fashion',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        ShippingService.logger.error(`Melhor Envio API error ${response.status}: ${errorText}`);
        return this.fallbackSimulation(dto);
      }

      const data = await response.json();
      ShippingService.logger.log(`Frete calculado: ${JSON.stringify(data)}`);

      if (!Array.isArray(data)) {
        return this.fallbackSimulation(dto);
      }

      // Normalizar resposta da Melhor Envio
      const options: ShippingOption[] = data
        .filter((item: any) => !item.error) // remove serviços que não atendem
        .map((item: any) => ({
          id: item.id,
          name: item.name || item.company?.name || 'Frete',
          price: parseFloat(item.custom_price ?? item.price ?? 0),
          company: item.company || { id: 0, name: 'Transportadora' },
          delivery_time: item.delivery_time ?? item.delivery_range?.max ?? 0,
          delivery_range: item.delivery_range || undefined,
        }));

      if (options.length === 0) {
        return this.fallbackSimulation(dto);
      }

      return options;
    } catch (err) {
      ShippingService.logger.error(`Erro ao consultar Melhor Envio: ${(err as Error).message}`);
      return this.fallbackSimulation(dto);
    }
  }

  /** Fallback simulado para quando a API não estiver disponível */
  private fallbackSimulation(dto: CalculateShippingDto): ShippingOption[] {
    const cep = dto.cep_destino.replace(/\D/g, '');
    const isDF = cep.startsWith('70') || cep.startsWith('71') || cep.startsWith('72') || cep.startsWith('73');

    if (!isDF) {
      return [];
    }

    return [
      {
        id: 1,
        name: 'PAC (Correios)',
        price: 19.90,
        company: { id: 1, name: 'Correios' },
        delivery_time: 7,
        delivery_range: { min: 5, max: 10 },
      },
      {
        id: 2,
        name: 'Sedex (Correios)',
        price: 39.90,
        company: { id: 1, name: 'Correios' },
        delivery_time: 2,
        delivery_range: { min: 1, max: 3 },
      },
    ];
  }
}
