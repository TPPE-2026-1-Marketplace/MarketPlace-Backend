import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../categories/entities/category.entity';
import { CreateProductDto } from './dtos/create-product.dto';
import { Product } from './entities/product.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
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

  async addCategory(id: number, categoryId: number): Promise<Product> {
    const product = await this.findOneWithCategories(id);
    const category = await this.categoriesRepository.findOne({
      where: { idCategoria: categoryId },
    });

    if (!category) {
      throw new NotFoundException(
        `Categoria com id ${categoryId} não encontrada`,
      );
    }

    const categories = product.categories ?? [];
    const alreadyLinked = categories.some(
      (current) => current.idCategoria === category.idCategoria,
    );

    if (!alreadyLinked) {
      product.categories = [...categories, category];
      await this.productsRepository.save(product);
    }

    return this.findOneWithCategories(id);
  }

  async removeCategory(id: number, categoryId: number): Promise<Product> {
    const product = await this.findOneWithCategories(id);
    const category = await this.categoriesRepository.findOne({
      where: { idCategoria: categoryId },
    });

    if (!category) {
      throw new NotFoundException(
        `Categoria com id ${categoryId} não encontrada`,
      );
    }

    product.categories = (product.categories ?? []).filter(
      (current) => current.idCategoria !== categoryId,
    );
    await this.productsRepository.save(product);

    return this.findOneWithCategories(id);
  }

  private async findOneWithCategories(id: number): Promise<Product> {
    const product = await this.productsRepository.findOne({
      where: { idProduto: id },
      relations: { categories: true },
    });

    if (!product) {
      throw new NotFoundException(`Produto com id ${id} não encontrado`);
    }

    return product;
  }
}
