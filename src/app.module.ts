import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

import { AddressesModule } from './addresses/addresses.module';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { DEFAULT_POSTGRES_PORT } from './common/constants';
import { CouponsModule } from './coupons/coupons.module';
import { EmployeesModule } from './employees/employees.module';
import { ImagesModule } from './images/images.module';
import { InventoryModule } from './inventory/inventory.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { PeopleModule } from './people/people.module';
import { ProductVariantsModule } from './product-variants/product-variants.module';
import { ProductsModule } from './products/products.module';
import { ReviewsModule } from './reviews/reviews.module';
import { SalesGoalsModule } from './sales-goals/sales-goals.module';

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      synchronize: !isProduction,
      type: 'postgres',
      host: process.env.POSTGRES_HOST,
      port: Number(process.env.POSTGRES_PORT ?? DEFAULT_POSTGRES_PORT),
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
      autoLoadEntities: true,
      namingStrategy: new SnakeNamingStrategy(),
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
  ],
})
export class AppModule {}
