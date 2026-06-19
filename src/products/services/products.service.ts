import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import { QueryProductsDto } from '../dtos/query-products.dto';
import { CreateProductDto } from '../dtos/create-product.dto';

export interface PaginatedProducts {
  data: Product[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class ProductsService implements OnModuleInit {
  private static readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
  ) {}

  /** Popula o catálogo com alguns produtos caso a tabela esteja vazia. */
  async onModuleInit(): Promise<void> {
    const count = await this.productsRepository.count();
    if (count > 0) return;

    ProductsService.logger.log('Catálogo vazio — inserindo produtos de exemplo (seed).');

    const seed: Partial<Product>[] = [
      { titulo: 'Vestido Floral Verão', preco_base: 199.9, categoria: 'vestidos', descricao: 'Vestido leve com estampa floral.' },
      { titulo: 'Blusa de Linho Off-White', preco_base: 129.9, categoria: 'blusas', descricao: 'Blusa de linho confortável.' },
      { titulo: 'Calça Pantalona Preta', preco_base: 179.9, categoria: 'calcas', descricao: 'Calça pantalona de caimento elegante.' },
      { titulo: 'Saia Midi Plissada', preco_base: 149.9, categoria: 'saias', descricao: 'Saia midi plissada versátil.' },
      { titulo: 'Conjunto Alfaiataria', preco_base: 349.9, categoria: 'conjuntos', descricao: 'Conjunto de alfaiataria moderno.' },
    ];

    await this.productsRepository.save(seed.map((p) => this.productsRepository.create(p)));
  }

  async findAll(query: QueryProductsDto): Promise<PaginatedProducts> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;

    const where: Record<string, unknown> = {};
    if (query.categoria) where.categoria = query.categoria;
    if (query.busca) where.titulo = ILike(`%${query.busca}%`);

    const [data, total] = await this.productsRepository.findAndCount({
      where,
      take: limit,
      skip: (page - 1) * limit,
      order: { id_produto: 'ASC' },
    });

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findOne(id: number): Promise<Product> {
    const product = await this.productsRepository.findOne({ where: { id_produto: id } });
    if (!product) {
      throw new NotFoundException(`Produto com id=${id} não encontrado.`);
    }
    return product;
  }

  async create(dto: CreateProductDto): Promise<Product> {
    const product = this.productsRepository.create({
      titulo: dto.titulo,
      preco_base: dto.preco_base,
      descricao: dto.descricao ?? null,
      categoria: dto.categoria ?? null,
      imagem_url: dto.imagem_url ?? null,
    });
    return this.productsRepository.save(product);
  }
}
