import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProductDto } from './dtos/create-product.dto';
import { Product } from './entities/product.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
  ) {}

  async create(dto: CreateProductDto): Promise<Product> {
    const product = this.productsRepository.create({
      titulo: dto.titulo,
      descricao: dto.descricao ?? null,
      destaque: dto.destaque ?? false,
      qualMedida: dto.qual_medida ?? null,
      material: dto.material ?? null,
      composicao: dto.composicao ?? null,
      silhueta: dto.silhueta ?? null,
      tags: dto.tags ?? null,
      precoBase: dto.preco_base,
      SKU: dto.SKU,
    });

    return this.productsRepository.save(product);
  }
}
