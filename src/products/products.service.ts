import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { FilterProductDto } from './dto/filter-product.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateProductDto) {
    const existing = await this.prisma.product.findUnique({
      where: { sku: dto.sku },
    });

    if (existing) {
      throw new ConflictException(`SKU '${dto.sku}' already exists`);
    }

    return this.prisma.product.create({
      data: {
        ...dto,
        price: new Prisma.Decimal(dto.price),
        inventory: { create: { quantity: 0 } },
      },
      include: { inventory: true },
    });
  }

  async findAll(filter: FilterProductDto) {
    const where: Prisma.ProductWhereInput = { active: true };

    if (filter.category) {
      where.category = filter.category;
    }

    if (filter.search) {
      where.OR = [
        { name: { contains: filter.search, mode: 'insensitive' } },
        { description: { contains: filter.search, mode: 'insensitive' } },
        { sku: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.product.findMany({
      where,
      include: { inventory: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { inventory: true },
    });

    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }

    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);

    if (dto.sku) {
      const existing = await this.prisma.product.findFirst({
        where: { sku: dto.sku, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException(`SKU '${dto.sku}' already exists`);
      }
    }

    const data: Prisma.ProductUpdateInput = { ...dto };
    if (dto.price !== undefined) {
      data.price = new Prisma.Decimal(dto.price);
    }

    return this.prisma.product.update({
      where: { id },
      data,
      include: { inventory: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.product.update({
      where: { id },
      data: { active: false },
      include: { inventory: true },
    });
  }
}
