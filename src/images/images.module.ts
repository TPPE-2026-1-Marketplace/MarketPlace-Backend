import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductVariant } from '../product-variants/entities/product-variant.entity';
import { ImagesController } from './images.controller';
import { ImagesService } from './images.service';
import { CatalogImage } from './entities/catalog-image.entity';
import { Image } from './entities/image.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Image, CatalogImage, ProductVariant])],
  controllers: [ImagesController],
  providers: [ImagesService],
})
export class ImagesModule {}
