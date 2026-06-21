import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OrderItem } from './entities/order-item.entity';
import { Order } from './entities/order.entity';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { CouponsModule } from '../coupons/coupons.module';
import { StockLog } from '../inventory/entities/stock-log.entity';
import { Stock } from '../inventory/entities/stock.entity';
import { InventoryModule } from '../inventory/inventory.module';
import { PeopleModule } from '../people/people.module';
import { ProductVariant } from '../product-variants/entities/product-variant.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, ProductVariant, Stock, StockLog]),
    CouponsModule,
    PeopleModule,
    InventoryModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
