import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from '../categories/entities/category.entity';
import { Product } from '../products/entities/product.entity';
import { ProductVariantsController } from './product-variants.controller';
import { ProductVariantsService } from './product-variants.service';
import { ProductVariant } from './entities/product-variant.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ProductVariant, Product, Category])],
  controllers: [ProductVariantsController],
  providers: [ProductVariantsService],
})
export class ProductVariantsModule {}
