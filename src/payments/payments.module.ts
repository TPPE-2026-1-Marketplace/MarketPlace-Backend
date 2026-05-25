import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Payment } from './entities/payment.entity';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { InfinitePayProvider } from './providers/infinitepay.provider';
import { MockPaymentProvider } from './providers/mock.provider';
import { PAYMENT_GATEWAY_TOKEN } from './providers/payment-gateway.interface';

@Module({
  imports: [TypeOrmModule.forFeature([Payment])],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    {
      provide: PAYMENT_GATEWAY_TOKEN,
      useClass:
        process.env.PAYMENT_GATEWAY_PROVIDER === 'infinitepay'
          ? InfinitePayProvider
          : MockPaymentProvider,
    },
  ],
  exports: [PaymentsService, PAYMENT_GATEWAY_TOKEN],
})
export class PaymentsModule {}
