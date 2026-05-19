import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductVariant } from '../product-variants/entities/product-variant.entity';
import { CreateCatalogImageDto } from './dtos/create-catalog-image.dto';
import { CreateImageDto } from './dtos/create-image.dto';
import { CatalogImage } from './entities/catalog-image.entity';
import { Image } from './entities/image.entity';

@Injectable()
export class ImagesService {
  constructor(
    @InjectRepository(Image)
    private readonly imagesRepository: Repository<Image>,
    @InjectRepository(CatalogImage)
    private readonly catalogImagesRepository: Repository<CatalogImage>,
    @InjectRepository(ProductVariant)
    private readonly productVariantsRepository: Repository<ProductVariant>,
  ) {}

  async createImage(dto: CreateImageDto): Promise<Image> {
    const image = this.imagesRepository.create({
      url: dto.url,
      ordem: dto.ordem ?? 0,
      descricao: dto.descricao ?? null,
      localRenderizacao: dto.local_renderizacao ?? null,
    });

    return this.imagesRepository.save(image);
  }

  async linkImageToVariant(dto: CreateCatalogImageDto): Promise<CatalogImage> {
    const image = await this.imagesRepository.findOne({
      where: { idImagem: dto.imageId },
    });
    if (!image) {
      throw new NotFoundException(`Imagem com id ${dto.imageId} não encontrada`);
    }

    const variant = await this.productVariantsRepository.findOne({
      where: { codigoSku: dto.variantSku },
    });
    if (!variant) {
      throw new NotFoundException(
        `Variante com SKU ${dto.variantSku} não encontrada`,
      );
    }

    const catalogImage = this.catalogImagesRepository.create({
      idImagem: image.idImagem,
      codigoSku: variant.codigoSku,
      image,
      variant,
      ordemNoCatalogo: dto.ordem_no_catalogo ?? 0,
    });

    return this.catalogImagesRepository.save(catalogImage);
  }

  async findCatalogByVariantSku(variantSku: string): Promise<CatalogImage[]> {
    const variant = await this.productVariantsRepository.findOne({
      where: { codigoSku: variantSku },
    });
    if (!variant) {
      throw new NotFoundException(`Variante com SKU ${variantSku} não encontrada`);
    }

    return this.catalogImagesRepository.find({
      where: { variant: { codigoSku: variantSku } },
      relations: { image: true, variant: true },
      order: { ordemNoCatalogo: 'ASC' },
    });
  }
}
