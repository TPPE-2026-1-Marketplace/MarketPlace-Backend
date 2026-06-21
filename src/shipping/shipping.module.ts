import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { MELHOR_ENVIO_TIMEOUT_MS } from '../common/constants';
import { MelhorEnvioTokenManager } from './auth/melhor-envio-token-manager';
import { ShippingController } from './shipping.controller';
import { ShippingService } from './shipping.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: MELHOR_ENVIO_TIMEOUT_MS,
    }),
  ],
  controllers: [ShippingController],
  providers: [MelhorEnvioTokenManager, ShippingService],
  exports: [ShippingService],
})
export class ShippingModule {}
