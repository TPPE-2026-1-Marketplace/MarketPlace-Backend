import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CatalogImage } from './entities/catalog-image.entity';
import { Image } from './entities/image.entity';
import { ImagesController } from './images.controller';
import { ImagesService } from './images.service';
import { ImgbbService } from './imgbb.service';
import { ProductVariant } from '../product-variants/entities/product-variant.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Image, CatalogImage, ProductVariant]),
  ],
  controllers: [ImagesController],
  providers: [ImagesService, ImgbbService],
})
export class ImagesModule {}
