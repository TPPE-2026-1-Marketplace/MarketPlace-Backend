import { Injectable, Logger } from '@nestjs/common';
import { CalculateShippingDto } from './dtos/calculate-shipping.dto';
import { IShippingQuote } from './interfaces/shipping.interface';

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);

  /**
   * Calcula o frete para o CEP de destino informado.
   *
   * TODO(shipping): Etapa 2 (Issue #75) — integrar API dos Correios.
   * TODO(shipping): Etapa 4 (Issue #77) — implementar fallback local por faixas de CEP.
   *
   * Atualmente retorna um mock estático para validação da estrutura do módulo,
   * DTOs e documentação Swagger.
   */
  async calculate(dto: CalculateShippingDto): Promise<IShippingQuote> {
    this.logger.log(
      `Calculando frete para CEP ${dto.cep_destino} (mock estático)`,
    );

    return {
      valor: 15.0,
      prazo_dias: 3,
    };
  }
}
