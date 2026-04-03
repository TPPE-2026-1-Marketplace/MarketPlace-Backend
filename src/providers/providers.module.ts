import { Module } from '@nestjs/common';
import { CorreiosService } from './correios/correios.service';
import { InfinitePayService } from './infinitepay/infinitepay.service';
import { WhatsAppService } from './whatsapp/whatsapp.service';

@Module({
  providers: [CorreiosService, InfinitePayService, WhatsAppService],
  exports: [CorreiosService, InfinitePayService, WhatsAppService],
})
export class ProvidersModule {}
