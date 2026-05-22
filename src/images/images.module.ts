import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CatalogImage } from './entities/catalog-image.entity';
import { Image } from './entities/image.entity';
import { ImagesController } from './images.controller';
import { ImagesService } from './images.service';
import { ProductVariant } from '../product-variants/entities/product-variant.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Image, CatalogImage, ProductVariant])],
  controllers: [ImagesController],
  providers: [ImagesService],
})
export class ImagesModule {}
