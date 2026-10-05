import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

import { AddressesModule } from './addresses/addresses.module';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { validateEnv } from './common/config/env.validation';
import { THROTTLE_DEFAULT } from './common/config/throttle.config';
import { CouponsModule } from './coupons/coupons.module';
import { buildDatabaseConnectionConfig } from './database/connection-config';
import { EmployeesModule } from './employees/employees.module';
import { HealthModule } from './health/health.module';
import { ImagesModule } from './images/images.module';
import { InventoryModule } from './inventory/inventory.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { PeopleModule } from './people/people.module';
import { ProductVariantsModule } from './product-variants/product-variants.module';
import { ProductsModule } from './products/products.module';
import { ReviewsModule } from './reviews/reviews.module';
import { SalesGoalsModule } from './sales-goals/sales-goals.module';
import { ShippingModule } from './shipping/shipping.module';

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    // Sem guard global: o ThrottlerGuard é aplicado só nas rotas de ação manual
    // (login, cadastro, checkout). Um guard global limitava também o catálogo,
    // que o frontend carrega com 2 requisições por variante.
    ThrottlerModule.forRoot({
      throttlers: [THROTTLE_DEFAULT],
      // Desliga o rate limiting durante os testes de integração (criam vários
      // pedidos/pagamentos em sequência). A flag é setada em jest-setup-envs.js.
      // O teste dedicado do 429 (auth.throttle.spec) monta o próprio
      // ThrottlerModule sem skipIf e não é afetado.
      skipIf: () => process.env.THROTTLE_DISABLED === 'true',
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        ...buildDatabaseConnectionConfig(),
        ssl: isProduction ? { rejectUnauthorized: false } : false,
        synchronize: !isProduction,
        autoLoadEntities: true,
        namingStrategy: new SnakeNamingStrategy(),
      }),
    }),
    PeopleModule,
    AddressesModule,
    EmployeesModule,
    CategoriesModule,
    ProductsModule,
    ProductVariantsModule,
    InventoryModule,
    CouponsModule,
    ReviewsModule,
    OrdersModule,
    PaymentsModule,
    AuthModule,
    ImagesModule,
    SalesGoalsModule,
    ShippingModule,
    HealthModule,
  ],
})
export class AppModule {}
