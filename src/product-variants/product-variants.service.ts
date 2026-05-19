import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../products/entities/product.entity';
import { CreateProductVariantDto } from './dtos/create-product-variant.dto';
import { QueryProductVariantsDto } from './dtos/query-product-variants.dto';
import { UpdateProductVariantDto } from './dtos/update-product-variant.dto';
import { ProductVariant } from './entities/product-variant.entity';

@Injectable()
export class ProductVariantsService {
  constructor(
    @InjectRepository(ProductVariant)
    private readonly variantsRepository: Repository<ProductVariant>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
  ) {}

  async create(dto: CreateProductVariantDto): Promise<ProductVariant> {
    const product = await this.productsRepository.findOne({
      where: { idProduto: dto.idProduto },
    });

    if (!product) {
      throw new NotFoundException(
        `Produto com id ${dto.idProduto} não encontrado`,
      );
    }

    const variant = this.variantsRepository.create({
      codigoSku: dto.codigo_sku,
      precoVariante: dto.preco_variante,
      ativo: dto.ativo ?? true,
      cor: dto.cor ?? null,
      tamanho: dto.tamanho ?? null,
      product,
    });

    return this.variantsRepository.save(variant);
  }

  async findAll(query: QueryProductVariantsDto): Promise<{
    data: ProductVariant[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [data, total] = await this.variantsRepository.findAndCount({
      where: { ativo: query.ativo ?? true },
      relations: { product: true },
      order: { codigoSku: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findOne(sku: string): Promise<ProductVariant> {
    const variant = await this.variantsRepository.findOne({
      where: { codigoSku: sku },
      relations: { product: true },
    });

    if (!variant) {
      throw new NotFoundException(`Variante com SKU ${sku} não encontrada`);
    }

    return variant;
  }

  async update(
    sku: string,
    dto: UpdateProductVariantDto,
  ): Promise<ProductVariant> {
    const variant = await this.findOne(sku);

    Object.assign(variant, {
      precoVariante: dto.preco_variante ?? variant.precoVariante,
      ativo: dto.ativo ?? variant.ativo,
      cor: dto.cor === undefined ? variant.cor : dto.cor,
      tamanho: dto.tamanho === undefined ? variant.tamanho : dto.tamanho,
      medidas: dto.medidas === undefined ? variant.medidas : dto.medidas,
    });

    await this.variantsRepository.save(variant);
    return this.findOne(sku);
  }

  async remove(sku: string): Promise<void> {
    const result = await this.variantsRepository.delete({ codigoSku: sku });

    if (result.affected === 0) {
      throw new NotFoundException(`Variante com SKU ${sku} não encontrada`);
    }
  }
}
