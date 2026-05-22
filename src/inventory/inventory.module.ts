import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { StockLog } from './entities/stock-log.entity';
import { Stock } from './entities/stock.entity';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { ProductVariant } from '../product-variants/entities/product-variant.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Stock, StockLog, ProductVariant])],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
