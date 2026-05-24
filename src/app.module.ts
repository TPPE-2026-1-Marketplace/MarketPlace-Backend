import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
import { ShippingModule } from './shipping/shipping.module';

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('POSTGRES_HOST'),
        port: Number(configService.get<string>('POSTGRES_PORT') ?? DEFAULT_POSTGRES_PORT),
        username: configService.get<string>('POSTGRES_USER'),
        password: configService.get<string>('POSTGRES_PASSWORD'),
        database: configService.get<string>('POSTGRES_DB'),
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
  ],
})
export class AppModule {}
