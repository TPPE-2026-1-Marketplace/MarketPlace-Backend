import { Controller, Post, Body, Logger } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ShippingService } from './shipping.service';
import { CalculateShippingDto } from './calculate-shipping.dto';

@ApiTags('shipping')
@Controller('shipping')
export class ShippingController {
  private static readonly logger = new Logger(ShippingController.name);

  constructor(private readonly shippingService: ShippingService) {}

  @Post('calculate')
  async calculate(@Body() dto: CalculateShippingDto) {
    ShippingController.logger.log(`POST api/shipping/calculate — CEP: ${dto.cep_destino}`);
    return this.shippingService.calculate(dto);
  }
}
