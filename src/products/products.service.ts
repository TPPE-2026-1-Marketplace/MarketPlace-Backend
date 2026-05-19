import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../categories/entities/category.entity';
import { CreateProductDto } from './dtos/create-product.dto';
import { QueryProductsDto } from './dtos/query-products.dto';
import { UpdateProductDto } from './dtos/update-product.dto';
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
      sku: dto.sku,
    });

    return this.productsRepository.save(product);
  }

  async findAll(query: QueryProductsDto): Promise<{
    data: Product[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.productsRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.categories', 'categories')
      .leftJoinAndSelect('product.variants', 'variants')
      .orderBy('product.titulo', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.categoryId !== undefined) {
      qb.innerJoin(
        'product.categories',
        'filterCategory',
        'filterCategory.idCategoria = :categoryId',
        { categoryId: query.categoryId },
      );
    }

    if (query.destaque !== undefined) {
      qb.andWhere('product.destaque = :destaque', {
        destaque: query.destaque,
      });
    }

    if (query.precoMin !== undefined) {
      qb.andWhere('product.precoBase >= :precoMin', {
        precoMin: query.precoMin,
      });
    }

    if (query.precoMax !== undefined) {
      qb.andWhere('product.precoBase <= :precoMax', {
        precoMax: query.precoMax,
      });
    }

    const [data, total] = await qb.getManyAndCount();

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

  async findOne(id: number): Promise<Product> {
    return this.findOneWithCategoriesAndVariants(id);
  }

  async update(id: number, dto: UpdateProductDto): Promise<Product> {
    const product = await this.findOneWithCategoriesAndVariants(id);

    Object.assign(product, {
      titulo: dto.titulo ?? product.titulo,
      descricao:
        dto.descricao === undefined ? product.descricao : dto.descricao,
      destaque: dto.destaque ?? product.destaque,
      qualMedida:
        dto.qual_medida === undefined ? product.qualMedida : dto.qual_medida,
      material: dto.material === undefined ? product.material : dto.material,
      composicao:
        dto.composicao === undefined ? product.composicao : dto.composicao,
      silhueta: dto.silhueta === undefined ? product.silhueta : dto.silhueta,
      tags: dto.tags === undefined ? product.tags : dto.tags,
      precoBase: dto.preco_base ?? product.precoBase,
      sku: dto.sku ?? product.sku,
    });

    await this.productsRepository.save(product);
    return this.findOneWithCategoriesAndVariants(id);
  }

  async remove(id: number): Promise<void> {
    const result = await this.productsRepository.delete({ idProduto: id });

    if (result.affected === 0) {
      throw new NotFoundException(`Produto com id ${id} não encontrado`);
    }
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

  private async findOneWithCategoriesAndVariants(id: number): Promise<Product> {
    const product = await this.productsRepository.findOne({
      where: { idProduto: id },
      relations: { categories: true, variants: true },
    });

    if (!product) {
      throw new NotFoundException(`Produto com id ${id} não encontrado`);
    }

    return product;
  }
}
