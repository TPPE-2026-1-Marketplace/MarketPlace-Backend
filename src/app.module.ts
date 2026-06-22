import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

import { AddressesModule } from './addresses/addresses.module';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { validateEnv } from './common/config/env.validation';
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
