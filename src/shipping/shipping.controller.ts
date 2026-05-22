import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CalculateShippingDto } from './dtos/calculate-shipping.dto';
import { ShippingService } from './shipping.service';

@ApiTags('shipping')
@Controller('shipping')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  /**
   * Endpoint público para cálculo de frete.
   *
   * TODO(shipping): Etapa 3 (Issue #76) — adicionar validações extras e
   * documentação detalhada de request/response no Swagger.
   */
  @Post('calculate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Calcula o frete para um CEP de destino',
    description:
      'Recebe o CEP de destino (8 dígitos) e, opcionalmente, peso e dimensões ' +
      'do pacote. Retorna o valor do frete e o prazo estimado em dias úteis.',
  })
  @ApiResponse({
    status: 200,
    description: 'Cálculo de frete realizado com sucesso',
  })
  @ApiResponse({
    status: 400,
    description: 'Payload inválido (CEP fora do formato ou campos inválidos)',
  })
  calculate(@Body() dto: CalculateShippingDto) {
    return this.shippingService.calculate(dto);
  }
}
